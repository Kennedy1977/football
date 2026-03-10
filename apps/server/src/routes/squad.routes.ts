import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { computeTeamOverall, playerSellValue } from "../../../../packages/game-core/src/formulas";
import type { FormationCode, PlayerCard } from "../../../../packages/game-core/src/types";
import { pool } from "../config/db";
import { requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { recoverClubStamina } from "../lib/stamina-recovery";
import { asyncHandler } from "../middleware/async-handler";

export const squadRouter = Router();

interface ClubContextRow extends RowDataPacket {
  club_id: number;
  manager_id: number;
}

interface PlayerRow extends RowDataPacket {
  id: number;
  name: string;
  age: number;
  shirt_number: number;
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
  is_starting: number;
  is_bench: number;
}

interface FormationUnlockRow extends RowDataPacket {
  formation_code: string;
}

interface LineupRow extends RowDataPacket {
  formation_code: string;
  starting_player_ids: string;
  bench_player_ids: string;
}

squadRouter.get(
  "/players",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const context = await getClubContext(accountId);
    await recoverClubStamina(context.club_id);

    const [players] = await pool.query<PlayerRow[]>(
      `
        SELECT
          id,
          name,
          age,
          shirt_number,
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
          goalkeeping,
          is_starting,
          is_bench
        FROM players
        WHERE club_id = ?
        ORDER BY is_starting DESC, overall_rating DESC, position ASC, id ASC
      `,
      [context.club_id]
    );

    const [lineupRows] = await pool.query<LineupRow[]>(
      "SELECT formation_code, starting_player_ids, bench_player_ids FROM lineups WHERE club_id = ? LIMIT 1",
      [context.club_id]
    );

    const [unlockRows] = await pool.query<FormationUnlockRow[]>(
      "SELECT formation_code FROM formation_unlocks WHERE manager_id = ?",
      [context.manager_id]
    );

    res.status(200).json({
      squadSize: players.length,
      players: players.map((player) => ({
        id: player.id,
        name: player.name,
        age: player.age,
        shirtNumber: player.shirt_number,
        position: player.position,
        rarity: player.rarity,
        overall: Number(player.overall_rating),
        level: player.level,
        exp: player.exp,
        stamina: Number(player.stamina),
        isStarting: Boolean(player.is_starting),
        isBench: Boolean(player.is_bench),
      })),
      lineup:
        lineupRows.length > 0
          ? {
              formation: lineupRows[0].formation_code,
              startingPlayerIds: parseJsonNumberArray(lineupRows[0].starting_player_ids),
              benchPlayerIds: parseJsonNumberArray(lineupRows[0].bench_player_ids),
            }
          : null,
      unlockedFormations: unlockRows.map((row) => row.formation_code),
    });
  })
);

