import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { DAILY_REWARD_COINS, LEAGUE_PROMOTION_THRESHOLDS, type LeagueCode } from "../../../../packages/game-core/src";
import { pool } from "../config/db";
import { requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { ensureCpuLeaguePopulation } from "../lib/world-seeding";
import { getNextResetIso, getRewardDateKey } from "../lib/time";
import { asyncHandler } from "../middleware/async-handler";

export const rewardsRouter = Router();

interface ClubCoinsRow extends RowDataPacket {
  id: number;
  coins: number;
}

interface ClaimRow extends RowDataPacket {
  id: number;
}

interface PromotionContextRow extends RowDataPacket {
  club_id: number;
  manager_id: number;
  current_league_code: LeagueCode;
  league_tier_id: number;
  points: number;
}

interface TierRow extends RowDataPacket {
  id: number;
}

const LEAGUE_ORDER: LeagueCode[] = [
  "BEGINNER_I",
  "BEGINNER_II",
  "BEGINNER_III",
  "BRONZE_I",
  "BRONZE_II",
  "BRONZE_III",
  "SILVER_I",
  "SILVER_II",
  "SILVER_III",
  "GOLD_I",
  "GOLD_II",
  "GOLD_III",
  "PLATINUM_I",
  "PLATINUM_II",
  "PLATINUM_III",
  "LEGENDS",
];

rewardsRouter.post(
  "/daily-claim",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const rewardDate = getRewardDateKey();

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [clubRows] = await connection.query<ClubCoinsRow[]>(
        "SELECT id, coins FROM clubs WHERE account_id = ? LIMIT 1",
        [accountId]
      );

      if (!clubRows.length) {
        throw new HttpError(400, "Club must be created before claiming rewards");
      }

      const club = clubRows[0];
      const [claimRows] = await connection.query<ClaimRow[]>(
        "SELECT id FROM daily_reward_claims WHERE club_id = ? AND reward_date = ? LIMIT 1",
        [club.id, rewardDate]
      );

      if (claimRows.length) {
        await connection.commit();
        res.status(409).json({
          claimed: false,
          message: "Daily reward already claimed for the current reset window",
          nextResetAt: getNextResetIso(),
        });
        return;
      }

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO daily_reward_claims (club_id, reward_date, coins_awarded)
          VALUES (?, ?, ?)
        `,
        [club.id, rewardDate, DAILY_REWARD_COINS]
      );

      await connection.execute<ResultSetHeader>(
        "UPDATE clubs SET coins = coins + ? WHERE id = ?",
        [DAILY_REWARD_COINS, club.id]
      );

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO economy_transactions (club_id, source_type, direction, amount, metadata_json)
          VALUES (?, 'DAILY_REWARD', 'IN', ?, ?)
        `,
        [club.id, DAILY_REWARD_COINS, JSON.stringify({ rewardDate })]
      );

      await connection.commit();

      res.status(200).json({
        claimed: true,
        rewardDate,
        coinsAwarded: DAILY_REWARD_COINS,
        clubCoins: club.coins + DAILY_REWARD_COINS,
        nextResetAt: getNextResetIso(),
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

rewardsRouter.post(
  "/promotion-claim",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [contextRows] = await connection.query<PromotionContextRow[]>(
        `
          SELECT
            c.id AS club_id,
            c.manager_id,
            c.current_league_code,
            lm.league_tier_id,
            lm.points
          FROM clubs c
          INNER JOIN league_memberships lm ON lm.club_id = c.id
          WHERE c.account_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [accountId]
      );

      if (!contextRows.length) {
        throw new HttpError(404, "Club league context not found");
      }

      const context = contextRows[0];

      if (context.current_league_code === "LEGENDS") {
        throw new HttpError(400, "Club is already in Legends and cannot be promoted further");
      }

      const threshold = LEAGUE_PROMOTION_THRESHOLDS[context.current_league_code];
      if (typeof threshold !== "number") {
        throw new HttpError(500, "Promotion threshold configuration missing for current league");
      }

      if (context.points < threshold) {
        throw new HttpError(400, "Promotion threshold not reached yet");
      }

      const [existingClaimRows] = await connection.query<ClaimRow[]>(
        "SELECT id FROM promotion_reward_claims WHERE club_id = ? AND league_tier_id = ? LIMIT 1",
        [context.club_id, context.league_tier_id]
      );

      if (existingClaimRows.length) {
        throw new HttpError(409, "Promotion reward for this tier has already been claimed");
      }

      const currentIndex = LEAGUE_ORDER.indexOf(context.current_league_code);
      if (currentIndex === -1 || currentIndex >= LEAGUE_ORDER.length - 1) {
        throw new HttpError(500, "Unable to determine next league tier");
      }

      const nextLeagueCode = LEAGUE_ORDER[currentIndex + 1];
      const [nextTierRows] = await connection.query<TierRow[]>(
        "SELECT id FROM league_tiers WHERE code = ? LIMIT 1",
        [nextLeagueCode]
      );

      if (!nextTierRows.length) {
        throw new HttpError(500, "Next league tier row is missing from league_tiers");
      }

      const rewardCoins = 150 + currentIndex * 100;
      const rewardManagerExp = 30 + currentIndex * 25;

      const [claimInsert] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO promotion_reward_claims (club_id, league_tier_id, coins_awarded, manager_exp_awarded)
          VALUES (?, ?, ?, ?)
        `,
        [context.club_id, context.league_tier_id, rewardCoins, rewardManagerExp]
      );

      await connection.execute<ResultSetHeader>(
        "UPDATE clubs SET current_league_code = ?, coins = coins + ? WHERE id = ?",
        [nextLeagueCode, rewardCoins, context.club_id]
      );

      await connection.execute<ResultSetHeader>(
        `
          UPDATE league_memberships
          SET league_tier_id = ?, legends_division = ?, rank_position = NULL
          WHERE club_id = ?
        `,
        [nextTierRows[0].id, nextLeagueCode === "LEGENDS" ? 1 : null, context.club_id]
      );

      // Ensure the destination tier has CPU clubs seeded so league tables/opponents are immediately available.
      await ensureCpuLeaguePopulation(connection, { leagueCodes: [nextLeagueCode] });

      await connection.execute<ResultSetHeader>(
        "UPDATE managers SET exp = exp + ? WHERE id = ?",
        [rewardManagerExp, context.manager_id]
      );

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO economy_transactions (club_id, source_type, direction, amount, reference_id, metadata_json)
          VALUES (?, 'PROMOTION', 'IN', ?, ?, ?)
        `,
        [
          context.club_id,
          rewardCoins,
          claimInsert.insertId,
          JSON.stringify({ fromLeague: context.current_league_code, toLeague: nextLeagueCode }),
        ]
      );

      await connection.commit();

      res.status(200).json({
        claimed: true,
        fromLeague: context.current_league_code,
        toLeague: nextLeagueCode,
        rewards: {
          coins: rewardCoins,
          managerExp: rewardManagerExp,
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
