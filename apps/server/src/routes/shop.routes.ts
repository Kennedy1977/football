import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  generatePackPlayer,
  playerSellValue,
  applyPlayerExp,
  type PlayerCard,
} from "../../../../packages/game-core/src";
import { pool } from "../config/db";
import { requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../middleware/async-handler";

export const shopRouter = Router();

interface ClubRow extends RowDataPacket {
  club_id: number;
  coins: number;
  team_overall: number;
}

interface PlayerNeedRow extends RowDataPacket {
  id: number;
  position: "GK" | "DEF" | "MID" | "ATT";
  overall_rating: number;
}

interface PackRow extends RowDataPacket {
  id: number;
  code: string;
  name: string;
  price_coins: number;
  reward_count: number;
  rarity_hint: string;
  reward_focus: string;
  odds_json: string;
}

interface PackRewardRow extends RowDataPacket {
  id: number;
  pack_purchase_id: number;
  reward_type: "PLAYER" | "COINS" | "PLAYER_EXP";
  generated_player_id: number | null;
  reward_payload_json: string | null;
  coin_amount: number | null;
  exp_amount: number | null;
  keep_or_convert: "KEEP" | "CONVERT_COINS" | "CONVERT_EXP";
  resolved_at: Date | null;
}

interface PendingPackRewardRow extends RowDataPacket {
  reward_id: number;
  pack_purchase_id: number;
  reward_payload_json: string | null;
  coin_amount: number | null;
  exp_amount: number | null;
  pack_id: number;
  pack_code: string;
  pack_name: string;
  pack_price_coins: number;
}

interface PlayerStatsRow extends RowDataPacket {
  id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  overall_rating: number;
  level: number;
  exp: number;
  stamina: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  strength: number;
  goalkeeping: number;
}

interface RewardPlayerPayload {
  name: string;
  age: number;
  position: "GK" | "DEF" | "MID" | "ATT";
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  overall: number;
  shirtNumber: number;
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    strength: number;
    goalkeeping: number;
  };
}

shopRouter.get(
  "/packs",
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.query<PackRow[]>(
      `
        SELECT id, code, name, price_coins, reward_count, rarity_hint, reward_focus, odds_json
        FROM pack_catalogue
        WHERE is_active = TRUE
        ORDER BY price_coins ASC
      `
    );

    res.status(200).json({
      packs: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        priceCoins: row.price_coins,
        rewardCount: row.reward_count,
        rarityHint: row.rarity_hint,
        rewardFocus: row.reward_focus,
        odds: tryParseJson(row.odds_json),
      })),
    });
  })
);

shopRouter.get(
  "/packs/pending",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const [clubRows] = await pool.query<ClubRow[]>(
      "SELECT id AS club_id, coins, team_overall FROM clubs WHERE account_id = ? LIMIT 1",
      [accountId]
    );

    if (!clubRows.length) {
      throw new HttpError(400, "Club must be created before opening chests");
    }

    const club = clubRows[0];
    const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
      "SELECT COUNT(*) AS total FROM players WHERE club_id = ?",
      [club.club_id]
    );
    const keepAvailable = Number(countRows[0]?.total ?? 0) < 28;

    const [rows] = await pool.query<PendingPackRewardRow[]>(
      `
        SELECT
          pr.id AS reward_id,
          pr.pack_purchase_id,
          pr.reward_payload_json,
          pr.coin_amount,
          pr.exp_amount,
          pc.id AS pack_id,
          pc.code AS pack_code,
          pc.name AS pack_name,
          pc.price_coins AS pack_price_coins
        FROM pack_rewards pr
        INNER JOIN pack_purchases pp ON pp.id = pr.pack_purchase_id
        INNER JOIN pack_catalogue pc ON pc.id = pp.pack_id
        WHERE pp.club_id = ? AND pr.resolved_at IS NULL AND pr.reward_type = 'PLAYER'
        ORDER BY pp.created_at DESC, pr.id ASC
      `,
      [club.club_id]
    );

    res.status(200).json({
      rewards: rows.map((row) => {
        const payload = parseRewardPayload(row.reward_payload_json);
        const projectedValue = playerSellValue(toPreviewCard(payload));
        const convertAmount = Math.max(1, Math.round(projectedValue * 0.2));

        return {
          rewardId: row.reward_id,
          purchaseId: row.pack_purchase_id,
          pack: {
            id: row.pack_id,
            code: row.pack_code,
            name: row.pack_name,
            priceCoins: row.pack_price_coins,
          },
          player: payload,
          keepAvailable,
          convertCoins: Number(row.coin_amount ?? convertAmount),
          convertExp: Number(row.exp_amount ?? convertAmount),
        };
      }),
    });
  })
);

