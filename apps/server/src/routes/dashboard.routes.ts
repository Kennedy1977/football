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
  home_kit_json: unknown;
  away_kit_json: unknown;
  coins: number;
  team_overall: number;
  current_league_code: string;
}

interface ClaimRow extends RowDataPacket {
  id: number;
}

interface CountRow extends RowDataPacket {
  total: number;
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
          c.home_kit_json,
          c.away_kit_json,
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
        notifications: {
          unreadCount: 0,
          items: [],
        },
      });
      return;
    }

    const rewardDate = getRewardDateKey();
    const [claimRows] = await pool.query<ClaimRow[]>(
      "SELECT id FROM daily_reward_claims WHERE club_id = ? AND reward_date = ? LIMIT 1",
      [row.club_id, rewardDate]
    );

    const dailyClaimed = claimRows.length > 0;
    const [pendingPackRows] = await pool.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM pack_rewards pr
        INNER JOIN pack_purchases pp ON pp.id = pr.pack_purchase_id
        WHERE pp.club_id = ? AND pr.resolved_at IS NULL
      `,
      [row.club_id]
    );
    const [freePackRows] = await pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM pack_catalogue WHERE is_active = TRUE AND price_coins = 0"
    );
    const pendingPackRewards = Number(pendingPackRows[0]?.total || 0);
    const freePacksAvailable = Number(freePackRows[0]?.total || 0);
    const notifications = buildNotifications({
      dailyClaimed,
      freePacksAvailable,
      pendingPackRewards,
    });

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
        homeKit: parseUnknownJsonObject(row.home_kit_json),
        awayKit: parseUnknownJsonObject(row.away_kit_json),
        coins: row.coins,
        teamOverall: Number(row.team_overall),
        league: row.current_league_code,
      },
      dailyReward: {
        coins: 200,
        claimed: dailyClaimed,
        nextResetAt: getNextResetIso(),
      },
      notifications,
    });
  })
);

function buildNotifications(values: {
  dailyClaimed: boolean;
  freePacksAvailable: number;
  pendingPackRewards: number;
}) {
  const items: Array<{
    id: string;
    type: "DAILY_REWARD" | "FREE_PACKS" | "UNOPENED_PACKS";
    title: string;
    detail: string;
    href: string;
    count?: number;
  }> = [];

  if (!values.dailyClaimed) {
    items.push({
      id: "daily-reward",
      type: "DAILY_REWARD",
      title: "Daily reward ready",
      detail: "Collect your daily coins.",
      href: "/home",
    });
  }

  if (values.freePacksAvailable > 0) {
    items.push({
      id: "free-packs",
      type: "FREE_PACKS",
      title: "Free chests available",
      detail: `${values.freePacksAvailable} free chest${values.freePacksAvailable === 1 ? "" : "s"} ready to open.`,
      href: "/shop?tab=chests",
      count: values.freePacksAvailable,
    });
  }

  if (values.pendingPackRewards > 0) {
    items.push({
      id: "unopened-packs",
      type: "UNOPENED_PACKS",
      title: "Unfinished chest rewards",
      detail: `${values.pendingPackRewards} reward${values.pendingPackRewards === 1 ? "" : "s"} still need a decision.`,
      href: "/shop?tab=pending",
      count: values.pendingPackRewards,
    });
  }

  return {
    unreadCount: items.length,
    items,
  };
}

function parseUnknownJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}
