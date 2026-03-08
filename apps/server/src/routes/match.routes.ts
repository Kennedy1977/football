import crypto from "node:crypto";
import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import {
  LEAGUE_PROMOTION_THRESHOLDS,
  MATCH_DURATION_SECONDS,
  MAX_TOTAL_GOALS,
} from "../../../../packages/game-core/src/constants";
import {
  applyPlayerExp,
  applyStaminaAfterMatch,
  computeTeamOverall,
  deriveArcadeRatingsFromOverall,
  deriveArcadeTeamRatings,
  getLeaguePoints,
  getManagerExpGain,
  getMatchCoinReward,
  getStarterExpGain,
  recoverStaminaSkippedMatch,
} from "../../../../packages/game-core/src/formulas";
import type { LeagueCode, MatchEndReason, MatchResult, PlayerCard } from "../../../../packages/game-core/src/types";
import { pool } from "../config/db";
import { requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../middleware/async-handler";

export const matchRouter = Router();

interface MatchContextRow extends RowDataPacket {
  club_id: number;
  manager_id: number;
  team_overall: number;
  current_league_code: LeagueCode;
  league_tier_id: number;
  league_points: number;
  manager_total_wins: number;
}

interface RankedClubRow extends RowDataPacket {
  club_id: number;
  club_name: string;
  team_overall: number;
  points: number;
  goal_difference: number;
  goals_for: number;
}

interface StartingPlayerRow extends RowDataPacket {
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
  is_starting: number;
}

interface OpponentMembershipRow extends RowDataPacket {
  league_tier_id: number;
}

matchRouter.post(
  "/start",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const context = await getMatchContext(accountId);

    const [lineupRows] = await pool.query<StartingPlayerRow[]>(
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
          goalkeeping,
          is_starting
        FROM players
        WHERE club_id = ? AND is_starting = TRUE
      `,
      [context.club_id]
    );

    validateStartingLineup(lineupRows);
    const yourArcadeRatings = deriveArcadeTeamRatings(
      lineupRows.map((player) => toPlayerCard(player)),
      Number(context.team_overall)
    );

    const [rankedRows] = await pool.query<RankedClubRow[]>(
      `
        SELECT
          c.id AS club_id,
          c.club_name,
          c.team_overall,
          lm.points,
          lm.goal_difference,
          lm.goals_for
        FROM league_memberships lm
        INNER JOIN clubs c ON c.id = lm.club_id
        WHERE lm.league_tier_id = ?
        ORDER BY lm.points DESC, lm.goal_difference DESC, lm.goals_for DESC, lm.club_id ASC
      `,
      [context.league_tier_id]
    );

    const userRank = rankedRows.findIndex((row) => row.club_id === context.club_id) + 1;
    if (userRank === 0) {
      throw new HttpError(500, "Current club is missing from league ranking");
    }

    const minAllowedRank = Math.max(1, userRank - 8);
    const candidates = rankedRows
      .map((row, idx) => ({ row, rank: idx + 1 }))
      .filter(({ row, rank }) => row.club_id !== context.club_id && rank >= minAllowedRank);

    if (!candidates.length) {
      throw new HttpError(400, "No eligible opponents found in current league");
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const [opponentStarterRows] = await pool.query<StartingPlayerRow[]>(
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
          goalkeeping,
          is_starting
        FROM players
        WHERE club_id = ? AND is_starting = TRUE
      `,
      [picked.row.club_id]
    );
    const opponentArcadeRatings = isValidStartingLineup(opponentStarterRows)
      ? deriveArcadeTeamRatings(
          opponentStarterRows.map((player) => toPlayerCard(player)),
          Number(picked.row.team_overall)
        )
      : deriveArcadeRatingsFromOverall(Number(picked.row.team_overall));

    const matchSeed = crypto.randomUUID();

    res.status(200).json({
      matchSeed,
      rules: {
        maxDurationSeconds: MATCH_DURATION_SECONDS,
        maxTotalGoals: MAX_TOTAL_GOALS,
        earlyFinishGoalLead: 3,
      },
      yourClub: {
        clubId: context.club_id,
        teamOverall: Number(context.team_overall),
        rank: userRank,
        arcadeRatings: yourArcadeRatings,
      },
      opponent: {
        clubId: picked.row.club_id,
        name: picked.row.club_name,
        teamOverall: Number(picked.row.team_overall),
        rank: picked.rank,
        arcadeRatings: opponentArcadeRatings,
      },
    });
  })
);

