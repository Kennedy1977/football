import { Router } from "express";
import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db";
import { requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { ensureCpuLeaguePopulation } from "../lib/world-seeding";
import { asyncHandler } from "../middleware/async-handler";

export const leagueRouter = Router();
const LEAGUE_TARGET_TEAM_COUNT = 20;

interface MembershipRow extends RowDataPacket {
  club_id: number;
  league_tier_id: number;
  league_code: string;
  legends_division: number | null;
  team_count: number;
}

interface TableRow extends RowDataPacket {
  club_id: number;
  club_name: string;
  matches_played: number;
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
          lm.legends_division,
          LEAST(lt.team_count, ?) AS team_count
        FROM league_memberships lm
        INNER JOIN clubs c ON c.id = lm.club_id
        INNER JOIN league_tiers lt ON lt.id = lm.league_tier_id
        WHERE c.account_id = ?
        LIMIT 1
      `,
      [LEAGUE_TARGET_TEAM_COUNT, accountId]
    );

    if (!membershipRows.length) {
      throw new HttpError(404, "League membership not found for current account");
    }

    const membership = membershipRows[0];
    await ensureLeaguePopulationForCode(membership.league_code);

    const [tableRows] = await pool.query<TableRow[]>(
      `
        SELECT
          lm.club_id,
          c.club_name,
          lm.matches_played,
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

    const activeRows = selectActiveLeagueRows(tableRows, membership.team_count, membership.club_id);
    const ranked = activeRows.map((row, index) => ({
      rank: index + 1,
      clubId: row.club_id,
      clubName: row.club_name,
      matchesPlayed: row.matches_played,
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

    res.status(200).json({
      league: membership.league_code,
      userRank: ranked[userIndex].rank,
      legendsDivision: membership.legends_division,
      table: ranked,
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
          lm.legends_division,
          LEAST(lt.team_count, ?) AS team_count
        FROM league_memberships lm
        INNER JOIN clubs c ON c.id = lm.club_id
        INNER JOIN league_tiers lt ON lt.id = lm.league_tier_id
        WHERE c.account_id = ?
        LIMIT 1
      `,
      [LEAGUE_TARGET_TEAM_COUNT, accountId]
    );

    if (!membershipRows.length) {
      throw new HttpError(404, "League membership not found for current account");
    }

    const membership = membershipRows[0];
    await ensureLeaguePopulationForCode(membership.league_code);

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

    const activeRows = selectActiveLeagueRows(tableRows, membership.team_count, membership.club_id);
    const ranked = activeRows.map((row, index) => ({
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

function selectActiveLeagueRows<T extends { club_id: number; points: number; goal_difference: number; goals_for: number }>(
  rows: T[],
  requestedTeamCount: number,
  includeClubId?: number
): T[] {
  const teamCount = clampInt(requestedTeamCount, 2, LEAGUE_TARGET_TEAM_COUNT);
  const sorted = [...rows].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.club_id - b.club_id;
  });

  if (sorted.length <= teamCount) {
    return sorted;
  }

  const active = sorted.slice(0, teamCount);
  if (includeClubId === undefined || active.some((row) => row.club_id === includeClubId)) {
    return active;
  }

  const includeRow = sorted.find((row) => row.club_id === includeClubId);
  if (!includeRow) {
    return active;
  }

  const replaced = [...active.slice(0, teamCount - 1), includeRow];
  return replaced.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.club_id - b.club_id;
  });
}

function clampInt(value: number, min: number, max: number): number {
  const numeric = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

async function ensureLeaguePopulationForCode(leagueCode: string): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await ensureCpuLeaguePopulation(connection, { leagueCodes: [leagueCode] });
  } finally {
    connection.release();
  }
}