squadRouter.put(
  "/lineup",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const context = await getClubContext(accountId);
    await recoverClubStamina(context.club_id);

    const formation = readFormation(req.body?.formation);
    const startingPlayerIds = readIdArray(req.body?.startingPlayerIds, "startingPlayerIds");
    const benchPlayerIds = readIdArray(req.body?.benchPlayerIds || [], "benchPlayerIds");

    if (startingPlayerIds.length !== 11) {
      throw new HttpError(400, "startingPlayerIds must contain exactly 11 players");
    }

    if (benchPlayerIds.length > 5) {
      throw new HttpError(400, "benchPlayerIds cannot exceed 5 players");
    }

    const overlap = startingPlayerIds.some((id) => benchPlayerIds.includes(id));
    if (overlap) {
      throw new HttpError(400, "starting and bench players cannot overlap");
    }

    const [unlockRows] = await pool.query<FormationUnlockRow[]>(
      "SELECT formation_code FROM formation_unlocks WHERE manager_id = ? AND formation_code = ? LIMIT 1",
      [context.manager_id, formation]
    );

    if (!unlockRows.length) {
      throw new HttpError(400, `Formation ${formation} is not unlocked for this manager`);
    }

    const [playerRows] = await pool.query<PlayerRow[]>(
      `
        SELECT
          id,
          name,
          age,
          shirt_number,
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
          goalkeeping,
          is_starting,
          is_bench
        FROM players
        WHERE club_id = ?
      `,
      [context.club_id]
    );

    const playerMap = new Map(playerRows.map((player) => [player.id, player]));

    for (const id of [...startingPlayerIds, ...benchPlayerIds]) {
      if (!playerMap.has(id)) {
        throw new HttpError(400, `Player ${id} is not in this club`);
      }
    }

    const startingPlayers = startingPlayerIds.map((id) => playerMap.get(id)!);

    const gkCount = startingPlayers.filter((player) => player.position === "GK").length;
    if (gkCount < 1) {
      throw new HttpError(400, "Starting 11 must include at least one goalkeeper");
    }

    const exhausted = startingPlayers.find((player) => Number(player.stamina) <= 0);
    if (exhausted) {
      throw new HttpError(400, `Player ${exhausted.id} has red stamina and is unavailable`);
    }

    const starterCards = startingPlayers.map<PlayerCard>((player) => ({
      id: String(player.id),
      name: player.name,
      position: player.position,
      rarity: player.rarity,
      overall: Number(player.overall_rating),
      level: player.level,
      exp: player.exp,
      stamina: Number(player.stamina),
      isStarting: true,
      stats: {
        pace: player.pace,
        shooting: player.shooting,
        passing: player.passing,
        dribbling: player.dribbling,
        defending: player.defending,
        strength: player.strength,
        goalkeeping: player.goalkeeping,
      },
    }));

    const teamOverall = computeTeamOverall(starterCards);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.query(
        "UPDATE players SET is_starting = FALSE, is_bench = FALSE WHERE club_id = ?",
        [context.club_id]
      );

      if (startingPlayerIds.length) {
        await connection.query(
          "UPDATE players SET is_starting = TRUE WHERE club_id = ? AND id IN (?)",
          [context.club_id, startingPlayerIds]
        );
      }

      if (benchPlayerIds.length) {
        await connection.query(
          "UPDATE players SET is_bench = TRUE WHERE club_id = ? AND id IN (?)",
          [context.club_id, benchPlayerIds]
        );
      }

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO lineups (club_id, formation_code, starting_player_ids, bench_player_ids)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            formation_code = VALUES(formation_code),
            starting_player_ids = VALUES(starting_player_ids),
            bench_player_ids = VALUES(bench_player_ids)
        `,
        [context.club_id, formation, JSON.stringify(startingPlayerIds), JSON.stringify(benchPlayerIds)]
      );

      await connection.execute<ResultSetHeader>(
        "UPDATE clubs SET team_overall = ? WHERE id = ?",
        [teamOverall, context.club_id]
      );

      await connection.commit();

      res.status(200).json({
        updated: true,
        lineup: {
          formation,
          startingPlayerIds,
          benchPlayerIds,
        },
        teamOverall,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

squadRouter.post(
  "/sell",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const context = await getClubContext(accountId);

    const playerId = Number(req.body?.playerId);
    if (!Number.isInteger(playerId) || playerId <= 0) {
      throw new HttpError(400, "playerId must be a positive integer");
    }

    const [playerRows] = await pool.query<PlayerRow[]>(
      `
        SELECT
          id,
          name,
          age,
          shirt_number,
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
          goalkeeping,
          is_starting,
          is_bench
        FROM players
        WHERE id = ? AND club_id = ?
        LIMIT 1
      `,
      [playerId, context.club_id]
    );

    if (!playerRows.length) {
      throw new HttpError(404, "Player not found in this club");
    }

    const player = playerRows[0];

    const [countRows] = await pool.query<(RowDataPacket & { total: number; gk_total: number })[]>(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN position = 'GK' THEN 1 ELSE 0 END) AS gk_total
        FROM players
        WHERE club_id = ?
      `,
      [context.club_id]
    );

    const total = Number(countRows[0]?.total || 0);
    const gkTotal = Number(countRows[0]?.gk_total || 0);

    if (total <= 11) {
      throw new HttpError(400, "Cannot sell player: club must keep at least 11 players");
    }

    if (player.position === "GK" && gkTotal <= 1) {
      throw new HttpError(400, "Cannot sell player: club must keep at least one goalkeeper");
    }

    const sellCoins = playerSellValue({
      id: String(player.id),
      name: player.name,
      position: player.position,
      rarity: player.rarity,
      overall: Number(player.overall_rating),
      level: player.level,
      exp: player.exp,
      stamina: Number(player.stamina),
      isStarting: Boolean(player.is_starting),
      stats: {
        pace: player.pace,
        shooting: player.shooting,
        passing: player.passing,
        dribbling: player.dribbling,
        defending: player.defending,
        strength: player.strength,
        goalkeeping: player.goalkeeping,
      },
    });

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.execute<ResultSetHeader>(
        "DELETE FROM players WHERE id = ? AND club_id = ?",
        [player.id, context.club_id]
      );

      const [lineupRows] = await connection.query<LineupRow[]>(
        "SELECT formation_code, starting_player_ids, bench_player_ids FROM lineups WHERE club_id = ? LIMIT 1",
        [context.club_id]
      );

      if (lineupRows.length) {
        const startingIds = parseJsonNumberArray(lineupRows[0].starting_player_ids).filter((id) => id !== player.id);
        const benchIds = parseJsonNumberArray(lineupRows[0].bench_player_ids).filter((id) => id !== player.id);

        await connection.execute<ResultSetHeader>(
          `
            UPDATE lineups
            SET starting_player_ids = ?, bench_player_ids = ?
            WHERE club_id = ?
          `,
          [JSON.stringify(startingIds), JSON.stringify(benchIds), context.club_id]
        );
      }

      await connection.execute<ResultSetHeader>(
        "UPDATE clubs SET coins = coins + ? WHERE id = ?",
        [sellCoins, context.club_id]
      );

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO economy_transactions (club_id, source_type, direction, amount, reference_id, metadata_json)
          VALUES (?, 'PLAYER_SALE', 'IN', ?, ?, ?)
        `,
        [
          context.club_id,
          sellCoins,
          player.id,
          JSON.stringify({
            playerName: player.name,
            wasStarter: Boolean(player.is_starting),
            rarity: player.rarity,
            overall: Number(player.overall_rating),
          }),
        ]
      );

      await connection.commit();

      res.status(200).json({
        sold: true,
        player: {
          id: player.id,
          name: player.name,
          rarity: player.rarity,
          overall: Number(player.overall_rating),
          wasStarter: Boolean(player.is_starting),
        },
        coinsAwarded: sellCoins,
        warning: player.is_starting ? "Sold player was part of current starting 11" : null,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

async function getClubContext(accountId: number): Promise<ClubContextRow> {
  const [rows] = await pool.query<ClubContextRow[]>(
    `
      SELECT c.id AS club_id, c.manager_id AS manager_id
      FROM clubs c
      WHERE c.account_id = ?
      LIMIT 1
    `,
    [accountId]
  );

  if (!rows.length) {
    throw new HttpError(404, "Club not found for current account");
  }

  return rows[0];
}

function readFormation(value: unknown): FormationCode {
  if (typeof value !== "string") {
    throw new HttpError(400, "formation is required");
  }

  const allowed: FormationCode[] = ["4-4-2", "4-3-3", "4-5-1", "4-2-3-1", "3-5-2", "5-3-2", "4-2-4"];

  if (!allowed.includes(value as FormationCode)) {
    throw new HttpError(400, "Unsupported formation code");
  }

  return value as FormationCode;
}

function readIdArray(value: unknown, field: string): number[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an array`);
  }

  const parsed = value.map((item) => Number(item));
  if (parsed.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new HttpError(400, `${field} must contain positive integer ids`);
  }

  if (new Set(parsed).size !== parsed.length) {
    throw new HttpError(400, `${field} contains duplicate ids`);
  }

  return parsed;
}

function parseJsonNumberArray(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}
