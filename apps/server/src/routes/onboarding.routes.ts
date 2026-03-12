import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import { computeTeamOverall } from "../../../../packages/game-core/src/formulas";
import type { FormationCode, PlayerCard } from "../../../../packages/game-core/src/types";
import { pool } from "../config/db";
import { readClerkUserId, requireAccountId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { MANAGER_AVATAR_FRAME_COUNT, MANAGER_AVATAR_SPRITE_SHEET, normalizeManagerAvatar, readAvatarFromRequest, serializeManagerAvatar } from "../lib/manager-avatar";
import { generateStarterSquad } from "../lib/starter-squad";
import { ensureCpuLeaguePopulation, ensurePlayerPool } from "../lib/world-seeding";
import { asyncHandler } from "../middleware/async-handler";

export const onboardingRouter = Router();

interface AccountRow extends RowDataPacket {
  id: number;
}

interface ManagerRow extends RowDataPacket {
  id: number;
  name: string;
  level: number;
  exp: number;
  avatar_json?: unknown;
  avatar_frame?: string | null;
}

interface ClubRow extends RowDataPacket {
  id: number;
  club_name: string;
  city: string;
  stadium_name: string;
  coins: number;
  team_overall: number;
  current_league_code: string;
}

interface LeagueTierRow extends RowDataPacket {
  id: number;
  team_count: number;
}

interface ClubLeagueRow extends RowDataPacket {
  current_league_code: string;
}

const DEFAULT_BADGE = {
  shape: "shield",
  primary: "#1e40af",
  secondary: "#f59e0b",
  icon: "star",
};

const DEFAULT_HOME_KIT = {
  shirt: "#2563eb",
  shorts: "#ffffff",
  pattern: "solid",
};

const DEFAULT_AWAY_KIT = {
  shirt: "#dc2626",
  shorts: "#111827",
  pattern: "solid",
};

const MAX_SHIRT_SPRITE_INDEX = 47;

onboardingRouter.post(
  "/manager",
  asyncHandler(async (req, res) => {
    const clerkUserId = readClerkUserId(req);
    const email = readRequiredString(req.body?.email, "email", 255).toLowerCase();
    const managerName = readRequiredString(req.body?.name, "name", 64);
    const age = readOptionalNumber(req.body?.age);
    const gender = readOptionalString(req.body?.gender, 24);
    const avatar = serializeManagerAvatar(req.body?.avatar);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const accountId = await upsertAccount(connection, clerkUserId, email);

      const [managerRows] = await connection.query<ManagerRow[]>(
        "SELECT id, name, level, exp, avatar_json, avatar_frame FROM managers WHERE account_id = ? LIMIT 1",
        [accountId]
      );

      if (managerRows.length) {
        const existingManager = managerRows[0];
        await connection.commit();
        res.status(200).json({
          created: false,
          manager: {
            id: existingManager.id,
            name: existingManager.name,
            level: existingManager.level,
            exp: existingManager.exp,
            avatar: normalizeManagerAvatar(existingManager.avatar_json, existingManager.avatar_frame),
          },
        });
        return;
      }

      const [insertManager] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO managers (account_id, name, age, gender, avatar_json, avatar_frame)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [accountId, managerName, age, gender, avatar.avatarJson, avatar.avatarFrame]
      );

      await connection.execute(
        `
          INSERT INTO formation_unlocks (manager_id, formation_code, unlocked_by)
          VALUES (?, '4-4-2', 'default')
          ON DUPLICATE KEY UPDATE formation_code = formation_code
        `,
        [insertManager.insertId]
      );

      await connection.commit();

      res.status(201).json({
        created: true,
        manager: {
          id: insertManager.insertId,
          name: managerName,
          level: 0,
          exp: 0,
          avatar: avatar.avatar,
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

onboardingRouter.put(
  "/manager/avatar",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const avatar = readAvatarFromRequest(req.body?.avatar);

    if (!avatar) {
      throw new HttpError(
        400,
        `avatar must include spriteSheet '${MANAGER_AVATAR_SPRITE_SHEET}' and frameIndex between 0 and ${
          MANAGER_AVATAR_FRAME_COUNT - 1
        }`
      );
    }

    const serialized = serializeManagerAvatar(avatar);

    const [updateResult] = await pool.execute<ResultSetHeader>(
      "UPDATE managers SET avatar_json = ?, avatar_frame = ? WHERE account_id = ?",
      [serialized.avatarJson, serialized.avatarFrame, accountId]
    );

    if (!updateResult.affectedRows) {
      throw new HttpError(404, "Manager profile not found");
    }

    const [managerRows] = await pool.query<ManagerRow[]>(
      "SELECT id, name, level, exp, avatar_json, avatar_frame FROM managers WHERE account_id = ? LIMIT 1",
      [accountId]
    );

    if (!managerRows.length) {
      throw new HttpError(404, "Manager profile not found");
    }

    const manager = managerRows[0];

    res.status(200).json({
      updated: true,
      manager: {
        id: manager.id,
        name: manager.name,
        level: manager.level,
        exp: manager.exp,
        avatar: normalizeManagerAvatar(manager.avatar_json, manager.avatar_frame),
      },
    });
  })
);

onboardingRouter.put(
  "/club/kits",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const payload = readClubKitUpdatePayload(req.body);

    const [updateResult] = await pool.execute<ResultSetHeader>(
      "UPDATE clubs SET home_kit_json = ?, away_kit_json = ? WHERE account_id = ?",
      [JSON.stringify(payload.homeKit), JSON.stringify(payload.awayKit), accountId]
    );

    if (!updateResult.affectedRows) {
      throw new HttpError(404, "Club profile not found");
    }

    res.status(200).json({
      updated: true,
      homeKit: payload.homeKit,
      awayKit: payload.awayKit,
    });
  })
);

onboardingRouter.post(
  "/club",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const managerId = await getManagerIdForAccount(connection, accountId);

      const [existingClubRows] = await connection.query<ClubRow[]>(
        `
          SELECT id, club_name, city, stadium_name, coins, team_overall, current_league_code
          FROM clubs
          WHERE account_id = ?
          LIMIT 1
        `,
        [accountId]
      );

      if (existingClubRows.length) {
        await connection.commit();
        res.status(200).json({
          created: false,
          club: existingClubRows[0],
          message: "Club already exists for this account",
        });
        return;
      }

      const payload = readClubPayload(req.body);
      const createdClub = await createClubWithStarterSquad(connection, {
        accountId,
        managerId,
        payload,
        coins: 0,
        resetCount: 0,
      });

      await connection.commit();

      res.status(201).json({ created: true, club: createdClub });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

onboardingRouter.post(
  "/reset-club",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const managerId = await getManagerIdForAccount(connection, accountId);
      const [clubRows] = await connection.query<
        (ClubRow & { reset_count: number })[]
      >(
        `
          SELECT id, club_name, city, stadium_name, coins, team_overall, current_league_code, reset_count
          FROM clubs
          WHERE account_id = ?
          LIMIT 1
        `,
        [accountId]
      );

      if (!clubRows.length) {
        throw new HttpError(404, "No existing club found to reset");
      }

      const existingClub = clubRows[0];
      await deleteClubData(connection, existingClub.id);

      const payload = readClubPayload(req.body);
      const createdClub = await createClubWithStarterSquad(connection, {
        accountId,
        managerId,
        payload,
        coins: existingClub.coins,
        resetCount: existingClub.reset_count + 1,
      });

      await connection.commit();

      res.status(201).json({
        reset: true,
        retainedCoins: existingClub.coins,
        club: createdClub,
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

onboardingRouter.post(
  "/bootstrap-world",
  asyncHandler(async (req, res) => {
    const accountId = await requireAccountId(req);
    const scope = readBootstrapScope(req.body?.scope);
    const targetPlayerPoolSize = readOptionalBoundedInt(req.body?.targetPlayerPoolSize, 480, 40, 5000);

    const [clubRows] = await pool.query<ClubLeagueRow[]>(
      "SELECT current_league_code FROM clubs WHERE account_id = ? LIMIT 1",
      [accountId]
    );

    if (!clubRows.length) {
      throw new HttpError(400, "Create your club before running world bootstrap seeding");
    }

    const connection = await pool.getConnection();

    try {
      const leagueCodes = scope === "ALL_LEAGUES" ? undefined : [clubRows[0].current_league_code];
      const cpu = await ensureCpuLeaguePopulation(connection, { leagueCodes });
      const playerPool = await ensurePlayerPool(connection, { targetSize: targetPlayerPoolSize });

      res.status(200).json({
        seeded: true,
        scope,
        cpu,
        playerPool,
      });
    } finally {
      connection.release();
    }
  })
);

async function upsertAccount(connection: PoolConnection, clerkUserId: string, email: string): Promise<number> {
  const [accountRows] = await connection.query<AccountRow[]>(
    "SELECT id FROM accounts WHERE clerk_user_id = ? LIMIT 1",
    [clerkUserId]
  );

  if (accountRows.length) {
    await connection.execute("UPDATE accounts SET email = ? WHERE id = ?", [email, accountRows[0].id]);
    return accountRows[0].id;
  }

  const [insertAccount] = await connection.execute<ResultSetHeader>(
    "INSERT INTO accounts (clerk_user_id, email) VALUES (?, ?)",
    [clerkUserId, email]
  );

  return insertAccount.insertId;
}

async function getManagerIdForAccount(connection: PoolConnection, accountId: number): Promise<number> {
  const [managerRows] = await connection.query<ManagerRow[]>(
    "SELECT id, name, level, exp FROM managers WHERE account_id = ? LIMIT 1",
    [accountId]
  );

  if (!managerRows.length) {
    throw new HttpError(400, "Manager profile must be created before club setup");
  }

  return managerRows[0].id;
}

async function createClubWithStarterSquad(
  connection: PoolConnection,
  options: {
    accountId: number;
    managerId: number;
    payload: ReturnType<typeof readClubPayload>;
    coins: number;
    resetCount: number;
  }
) {
  const [tierRows] = await connection.query<LeagueTierRow[]>(
    "SELECT id, LEAST(team_count, 20) AS team_count FROM league_tiers WHERE code = 'BEGINNER_I' LIMIT 1"
  );

  if (!tierRows.length) {
    throw new HttpError(500, "league_tiers seed is missing BEGINNER_I");
  }

  const [insertClub] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO clubs (
        account_id,
        manager_id,
        is_cpu,
        club_name,
        city,
        stadium_name,
        badge_json,
        home_kit_json,
        away_kit_json,
        coins,
        team_overall,
        current_league_code,
        last_login_at,
        reset_count
      )
      VALUES (?, ?, FALSE, ?, ?, ?, ?, ?, ?, ?, 40, 'BEGINNER_I', NOW(), ?)
    `,
    [
      options.accountId,
      options.managerId,
      options.payload.clubName,
      options.payload.city,
      options.payload.stadiumName,
      JSON.stringify(options.payload.badge),
      JSON.stringify(options.payload.homeKit),
      JSON.stringify(options.payload.awayKit),
      options.coins,
      options.resetCount,
    ]
  );

  const clubId = insertClub.insertId;

  await connection.execute(
    `
      INSERT INTO league_memberships (
        club_id,
        league_tier_id,
        legends_division,
        matches_played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        rank_position
      )
      VALUES (?, ?, NULL, 0, 0, 0, 0, 0, 0, 0, 0, ?)
    `,
    [clubId, tierRows[0].id, tierRows[0].team_count]
  );

  await ensureCpuLeaguePopulation(connection, { leagueCodes: ["BEGINNER_I"] });

  const starterRows = generateStarterSquad(`${clubId}-${Date.now()}`);
  const starterPlayerIds: number[] = [];
  const benchPlayerIds: number[] = [];
  const starterCards: PlayerCard[] = [];

  for (const player of starterRows) {
    const [insertPlayer] = await connection.execute<ResultSetHeader>(
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        clubId,
        player.name,
        player.age,
        player.shirt_number,
        player.position,
        player.rarity,
        player.overall_rating,
        player.level,
        player.exp,
        player.exp_to_next,
        player.pace,
        player.shooting,
        player.passing,
        player.dribbling,
        player.defending,
        player.strength,
        player.goalkeeping,
        player.stamina,
        player.is_starting,
        player.is_bench,
        player.portrait_seed,
      ]
    );

    if (player.is_starting) {
      starterPlayerIds.push(insertPlayer.insertId);
      starterCards.push({
        id: String(insertPlayer.insertId),
        name: player.name,
        position: player.position,
        rarity: "COMMON",
        overall: player.overall_rating,
        level: player.level,
        exp: player.exp,
        stamina: player.stamina,
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
      });
    } else {
      benchPlayerIds.push(insertPlayer.insertId);
    }
  }

  const teamOverall = computeTeamOverall(starterCards);

  await connection.execute(
    "UPDATE clubs SET team_overall = ? WHERE id = ?",
    [teamOverall, clubId]
  );

  await connection.execute(
    `
      INSERT INTO lineups (club_id, formation_code, starting_player_ids, bench_player_ids)
      VALUES (?, ?, ?, ?)
    `,
    [clubId, "4-4-2" satisfies FormationCode, JSON.stringify(starterPlayerIds), JSON.stringify(benchPlayerIds)]
  );

  await connection.execute(
    `
      INSERT INTO formation_unlocks (manager_id, formation_code, unlocked_by)
      VALUES (?, '4-4-2', 'default')
      ON DUPLICATE KEY UPDATE formation_code = formation_code
    `,
    [options.managerId]
  );

  return {
    id: clubId,
    clubName: options.payload.clubName,
    city: options.payload.city,
    stadiumName: options.payload.stadiumName,
    coins: options.coins,
    teamOverall,
    league: "BEGINNER_I",
    squadSize: starterRows.length,
    formation: "4-4-2",
  };
}

async function deleteClubData(connection: PoolConnection, clubId: number): Promise<void> {
  const [packPurchaseRows] = await connection.query<(RowDataPacket & { id: number })[]>(
    "SELECT id FROM pack_purchases WHERE club_id = ?",
    [clubId]
  );

  if (packPurchaseRows.length) {
    const ids = packPurchaseRows.map((row) => row.id);
    await connection.query("DELETE FROM pack_rewards WHERE pack_purchase_id IN (?)", [ids]);
  }

  await connection.query("DELETE FROM pack_purchases WHERE club_id = ?", [clubId]);
  await connection.query("DELETE FROM daily_reward_claims WHERE club_id = ?", [clubId]);
  await connection.query("DELETE FROM promotion_reward_claims WHERE club_id = ?", [clubId]);
  await connection.query("DELETE FROM economy_transactions WHERE club_id = ?", [clubId]);
  await connection.query("DELETE FROM matches WHERE club_id = ? OR opponent_club_id = ?", [clubId, clubId]);
  await connection.query("DELETE FROM lineups WHERE club_id = ?", [clubId]);
  await connection.query("DELETE FROM players WHERE club_id = ?", [clubId]);
  await connection.query("DELETE FROM league_memberships WHERE club_id = ?", [clubId]);
  await connection.query("DELETE FROM clubs WHERE id = ?", [clubId]);
}

function readClubPayload(body: unknown) {
  const input = (body || {}) as Record<string, unknown>;

  const homeKit = input.homeKit && typeof input.homeKit === "object" ? input.homeKit : DEFAULT_HOME_KIT;
  const awayKit = input.awayKit && typeof input.awayKit === "object" ? input.awayKit : DEFAULT_AWAY_KIT;
  const homeShirt = normalizeHexColor((homeKit as Record<string, unknown>).shirt);
  const awayShirt = normalizeHexColor((awayKit as Record<string, unknown>).shirt);
  if (homeShirt && awayShirt && homeShirt === awayShirt) {
    throw new HttpError(400, "homeKit.shirt and awayKit.shirt must be different colours");
  }

  return {
    clubName: readRequiredString(input.clubName, "clubName", 64),
    city: readRequiredString(input.city, "city", 64),
    stadiumName: readRequiredString(input.stadiumName, "stadiumName", 64),
    badge: input.badge && typeof input.badge === "object" ? input.badge : DEFAULT_BADGE,
    homeKit,
    awayKit,
  };
}

function readClubKitUpdatePayload(body: unknown): {
  homeKit: Record<string, unknown>;
  awayKit: Record<string, unknown>;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "body must be an object");
  }

  const input = body as Record<string, unknown>;
  const homeKit = normalizeKitPayload(input.homeKit, "homeKit");
  const awayKit = normalizeKitPayload(input.awayKit, "awayKit");
  const homeShirt = normalizeHexColor(homeKit.shirt);
  const awayShirt = normalizeHexColor(awayKit.shirt);

  if (homeShirt && awayShirt && homeShirt === awayShirt) {
    throw new HttpError(400, "homeKit.shirt and awayKit.shirt must be different colours");
  }

  return { homeKit, awayKit };
}

function normalizeKitPayload(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an object`);
  }

  const input = value as Record<string, unknown>;
  const shirt = normalizeHexColor(input.shirt);
  if (!shirt) {
    throw new HttpError(400, `${field}.shirt must be a hex color (#RRGGBB)`);
  }

  const shorts = normalizeHexColor(input.shorts) ?? "#ffffff";
  const pattern = readOptionalPattern(input.pattern) ?? "solid";
  const normalized: Record<string, unknown> = {
    shirt,
    shorts,
    pattern,
  };

  const spriteIndex = readOptionalSpriteIndex(input.shirtSpriteIndex, `${field}.shirtSpriteIndex`);
  if (spriteIndex !== null) {
    normalized.shirtSpriteIndex = spriteIndex;
  }

  const colorGroup = readOptionalString(input.colorGroup, 24);
  if (colorGroup) {
    normalized.colorGroup = colorGroup.toLowerCase();
  }

  return normalized;
}

function readOptionalPattern(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 24 ? trimmed.slice(0, 24) : trimmed;
}

function readOptionalSpriteIndex(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_SHIRT_SPRITE_INDEX) {
    throw new HttpError(400, `${field} must be an integer between 0 and ${MAX_SHIRT_SPRITE_INDEX}`);
  }

  return parsed;
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }

  return null;
}

function readRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new HttpError(400, `${field} cannot be empty`);
  }

  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} exceeds ${maxLength} characters`);
  }

  return trimmed;
}

function readOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function readOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 100) return null;
  return parsed;
}

function readBootstrapScope(value: unknown): "CURRENT_LEAGUE" | "ALL_LEAGUES" {
  if (value === undefined || value === null || value === "") {
    return "CURRENT_LEAGUE";
  }

  if (value === "CURRENT_LEAGUE" || value === "ALL_LEAGUES") {
    return value;
  }

  throw new HttpError(400, "scope must be CURRENT_LEAGUE or ALL_LEAGUES");
}

function readOptionalBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new HttpError(400, `Expected integer between ${min} and ${max}`);
  }

  const integer = Math.round(parsed);
  if (integer < min || integer > max) {
    throw new HttpError(400, `Expected integer between ${min} and ${max}`);
  }

  return integer;
}
