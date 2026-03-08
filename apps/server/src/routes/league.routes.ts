import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db";
import { requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../middleware/async-handler";

export const leagueRouter = Router();

interface MembershipRow extends RowDataPacket {
  club_id: number;
  league_tier_id: number;
  league_code: string;
  legends_division: number | null;
}

interface TableRow extends RowDataPacket {
  club_id: number;
  club_name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goal_difference: number;
  goals_for: number;
}

leagueRouter.get(
  "/table",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const [membershipRows] = await pool.query<MembershipRow[]>(
      `
        SELECT
          lm.club_id,
          lm.league_tier_id,
          c.current_league_code AS league_code,
          lm.legends_division
        FROM league_memberships lm
        INNER JOIN clubs c ON c.id = lm.club_id
        WHERE c.account_id = ?
        LIMIT 1
      `,
      [accountId]
    );

    if (!membershipRows.length) {
      throw new HttpError(404, "League membership not found for current account");
    }

    const membership = membershipRows[0];

    const [tableRows] = await pool.query<TableRow[]>(
      `
        SELECT
          lm.club_id,
          c.club_name,
          lm.points,
          lm.wins,
          lm.draws,
          lm.losses,
          lm.goal_difference,
          lm.goals_for
        FROM league_memberships lm
        INNER JOIN clubs c ON c.id = lm.club_id
        WHERE lm.league_tier_id = ?
        ORDER BY lm.points DESC, lm.goal_difference DESC, lm.goals_for DESC, lm.club_id ASC
      `,
      [membership.league_tier_id]
    );

    const ranked = tableRows.map((row, index) => ({
      rank: index + 1,
      clubId: row.club_id,
      clubName: row.club_name,
      points: row.points,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      goalDifference: row.goal_difference,
      goalsFor: row.goals_for,
      movement: "-",
    }));

    const userIndex = ranked.findIndex((row) => row.clubId === membership.club_id);

    if (userIndex === -1) {
      throw new HttpError(500, "Current club is missing from league table");
    }

    const start = Math.max(0, userIndex - 4);
    const slice = ranked.slice(start, start + 9);

    res.status(200).json({
      league: membership.league_code,
      userRank: ranked[userIndex].rank,
      legendsDivision: membership.legends_division,
      table: slice,
    });
  })
);

leagueRouter.get(
  "/legends",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const [membershipRows] = await pool.query<MembershipRow[]>(
      `
        SELECT
          lm.club_id,
          lm.league_tier_id,
          c.current_league_code AS league_code,
          lm.legends_division
        FROM league_memberships lm
        INNER JOIN clubs c ON c.id = lm.club_id
        WHERE c.account_id = ?
        LIMIT 1
      `,
      [accountId]
    );

    if (!membershipRows.length) {
      throw new HttpError(404, "League membership not found for current account");
    }

    const membership = membershipRows[0];

    if (membership.league_code !== "LEGENDS") {
      throw new HttpError(400, "Club is not currently in Legends");
    }

    const [tableRows] = await pool.query<TableRow[]>(
      `
        SELECT
          lm.club_id,
          c.club_name,
          lm.points,
          lm.wins,
          lm.draws,
          lm.losses,
          lm.goal_difference,
          lm.goals_for
        FROM league_memberships lm
        INNER JOIN clubs c ON c.id = lm.club_id
        WHERE lm.league_tier_id = ?
        ORDER BY
          lm.points DESC,
          (CASE WHEN (lm.wins + lm.draws + lm.losses) = 0 THEN 0 ELSE (lm.wins + (lm.draws * 0.5)) / (lm.wins + lm.draws + lm.losses) END) DESC,
          lm.goal_difference DESC,
          lm.goals_for DESC,
          lm.club_id ASC
      `,
      [membership.league_tier_id]
    );

    const ranked = tableRows.map((row, index) => ({
      rank: index + 1,
      clubId: row.club_id,
      clubName: row.club_name,
      points: row.points,
      record: `${row.wins}/${row.draws}/${row.losses}`,
      goalDifference: row.goal_difference,
      goalsFor: row.goals_for,
    }));

    const userIndex = ranked.findIndex((row) => row.clubId === membership.club_id);
    if (userIndex === -1) {
      throw new HttpError(500, "Current club is missing from Legends table");
    }

    const start = Math.max(0, userIndex - 4);

    res.status(200).json({
      league: "LEGENDS",
      division: membership.legends_division ?? 1,
      userRank: ranked[userIndex].rank,
      nearby: ranked.slice(start, start + 9),
    });
  })
);
