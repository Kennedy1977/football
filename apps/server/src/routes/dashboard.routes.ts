import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db";
import { requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { normalizeManagerAvatar } from "../lib/manager-avatar";
import { getNextResetIso, getRewardDateKey } from "../lib/time";
import { asyncHandler } from "../middleware/async-handler";

export const dashboardRouter = Router();

interface DashboardRow extends RowDataPacket {
  manager_id: number;
  manager_name: string;
  manager_level: number;
  manager_exp: number;
  manager_avatar_json: unknown;
  manager_avatar_frame: string | null;
  club_id: number;
  club_name: string;
  city: string;
  stadium_name: string;
  coins: number;
  team_overall: number;
  current_league_code: string;
}

interface ClaimRow extends RowDataPacket {
  id: number;
}

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const [rows] = await pool.query<DashboardRow[]>(
      `
        SELECT
          m.id AS manager_id,
          m.name AS manager_name,
          m.level AS manager_level,
          m.exp AS manager_exp,
          m.avatar_json AS manager_avatar_json,
          m.avatar_frame AS manager_avatar_frame,
          c.id AS club_id,
          c.club_name,
          c.city,
          c.stadium_name,
          c.coins,
          c.team_overall,
          c.current_league_code
        FROM managers m
        LEFT JOIN clubs c ON c.account_id = m.account_id
        WHERE m.account_id = ?
        LIMIT 1
      `,
      [accountId]
    );

    if (!rows.length) {
      throw new HttpError(404, "Manager profile not found");
    }

    const row = rows[0];

    if (!row.club_id) {
      res.status(200).json({
        manager: {
          id: row.manager_id,
          name: row.manager_name,
          level: row.manager_level,
          exp: row.manager_exp,
          avatar: normalizeManagerAvatar(row.manager_avatar_json, row.manager_avatar_frame),
        },
        club: null,
        onboardingComplete: false,
      });
      return;
    }

    const rewardDate = getRewardDateKey();
    const [claimRows] = await pool.query<ClaimRow[]>(
      "SELECT id FROM daily_reward_claims WHERE club_id = ? AND reward_date = ? LIMIT 1",
      [row.club_id, rewardDate]
    );

    res.status(200).json({
      onboardingComplete: true,
      manager: {
        id: row.manager_id,
        name: row.manager_name,
        level: row.manager_level,
        exp: row.manager_exp,
        avatar: normalizeManagerAvatar(row.manager_avatar_json, row.manager_avatar_frame),
      },
      club: {
        id: row.club_id,
        name: row.club_name,
        city: row.city,
        stadiumName: row.stadium_name,
        coins: row.coins,
        teamOverall: Number(row.team_overall),
        league: row.current_league_code,
      },
      dailyReward: {
        coins: 200,
        claimed: claimRows.length > 0,
        nextResetAt: getNextResetIso(),
      },
    });
  })
);