shopRouter.post(
  "/packs/purchase",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const packCode = typeof req.body?.packCode === "string" ? req.body.packCode.trim() : null;
    const packId = req.body?.packId ? Number(req.body.packId) : null;

    if (!packCode && (!packId || !Number.isInteger(packId) || packId <= 0)) {
      throw new HttpError(400, "packCode or valid packId is required");
    }

    const [clubRows] = await pool.query<ClubRow[]>(
      "SELECT id AS club_id, coins, team_overall FROM clubs WHERE account_id = ? LIMIT 1",
      [accountId]
    );

    if (!clubRows.length) {
      throw new HttpError(400, "Club must be created before purchasing packs");
    }

    const club = clubRows[0];

    const [packRows] = await pool.query<PackRow[]>(
      packCode
        ? `
            SELECT id, code, name, price_coins, reward_count, rarity_hint, reward_focus, odds_json
            FROM pack_catalogue
            WHERE code = ? AND is_active = TRUE
            LIMIT 1
          `
        : `
            SELECT id, code, name, price_coins, reward_count, rarity_hint, reward_focus, odds_json
            FROM pack_catalogue
            WHERE id = ? AND is_active = TRUE
            LIMIT 1
          `,
      [packCode || packId]
    );

    if (!packRows.length) {
      throw new HttpError(404, "Pack not found");
    }

    const pack = packRows[0];

    if (club.coins < pack.price_coins) {
      throw new HttpError(400, "Insufficient coins for this pack");
    }

    const [squadRows] = await pool.query<PlayerNeedRow[]>(
      "SELECT id, position, overall_rating FROM players WHERE club_id = ?",
      [club.club_id]
    );

    const odds = tryParseJson(pack.odds_json);
    if (!odds || typeof odds !== "object") {
      throw new HttpError(500, "Pack odds are invalid");
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [purchaseInsert] = await connection.execute<ResultSetHeader>(
        "INSERT INTO pack_purchases (club_id, pack_id, total_cost) VALUES (?, ?, ?)",
        [club.club_id, pack.id, pack.price_coins]
      );

      await connection.execute<ResultSetHeader>(
        "UPDATE clubs SET coins = coins - ? WHERE id = ?",
        [pack.price_coins, club.club_id]
      );

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO economy_transactions (club_id, source_type, direction, amount, reference_id, metadata_json)
          VALUES (?, 'PACK_PURCHASE', 'OUT', ?, ?, ?)
        `,
        [club.club_id, pack.price_coins, purchaseInsert.insertId, JSON.stringify({ packCode: pack.code })]
      );

      const rewards: Array<{
        rewardId: number;
        type: "PLAYER";
        player: RewardPlayerPayload;
        keepAvailable: boolean;
        convertCoins: number;
        convertExp: number;
      }> = [];

      for (let i = 0; i < pack.reward_count; i += 1) {
        const generated = generatePackPlayer({
          seed: `pack-${purchaseInsert.insertId}-slot-${i + 1}`,
          packPrice: pack.price_coins,
          odds: odds as Record<string, number>,
          squad: squadRows.map((player) => ({
            position: player.position,
            overall: Number(player.overall_rating),
          })),
          currentTeamOverall: Number(club.team_overall),
        });

        const payload: RewardPlayerPayload = {
          name: generated.name,
          age: generated.age,
          position: generated.position,
          rarity: generated.rarity,
          overall: generated.overall,
          shirtNumber: generated.shirtNumber,
          stats: generated.stats,
        };

        const estimatedValue = playerSellValue(toPreviewCard(payload));
        const convertAmount = Math.max(1, Math.round(estimatedValue * 0.2));

        const [rewardInsert] = await connection.execute<ResultSetHeader>(
          `
            INSERT INTO pack_rewards (
              pack_purchase_id,
              reward_type,
              generated_player_id,
              reward_payload_json,
              coin_amount,
              exp_amount,
              keep_or_convert,
              resolved_at
            )
            VALUES (?, 'PLAYER', NULL, ?, ?, ?, 'KEEP', NULL)
          `,
          [purchaseInsert.insertId, JSON.stringify(payload), convertAmount, convertAmount]
        );

        rewards.push({
          rewardId: rewardInsert.insertId,
          type: "PLAYER",
          player: payload,
          keepAvailable: squadRows.length < 28,
          convertCoins: convertAmount,
          convertExp: convertAmount,
        });
      }

      await connection.commit();

      res.status(201).json({
        purchased: true,
        pack: {
          id: pack.id,
          code: pack.code,
          name: pack.name,
          priceCoins: pack.price_coins,
        },
        purchaseId: purchaseInsert.insertId,
        remainingCoins: club.coins - pack.price_coins,
        rewards,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

shopRouter.post(
  "/packs/reward-decision",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const rewardId = Number(req.body?.rewardId);
    const decision = readDecision(req.body?.decision);
    const targetPlayerId = req.body?.targetPlayerId ? Number(req.body.targetPlayerId) : null;

    if (!Number.isInteger(rewardId) || rewardId <= 0) {
      throw new HttpError(400, "rewardId must be a positive integer");
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [clubRows] = await connection.query<ClubRow[]>(
        "SELECT id AS club_id, coins, team_overall FROM clubs WHERE account_id = ? LIMIT 1",
        [accountId]
      );

      if (!clubRows.length) {
        throw new HttpError(404, "Club not found for account");
      }

      const club = clubRows[0];

      const [rewardRows] = await connection.query<PackRewardRow[]>(
        `
          SELECT
            pr.id,
            pr.pack_purchase_id,
            pr.reward_type,
            pr.generated_player_id,
            pr.reward_payload_json,
            pr.coin_amount,
            pr.exp_amount,
            pr.keep_or_convert,
            pr.resolved_at
          FROM pack_rewards pr
          INNER JOIN pack_purchases pp ON pp.id = pr.pack_purchase_id
          WHERE pr.id = ? AND pp.club_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [rewardId, club.club_id]
      );

      if (!rewardRows.length) {
        throw new HttpError(404, "Pack reward not found for current club");
      }

      const reward = rewardRows[0];

      if (reward.resolved_at) {
        throw new HttpError(409, "This reward decision has already been resolved");
      }

      if (reward.reward_type !== "PLAYER") {
        throw new HttpError(400, "Only player rewards are currently supported in decision flow");
      }

      const payload = parseRewardPayload(reward.reward_payload_json);

      if (decision === "KEEP") {
        const [countRows] = await connection.query<(RowDataPacket & { total: number })[]>(
          "SELECT COUNT(*) AS total FROM players WHERE club_id = ?",
          [club.club_id]
        );

        const squadSize = Number(countRows[0]?.total || 0);
        if (squadSize >= 28) {
          throw new HttpError(400, "Squad is full. Convert this reward to coins or EXP.");
        }

        const [shirtRows] = await connection.query<(RowDataPacket & { shirt_number: number })[]>(
          "SELECT shirt_number FROM players WHERE club_id = ?",
          [club.club_id]
        );

        const assignedShirt = pickNextShirtNumber(
          payload.shirtNumber,
          shirtRows.map((row) => row.shirt_number)
        );

        const [playerInsert] = await connection.execute<ResultSetHeader>(
          `
            INSERT INTO players (
              club_id,
              name,
              age,
              shirt_number,
              position,
              rarity,
              overall_rating,
              level,
              exp,
              exp_to_next,
              pace,
              shooting,
              passing,
              dribbling,
              defending,
              strength,
              goalkeeping,
              stamina,
              is_starting,
              is_bench,
              portrait_seed
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 100, ?, ?, ?, ?, ?, ?, ?, 100, FALSE, FALSE, ?)
          `,
          [
            club.club_id,
            payload.name,
            payload.age,
            assignedShirt,
            payload.position,
            payload.rarity,
            payload.overall,
            payload.stats.pace,
            payload.stats.shooting,
            payload.stats.passing,
            payload.stats.dribbling,
            payload.stats.defending,
            payload.stats.strength,
            payload.stats.goalkeeping,
            `pack-reward-${reward.id}`,
          ]
        );

        await connection.execute<ResultSetHeader>(
          "UPDATE pack_rewards SET generated_player_id = ?, keep_or_convert = 'KEEP', resolved_at = NOW() WHERE id = ?",
          [playerInsert.insertId, reward.id]
        );

        await connection.commit();

        res.status(200).json({
          resolved: true,
          decision: "KEEP",
          rewardId: reward.id,
          player: {
            id: playerInsert.insertId,
            ...payload,
            shirtNumber: assignedShirt,
          },
        });
        return;
      }

      const projectedValue = playerSellValue(toPreviewCard(payload));
      const convertAmount = Math.max(
        1,
        decision === "CONVERT_COINS"
          ? Number(reward.coin_amount ?? Math.round(projectedValue * 0.2))
          : Number(reward.exp_amount ?? Math.round(projectedValue * 0.2))
      );

      if (decision === "CONVERT_COINS") {
        await connection.execute<ResultSetHeader>(
          "UPDATE clubs SET coins = coins + ? WHERE id = ?",
          [convertAmount, club.club_id]
        );

        await connection.execute<ResultSetHeader>(
          `
            INSERT INTO economy_transactions (club_id, source_type, direction, amount, reference_id, metadata_json)
            VALUES (?, 'PACK_CONVERT', 'IN', ?, ?, ?)
          `,
          [club.club_id, convertAmount, reward.id, JSON.stringify({ decision: "CONVERT_COINS" })]
        );

        await connection.execute<ResultSetHeader>(
          "UPDATE pack_rewards SET coin_amount = ?, keep_or_convert = 'CONVERT_COINS', resolved_at = NOW() WHERE id = ?",
          [convertAmount, reward.id]
        );

        await connection.commit();

        res.status(200).json({
          resolved: true,
          decision,
          rewardId: reward.id,
          coinsAwarded: convertAmount,
          clubCoins: club.coins + convertAmount,
        });
        return;
      }

      if (!targetPlayerId || !Number.isInteger(targetPlayerId) || targetPlayerId <= 0) {
        throw new HttpError(400, "targetPlayerId is required when converting to EXP");
      }

      const [targetRows] = await connection.query<PlayerStatsRow[]>(
        `
          SELECT
            id,
            name,
            position,
            rarity,
            overall_rating,
            level,
            exp,
            stamina,
            pace,
            shooting,
            passing,
            dribbling,
            defending,
            strength,
            goalkeeping
          FROM players
          WHERE id = ? AND club_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [targetPlayerId, club.club_id]
      );

      if (!targetRows.length) {
        throw new HttpError(404, "Target player not found in current club");
      }

      const target = targetRows[0];
      const updated = applyPlayerExp(toStoredPlayerCard(target), convertAmount);

      await connection.execute<ResultSetHeader>(
        "UPDATE players SET overall_rating = ?, level = ?, exp = ? WHERE id = ?",
        [updated.overall, updated.level, updated.exp, target.id]
      );

      await connection.execute<ResultSetHeader>(
        "UPDATE pack_rewards SET exp_amount = ?, keep_or_convert = 'CONVERT_EXP', resolved_at = NOW() WHERE id = ?",
        [convertAmount, reward.id]
      );

      await connection.commit();

      res.status(200).json({
        resolved: true,
        decision,
        rewardId: reward.id,
        expAwarded: convertAmount,
        targetPlayer: {
          id: target.id,
          overall: updated.overall,
          level: updated.level,
          exp: updated.exp,
        },
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

function readDecision(value: unknown): "KEEP" | "CONVERT_COINS" | "CONVERT_EXP" {
  if (value !== "KEEP" && value !== "CONVERT_COINS" && value !== "CONVERT_EXP") {
    throw new HttpError(400, "decision must be KEEP, CONVERT_COINS, or CONVERT_EXP");
  }
  return value;
}

function parseRewardPayload(raw: string | null): RewardPlayerPayload {
  const parsed = raw ? tryParseJson(raw) : null;
  if (!parsed || typeof parsed !== "object") {
    throw new HttpError(500, "Pack reward payload is missing or invalid");
  }

  const value = parsed as Partial<RewardPlayerPayload>;
  const requiredStats = value.stats as RewardPlayerPayload["stats"] | undefined;

  if (
    typeof value.name !== "string" ||
    !value.name ||
    typeof value.age !== "number" ||
    !value.position ||
    !value.rarity ||
    typeof value.overall !== "number" ||
    typeof value.shirtNumber !== "number" ||
    !requiredStats
  ) {
    throw new HttpError(500, "Pack reward payload is incomplete");
  }

  return {
    name: value.name,
    age: value.age,
    position: value.position,
    rarity: value.rarity,
    overall: value.overall,
    shirtNumber: value.shirtNumber,
    stats: {
      pace: Number(requiredStats.pace),
      shooting: Number(requiredStats.shooting),
      passing: Number(requiredStats.passing),
      dribbling: Number(requiredStats.dribbling),
      defending: Number(requiredStats.defending),
      strength: Number(requiredStats.strength),
      goalkeeping: Number(requiredStats.goalkeeping),
    },
  };
}

function pickNextShirtNumber(preferred: number, taken: number[]): number {
  const used = new Set(taken.filter((number) => Number.isInteger(number) && number >= 1 && number <= 99));

  const normalizedPreferred = clamp(Math.round(preferred), 1, 99);
  if (!used.has(normalizedPreferred)) {
    return normalizedPreferred;
  }

  for (let offset = 1; offset <= 98; offset += 1) {
    const next = ((normalizedPreferred - 1 + offset) % 99) + 1;
    if (!used.has(next)) {
      return next;
    }
  }

  throw new HttpError(400, "No shirt numbers available in squad");
}

function toPreviewCard(payload: RewardPlayerPayload): PlayerCard {
  return {
    id: "preview",
    name: payload.name,
    position: payload.position,
    rarity: payload.rarity,
    overall: payload.overall,
    level: 1,
    exp: 0,
    stamina: 100,
    isStarting: false,
    stats: {
      pace: payload.stats.pace,
      shooting: payload.stats.shooting,
      passing: payload.stats.passing,
      dribbling: payload.stats.dribbling,
      defending: payload.stats.defending,
      strength: payload.stats.strength,
      goalkeeping: payload.stats.goalkeeping,
    },
  };
}

function toStoredPlayerCard(player: PlayerStatsRow): PlayerCard {
  return {
    id: String(player.id),
    name: player.name,
    position: player.position,
    rarity: player.rarity,
    overall: Number(player.overall_rating),
    level: player.level,
    exp: player.exp,
    stamina: Number(player.stamina),
    isStarting: false,
    stats: {
      pace: player.pace,
      shooting: player.shooting,
      passing: player.passing,
      dribbling: player.dribbling,
      defending: player.defending,
      strength: player.strength,
      goalkeeping: player.goalkeeping,
    },
  };
}

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