matchRouter.post(
  "/submit",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const context = await getMatchContext(accountId);

    const matchSeed = readString(req.body?.matchSeed, "matchSeed", 128);
    const opponentClubId = readOptionalPositiveInt(req.body?.opponentClubId);
    const clubGoals = readBoundedInt(req.body?.clubGoals, "clubGoals", 0, 10);
    const opponentGoals = readBoundedInt(req.body?.opponentGoals, "opponentGoals", 0, 10);
    const durationSeconds = readBoundedInt(
      req.body?.durationSeconds,
      "durationSeconds",
      1,
      MATCH_DURATION_SECONDS
    );
    const endReason = readEndReason(req.body?.endReason);
    const simulationPayload = req.body?.simulationPayload ?? null;

    validateMatchInvariants({ clubGoals, opponentGoals, durationSeconds, endReason });

    const result: MatchResult = clubGoals > opponentGoals ? "WIN" : clubGoals < opponentGoals ? "LOSS" : "DRAW";
    const pointsAwarded = getLeaguePoints(result);
    const coinReward = getMatchCoinReward(result, clubGoals);
    const managerExpGain = getManagerExpGain(result);
    const starterExpGain = getStarterExpGain(result);

    if (opponentClubId) {
      const [opponentRows] = await pool.query<OpponentMembershipRow[]>(
        "SELECT league_tier_id FROM league_memberships WHERE club_id = ? LIMIT 1",
        [opponentClubId]
      );

      if (!opponentRows.length || opponentRows[0].league_tier_id !== context.league_tier_id) {
        throw new HttpError(400, "Submitted opponent is not in the same league tier");
      }
    }

    const [allPlayers] = await pool.query<StartingPlayerRow[]>(
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
          goalkeeping,
          is_starting
        FROM players
        WHERE club_id = ?
      `,
      [context.club_id]
    );

    const startingPlayers = allPlayers.filter((player) => Boolean(player.is_starting));
    validateStartingLineup(startingPlayers);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO matches (
            club_id,
            opponent_club_id,
            league_tier_id,
            result,
            club_goals,
            opponent_goals,
            ended_reason,
            duration_seconds,
            points_awarded,
            coin_reward,
            manager_exp_gain,
            starter_exp_gain,
            stamina_loss_pct,
            simulation_seed,
            simulation_payload
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          context.club_id,
          opponentClubId,
          context.league_tier_id,
          result,
          clubGoals,
          opponentGoals,
          endReason,
          durationSeconds,
          pointsAwarded,
          coinReward,
          managerExpGain,
          starterExpGain,
          32.5,
          matchSeed,
          JSON.stringify(simulationPayload),
        ]
      );

      for (const player of allPlayers) {
        if (player.is_starting) {
          const updated = applyPlayerExp(toPlayerCard(player), starterExpGain);
          const nextStamina = applyStaminaAfterMatch(Number(player.stamina));

          await connection.execute<ResultSetHeader>(
            `
              UPDATE players
              SET overall_rating = ?, level = ?, exp = ?, stamina = ?
              WHERE id = ?
            `,
            [updated.overall, updated.level, updated.exp, nextStamina, player.id]
          );
        } else {
          const nextStamina = recoverStaminaSkippedMatch(Number(player.stamina));
          await connection.execute<ResultSetHeader>(
            "UPDATE players SET stamina = ? WHERE id = ?",
            [nextStamina, player.id]
          );
        }
      }

      await connection.execute<ResultSetHeader>(
        `
          UPDATE league_memberships
          SET
            matches_played = matches_played + 1,
            wins = wins + ?,
            draws = draws + ?,
            losses = losses + ?,
            goals_for = goals_for + ?,
            goals_against = goals_against + ?,
            goal_difference = goal_difference + ?,
            points = points + ?
          WHERE club_id = ?
        `,
        [
          result === "WIN" ? 1 : 0,
          result === "DRAW" ? 1 : 0,
          result === "LOSS" ? 1 : 0,
          clubGoals,
          opponentGoals,
          clubGoals - opponentGoals,
          pointsAwarded,
          context.club_id,
        ]
      );

      await connection.execute<ResultSetHeader>(
        "UPDATE managers SET exp = exp + ?, total_wins = total_wins + ? WHERE id = ?",
        [managerExpGain, result === "WIN" ? 1 : 0, context.manager_id]
      );

      const projectedWins = context.manager_total_wins + (result === "WIN" ? 1 : 0);
      if (projectedWins >= 3) {
        await unlockFormation(connection, context.manager_id, "4-3-3");
      }
      if (projectedWins >= 5) {
        await unlockFormation(connection, context.manager_id, "4-5-1");
      }

      const [updatedStarters] = await connection.query<StartingPlayerRow[]>(
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
            goalkeeping,
            is_starting
          FROM players
          WHERE club_id = ? AND is_starting = TRUE
        `,
        [context.club_id]
      );

      const updatedTeamOverall = computeTeamOverall(updatedStarters.map((player) => toPlayerCard(player)));

      await connection.execute<ResultSetHeader>(
        "UPDATE clubs SET coins = coins + ?, team_overall = ? WHERE id = ?",
        [coinReward, updatedTeamOverall, context.club_id]
      );

      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO economy_transactions (club_id, source_type, direction, amount, metadata_json)
          VALUES (?, 'MATCH', 'IN', ?, ?)
        `,
        [
          context.club_id,
          coinReward,
          JSON.stringify({
            result,
            clubGoals,
            opponentGoals,
            pointsAwarded,
            matchSeed,
          }),
        ]
      );

      await connection.commit();

      const newPoints = context.league_points + pointsAwarded;
      const threshold = LEAGUE_PROMOTION_THRESHOLDS[context.current_league_code];
      const promotionEligible = typeof threshold === "number" ? newPoints >= threshold : false;

      res.status(200).json({
        accepted: true,
        result,
        goals: {
          club: clubGoals,
          opponent: opponentGoals,
        },
        rewards: {
          coins: coinReward,
          managerExp: managerExpGain,
          starterExp: starterExpGain,
          points: pointsAwarded,
        },
        teamOverall: updatedTeamOverall,
        promotionEligible,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

async function getMatchContext(accountId: number): Promise<MatchContextRow> {
  const [rows] = await pool.query<MatchContextRow[]>(
    `
      SELECT
        c.id AS club_id,
        c.manager_id,
        c.team_overall,
        c.current_league_code,
        lm.league_tier_id,
        lm.points AS league_points,
        m.total_wins AS manager_total_wins
      FROM clubs c
      INNER JOIN league_memberships lm ON lm.club_id = c.id
      INNER JOIN managers m ON m.id = c.manager_id
      WHERE c.account_id = ?
      LIMIT 1
    `,
    [accountId]
  );

  if (!rows.length) {
    throw new HttpError(404, "Club and league context not found for current account");
  }

  return rows[0];
}

function validateStartingLineup(players: StartingPlayerRow[]): void {
  if (players.length !== 11) {
    throw new HttpError(400, "Starting lineup must contain exactly 11 players");
  }

  if (players.filter((player) => player.position === "GK").length < 1) {
    throw new HttpError(400, "Starting lineup must include a goalkeeper");
  }

  if (players.some((player) => Number(player.stamina) <= 0)) {
    throw new HttpError(400, "Starting lineup contains unavailable players with red stamina");
  }
}

function isValidStartingLineup(players: StartingPlayerRow[]): boolean {
  return (
    players.length === 11 &&
    players.filter((player) => player.position === "GK").length >= 1 &&
    !players.some((player) => Number(player.stamina) <= 0)
  );
}

function validateMatchInvariants(input: {
  clubGoals: number;
  opponentGoals: number;
  durationSeconds: number;
  endReason: MatchEndReason;
}): void {
  const totalGoals = input.clubGoals + input.opponentGoals;
  const lead = Math.abs(input.clubGoals - input.opponentGoals);

  if (totalGoals > MAX_TOTAL_GOALS) {
    throw new HttpError(400, "Total goals exceeds v1 maximum");
  }

  if (input.durationSeconds > MATCH_DURATION_SECONDS) {
    throw new HttpError(400, "Duration exceeds v1 match limit");
  }

  if (totalGoals === MAX_TOTAL_GOALS && lead >= 3) {
    throw new HttpError(400, "Invalid scoreline: match should have ended earlier on 3-goal lead");
  }

  if (totalGoals === MAX_TOTAL_GOALS && lead < 3 && input.endReason !== "TEN_TOTAL_GOALS") {
    throw new HttpError(400, "endReason must be TEN_TOTAL_GOALS when max goals cap is reached");
  }

  if (lead >= 3 && totalGoals < MAX_TOTAL_GOALS && input.endReason !== "THREE_GOAL_LEAD") {
    throw new HttpError(400, "endReason must be THREE_GOAL_LEAD when a 3-goal lead occurs");
  }

  if (lead < 3 && totalGoals < MAX_TOTAL_GOALS && input.endReason !== "TIMER_EXPIRED") {
    throw new HttpError(400, "endReason must be TIMER_EXPIRED when no early stop condition happened");
  }

  if (input.endReason === "TIMER_EXPIRED" && input.durationSeconds !== MATCH_DURATION_SECONDS) {
    throw new HttpError(400, "Timer-expired matches must report full 3-minute duration");
  }
}

function toPlayerCard(player: StartingPlayerRow): PlayerCard {
  return {
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
  };
}

function readString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new HttpError(400, `${field} cannot be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} exceeds ${maxLength} chars`);
  }

  return trimmed;
}

function readOptionalPositiveInt(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, "opponentClubId must be a positive integer when provided");
  }
  return parsed;
}

function readBoundedInt(value: unknown, field: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new HttpError(400, `${field} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

function readEndReason(value: unknown): MatchEndReason {
  if (value !== "THREE_GOAL_LEAD" && value !== "TEN_TOTAL_GOALS" && value !== "TIMER_EXPIRED") {
    throw new HttpError(400, "Invalid endReason");
  }
  return value;
}

async function unlockFormation(
  connection: PoolConnection,
  managerId: number,
  formationCode: "4-3-3" | "4-5-1"
): Promise<void> {
  await connection.execute(
    `
      INSERT INTO formation_unlocks (manager_id, formation_code, unlocked_by)
      VALUES (?, ?, 'wins')
      ON DUPLICATE KEY UPDATE formation_code = formation_code
    `,
    [managerId, formationCode]
  );
}
