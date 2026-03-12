import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import {
  RARITY_CAPS,
  computeTeamOverall,
  generatePackPlayer,
  type PlayerCard,
  type Position,
  type Rarity,
} from "../../../../packages/game-core/src";
import { generateStarterSquad, type StarterPlayerRow } from "./starter-squad";

interface LeagueTierSeedRow extends RowDataPacket {
  id: number;
  code: string;
  display_name: string;
  sort_order: number;
  team_count: number;
  is_legends: number;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface IdRow extends RowDataPacket {
  id: number;
}

interface MembershipRow extends RowDataPacket {
  id: number;
  league_tier_id: number;
}

interface ClubIdRow extends RowDataPacket {
  id: number;
}

type SeededPlayerRow = Omit<StarterPlayerRow, "rarity"> & {
  rarity: Rarity;
};

type StatField = "pace" | "shooting" | "passing" | "dribbling" | "defending" | "strength" | "goalkeeping";
const LEAGUE_TARGET_TEAM_COUNT = 20;

export interface CpuLeagueSeedSummary {
  leagueCode: string;
  leagueName: string;
  targetTeams: number;
  existingTeams: number;
  createdCpuTeams: number;
}

export interface PlayerPoolSeedSummary {
  targetSize: number;
  added: number;
  total: number;
}

const CPU_CITY_NAMES = [
  "Ashford",
  "Riverton",
  "Lakeside",
  "Northgate",
  "Kingsport",
  "Westbridge",
  "Redhaven",
  "Pinehurst",
  "Stonefield",
  "Cedar Vale",
  "Eastborough",
  "Summerton",
  "Ironwick",
  "Millford",
  "Brighton Park",
  "Lowell",
  "Fairmont",
  "Brookfield",
];

const CPU_CLUB_SUFFIXES = [
  "United",
  "Rovers",
  "Athletic",
  "City",
  "FC",
  "Sporting",
  "Wanderers",
  "Dynamos",
  "Albion",
  "Stars",
];

const CPU_MANAGER_FIRST = [
  "Alex",
  "Riley",
  "Jordan",
  "Casey",
  "Avery",
  "Morgan",
  "Drew",
  "Sam",
  "Quinn",
  "Taylor",
];

const CPU_MANAGER_LAST = ["Hayes", "Nolan", "Parker", "Reed", "Diaz", "Silva", "Walker", "Cole", "Bennett", "Mason"];
const CPU_FORMATIONS = ["4-4-2", "4-3-3", "4-5-1", "4-2-3-1", "3-5-2", "5-3-2", "4-2-4"] as const;

const PACK_POOL_PROFILES: Array<{ packPrice: number; odds: Record<string, number>; baselineOverall: number }> = [
  { packPrice: 250, odds: { common: 0.82, rare: 0.17, epic: 0.01, legendary: 0 }, baselineOverall: 42 },
  { packPrice: 500, odds: { common: 0.67, rare: 0.27, epic: 0.05, legendary: 0.01 }, baselineOverall: 48 },
  { packPrice: 1000, odds: { common: 0.5, rare: 0.36, epic: 0.12, legendary: 0.02 }, baselineOverall: 56 },
  { packPrice: 2500, odds: { common: 0.3, rare: 0.44, epic: 0.22, legendary: 0.04 }, baselineOverall: 64 },
  { packPrice: 5000, odds: { common: 0.16, rare: 0.39, epic: 0.35, legendary: 0.1 }, baselineOverall: 72 },
  { packPrice: 10000, odds: { common: 0.07, rare: 0.28, epic: 0.41, legendary: 0.24 }, baselineOverall: 80 },
];

const POSITION_STAT_WEIGHTS: Record<Position, Record<StatField, number>> = {
  GK: {
    pace: 0.2,
    shooting: 0.07,
    passing: 0.26,
    dribbling: 0.14,
    defending: 0.25,
    strength: 0.22,
    goalkeeping: 0.66,
  },
  DEF: {
    pace: 0.24,
    shooting: 0.1,
    passing: 0.18,
    dribbling: 0.15,
    defending: 0.56,
    strength: 0.44,
    goalkeeping: 0.04,
  },
  MID: {
    pace: 0.3,
    shooting: 0.22,
    passing: 0.46,
    dribbling: 0.44,
    defending: 0.24,
    strength: 0.2,
    goalkeeping: 0.03,
  },
  ATT: {
    pace: 0.38,
    shooting: 0.52,
    passing: 0.24,
    dribbling: 0.48,
    defending: 0.1,
    strength: 0.28,
    goalkeeping: 0.02,
  },
};

const PLAYER_INSERT_SQL = `
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
`;

export async function ensureCpuLeaguePopulation(
  connection: PoolConnection,
  options: {
    leagueCodes?: string[];
  } = {}
): Promise<CpuLeagueSeedSummary[]> {
  const leagueTiers = await readLeagueTiers(connection, options.leagueCodes);
  const summaries: CpuLeagueSeedSummary[] = [];

  for (const tier of leagueTiers) {
    const [countRows] = await connection.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM league_memberships WHERE league_tier_id = ?",
      [tier.id]
    );
    const existingTeams = Number(countRows[0]?.total ?? 0);
    const targetTeams = clampInt(Number(tier.team_count), 2, LEAGUE_TARGET_TEAM_COUNT);
    const missingTeams = Math.max(0, targetTeams - existingTeams);

    let createdCpuTeams = 0;

    for (let offset = 0; offset < missingTeams; offset += 1) {
      const slot = existingTeams + offset + 1;
      const created = await ensureCpuClubForSlot(connection, tier, slot);
      if (created) {
        createdCpuTeams += 1;
      }
    }

    summaries.push({
      leagueCode: tier.code,
      leagueName: tier.display_name,
      targetTeams,
      existingTeams,
      createdCpuTeams,
    });
  }

  return summaries;
}

export async function ensurePlayerPool(
  connection: PoolConnection,
  options: {
    targetSize?: number;
  } = {}
): Promise<PlayerPoolSeedSummary> {
  const targetSize = clampInt(options.targetSize ?? 480, 40, 5000);
  await ensurePlayerPoolTable(connection);

  const [countRows] = await connection.query<CountRow[]>("SELECT COUNT(*) AS total FROM player_pool");
  const existingTotal = Number(countRows[0]?.total ?? 0);
  const missing = Math.max(0, targetSize - existingTotal);

  let added = 0;
  let cursor = existingTotal + 1;

  while (added < missing) {
    const profile = PACK_POOL_PROFILES[(cursor - 1) % PACK_POOL_PROFILES.length];
    const generated = generatePackPlayer({
      seed: `player-pool-${cursor}`,
      packPrice: profile.packPrice,
      odds: profile.odds,
      squad: [],
      currentTeamOverall: clamp(profile.baselineOverall + Math.floor((cursor - 1) / 42), 38, 88),
    });

    const [insert] = await connection.execute<ResultSetHeader>(
      `
        INSERT IGNORE INTO player_pool (
          pool_key,
          source_type,
          name,
          age,
          position,
          rarity,
          overall_rating,
          pace,
          shooting,
          passing,
          dribbling,
          defending,
          strength,
          goalkeeping
        )
        VALUES (?, 'PACK_TEMPLATE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        `pool-${String(cursor).padStart(5, "0")}`,
        generated.name,
        generated.age,
        generated.position,
        generated.rarity,
        generated.overall,
        generated.stats.pace,
        generated.stats.shooting,
        generated.stats.passing,
        generated.stats.dribbling,
        generated.stats.defending,
        generated.stats.strength,
        generated.stats.goalkeeping,
      ]
    );

    if (insert.affectedRows === 1) {
      added += 1;
    }

    cursor += 1;
  }

  const [totalRows] = await connection.query<CountRow[]>("SELECT COUNT(*) AS total FROM player_pool");
  return {
    targetSize,
    added,
    total: Number(totalRows[0]?.total ?? existingTotal),
  };
}

async function readLeagueTiers(connection: PoolConnection, leagueCodes?: string[]): Promise<LeagueTierSeedRow[]> {
  if (leagueCodes?.length) {
    return queryLeagueTiersByCode(connection, leagueCodes);
  }

  const [rows] = await connection.query<LeagueTierSeedRow[]>(
    `
      SELECT id, code, display_name, sort_order, team_count, is_legends
      FROM league_tiers
      ORDER BY sort_order ASC
    `
  );
  return rows;
}

async function queryLeagueTiersByCode(connection: PoolConnection, leagueCodes: string[]): Promise<LeagueTierSeedRow[]> {
  const placeholders = leagueCodes.map(() => "?").join(", ");
  const [rows] = await connection.query<LeagueTierSeedRow[]>(
    `
      SELECT id, code, display_name, sort_order, team_count, is_legends
      FROM league_tiers
      WHERE code IN (${placeholders})
      ORDER BY sort_order ASC
    `,
    leagueCodes
  );
  return rows;
}

async function ensureCpuClubForSlot(
  connection: PoolConnection,
  tier: LeagueTierSeedRow,
  slot: number
): Promise<boolean> {
  const slotCode = String(slot).padStart(3, "0");
  const cpuIdentity = `cpu:${tier.code}:${slotCode}`;
  const accountId = await ensureCpuAccount(connection, cpuIdentity);
  const managerId = await ensureCpuManager(connection, accountId, tier, slot, cpuIdentity);

  const [existingClubRows] = await connection.query<ClubIdRow[]>(
    "SELECT id FROM clubs WHERE account_id = ? LIMIT 1",
    [accountId]
  );

  let clubId: number;
  let created = false;

  if (existingClubRows.length) {
    clubId = existingClubRows[0].id;
    await connection.execute<ResultSetHeader>(
      `
        UPDATE clubs
        SET
          manager_id = ?,
          is_cpu = TRUE,
          current_league_code = ?,
          cpu_since = COALESCE(cpu_since, NOW()),
          last_login_at = NOW()
        WHERE id = ?
      `,
      [managerId, tier.code, clubId]
    );
  } else {
    const identityHash = hashString(cpuIdentity);
    const city = CPU_CITY_NAMES[identityHash % CPU_CITY_NAMES.length];
    const clubSuffix = CPU_CLUB_SUFFIXES[(identityHash >>> 3) % CPU_CLUB_SUFFIXES.length];
    const clubName = `${city} ${clubSuffix}`.slice(0, 64);
    const stadiumName = `${city} Park`.slice(0, 64);
    const badge = buildCpuBadge(identityHash);
    const homeKit = buildCpuKit(identityHash, "home");
    const awayKit = buildCpuKit(identityHash, "away");

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
          cpu_since,
          reset_count
        )
        VALUES (?, ?, TRUE, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW(), NOW(), 0)
      `,
      [accountId, managerId, clubName, city, stadiumName, JSON.stringify(badge), JSON.stringify(homeKit), JSON.stringify(awayKit), 40, tier.code]
    );

    clubId = insertClub.insertId;
    created = true;
  }

  await ensureLeagueMembership(connection, clubId, tier.id);
  await ensureCpuSquad(connection, clubId, tier, cpuIdentity);

  return created;
}

async function ensureCpuAccount(connection: PoolConnection, cpuIdentity: string): Promise<number> {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO accounts (clerk_user_id, email)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE email = VALUES(email)
    `,
    [cpuIdentity, `${cpuIdentity.replace(/:/g, ".")}@cpu.football.local`]
  );

  const [accountRows] = await connection.query<IdRow[]>(
    "SELECT id FROM accounts WHERE clerk_user_id = ? LIMIT 1",
    [cpuIdentity]
  );

  if (!accountRows.length) {
    throw new Error(`Failed to resolve CPU account id for ${cpuIdentity}`);
  }

  return accountRows[0].id;
}

async function ensureCpuManager(
  connection: PoolConnection,
  accountId: number,
  tier: LeagueTierSeedRow,
  slot: number,
  seed: string
): Promise<number> {
  const [managerRows] = await connection.query<IdRow[]>("SELECT id FROM managers WHERE account_id = ? LIMIT 1", [accountId]);
  if (managerRows.length) {
    return managerRows[0].id;
  }

  const random = createSeededRng(seed);
  const managerName = `${pick(random, CPU_MANAGER_FIRST)} ${pick(random, CPU_MANAGER_LAST)}`.slice(0, 64);
  const avatar = {
    faceShape: pick(random, ["oval", "round", "square"]),
    skinTone: pick(random, ["light", "medium", "tan", "dark"]),
    hairStyle: pick(random, ["short", "fade", "quiff", "buzz"]),
    hairColor: pick(random, ["black", "brown", "blonde", "auburn"]),
    seed: `${tier.code}-${slot}`,
  };

  const [insertManager] = await connection.execute<ResultSetHeader>(
    `
      INSERT INTO managers (account_id, name, age, gender, avatar_json, avatar_frame, level, exp, total_wins)
      VALUES (?, ?, NULL, NULL, ?, ?, 0, 0, 0)
    `,
    [accountId, managerName, JSON.stringify(avatar), "cpu"]
  );

  return insertManager.insertId;
}

async function ensureLeagueMembership(connection: PoolConnection, clubId: number, leagueTierId: number): Promise<void> {
  const [membershipRows] = await connection.query<MembershipRow[]>(
    "SELECT id, league_tier_id FROM league_memberships WHERE club_id = ? LIMIT 1",
    [clubId]
  );

  if (!membershipRows.length) {
    await connection.execute<ResultSetHeader>(
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
        VALUES (?, ?, NULL, 0, 0, 0, 0, 0, 0, 0, 0, NULL)
      `,
      [clubId, leagueTierId]
    );
    return;
  }

  if (membershipRows[0].league_tier_id !== leagueTierId) {
    await connection.execute<ResultSetHeader>(
      "UPDATE league_memberships SET league_tier_id = ?, rank_position = NULL WHERE id = ?",
      [leagueTierId, membershipRows[0].id]
    );
  }
}

async function ensureCpuSquad(
  connection: PoolConnection,
  clubId: number,
  tier: LeagueTierSeedRow,
  seedSource: string
): Promise<void> {
  const [countRows] = await connection.query<CountRow[]>(
    "SELECT COUNT(*) AS total FROM players WHERE club_id = ?",
    [clubId]
  );
  const totalPlayers = Number(countRows[0]?.total ?? 0);
  if (totalPlayers >= 15) {
    return;
  }

  if (totalPlayers > 0) {
    await connection.query("DELETE FROM lineups WHERE club_id = ?", [clubId]);
    await connection.query("DELETE FROM players WHERE club_id = ?", [clubId]);
  }

  const seededPlayers = buildCpuSquad(seedSource, tier);
  const starterPlayerIds: number[] = [];
  const benchPlayerIds: number[] = [];
  const starterCards: PlayerCard[] = [];

  for (const player of seededPlayers) {
    const [insertPlayer] = await connection.execute<ResultSetHeader>(PLAYER_INSERT_SQL, [
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
    ]);

    if (player.is_starting) {
      starterPlayerIds.push(insertPlayer.insertId);
      starterCards.push(toPlayerCard(insertPlayer.insertId, player));
    } else {
      benchPlayerIds.push(insertPlayer.insertId);
    }
  }

  const teamOverall = computeTeamOverall(starterCards);

  await connection.execute<ResultSetHeader>(
    "UPDATE clubs SET team_overall = ? WHERE id = ?",
    [teamOverall, clubId]
  );

  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO lineups (club_id, formation_code, starting_player_ids, bench_player_ids)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        formation_code = VALUES(formation_code),
        starting_player_ids = VALUES(starting_player_ids),
        bench_player_ids = VALUES(bench_player_ids)
    `,
    [
      clubId,
      pickCpuFormation(`${seedSource}:formation`),
      JSON.stringify(starterPlayerIds),
      JSON.stringify(benchPlayerIds),
    ]
  );
}

function buildCpuSquad(seedSource: string, tier: LeagueTierSeedRow): SeededPlayerRow[] {
  const random = createSeededRng(`${seedSource}:squad`);
  const base = generateStarterSquad(seedSource);
  const [minOverall, maxOverall] = resolveTierOverallRange(tier.sort_order, Boolean(tier.is_legends));

  return base.map((player, index) => {
    const baseTarget = minOverall + random() * (maxOverall - minOverall);
    const adjustedOverall = round2(clamp(baseTarget + randomInt(random, -2, 2), 30, 100));
    const rarity = rarityFromOverall(adjustedOverall);
    const cappedOverall = round2(clamp(adjustedOverall, 30, RARITY_CAPS[rarity]));
    const stats = projectStats(player, cappedOverall, random);
    const level = clampInt(Math.round((cappedOverall - 30) / 2.6), 1, 40);

    return {
      ...player,
      rarity,
      overall_rating: cappedOverall,
      level,
      exp: randomInt(random, 0, 95),
      exp_to_next: 100,
      pace: stats.pace,
      shooting: stats.shooting,
      passing: stats.passing,
      dribbling: stats.dribbling,
      defending: stats.defending,
      strength: stats.strength,
      goalkeeping: stats.goalkeeping,
      portrait_seed: `${seedSource}-cpu-${index + 1}`,
    };
  });
}

function resolveTierOverallRange(sortOrder: number, isLegends: boolean): [number, number] {
  if (isLegends) {
    return [84, 95];
  }

  const normalized = clamp((sortOrder - 1) / 14, 0, 1);
  const min = 40 + normalized * 41;
  const max = min + 8;
  return [round2(min), round2(max)];
}

function rarityFromOverall(overall: number): Rarity {
  if (overall >= 91) return "LEGENDARY";
  if (overall >= 76) return "EPIC";
  if (overall >= 56) return "RARE";
  return "COMMON";
}

function projectStats(base: StarterPlayerRow, targetOverall: number, random: () => number): Record<StatField, number> {
  const delta = targetOverall - base.overall_rating;
  const weights = POSITION_STAT_WEIGHTS[base.position];
  const nonGoalkeeperCap = base.position === "GK" ? 90 : 100;
  const goalkeepingCap = base.position === "GK" ? 100 : 55;

  return {
    pace: projectSingleStat(base.pace, delta, weights.pace, random, nonGoalkeeperCap),
    shooting: projectSingleStat(base.shooting, delta, weights.shooting, random, nonGoalkeeperCap),
    passing: projectSingleStat(base.passing, delta, weights.passing, random, nonGoalkeeperCap),
    dribbling: projectSingleStat(base.dribbling, delta, weights.dribbling, random, nonGoalkeeperCap),
    defending: projectSingleStat(base.defending, delta, weights.defending, random, nonGoalkeeperCap),
    strength: projectSingleStat(base.strength, delta, weights.strength, random, nonGoalkeeperCap),
    goalkeeping: projectSingleStat(base.goalkeeping, delta, weights.goalkeeping, random, goalkeepingCap),
  };
}

function projectSingleStat(baseStat: number, delta: number, weight: number, random: () => number, maxValue: number): number {
  return clampInt(Math.round(baseStat + delta * weight + randomInt(random, -2, 2)), 6, maxValue);
}

function toPlayerCard(id: number, player: SeededPlayerRow): PlayerCard {
  return {
    id: String(id),
    name: player.name,
    position: player.position,
    rarity: player.rarity,
    overall: player.overall_rating,
    level: player.level,
    exp: player.exp,
    stamina: player.stamina,
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

function buildCpuBadge(hash: number) {
  const colorA = colorFromHash(hash * 31);
  const colorB = colorFromHash(hash * 59);
  return {
    shape: hash % 2 === 0 ? "shield" : "circle",
    primary: colorA,
    secondary: colorB,
    icon: hash % 3 === 0 ? "star" : hash % 3 === 1 ? "ball" : "bolt",
  };
}

function buildCpuKit(hash: number, type: "home" | "away") {
  const base = type === "home" ? hash * 71 : hash * 89;
  const pattern = type === "home" ? "stripes" : "solid";
  return {
    shirt: colorFromHash(base),
    shorts: colorFromHash(base + 13),
    pattern,
  };
}

function colorFromHash(seed: number): string {
  const random = createSeededRng(String(seed));
  const r = clampInt(Math.floor(random() * 196) + 28, 0, 255);
  const g = clampInt(Math.floor(random() * 196) + 28, 0, 255);
  const b = clampInt(Math.floor(random() * 196) + 28, 0, 255);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

async function ensurePlayerPoolTable(connection: PoolConnection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS player_pool (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      pool_key VARCHAR(128) NOT NULL UNIQUE,
      source_type ENUM('CPU_SEED', 'PACK_TEMPLATE') NOT NULL DEFAULT 'PACK_TEMPLATE',
      name VARCHAR(96) NOT NULL,
      age TINYINT UNSIGNED NOT NULL,
      position ENUM('GK', 'DEF', 'MID', 'ATT') NOT NULL,
      rarity ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
      overall_rating DECIMAL(5,2) NOT NULL,
      pace TINYINT UNSIGNED NOT NULL,
      shooting TINYINT UNSIGNED NOT NULL,
      passing TINYINT UNSIGNED NOT NULL,
      dribbling TINYINT UNSIGNED NOT NULL,
      defending TINYINT UNSIGNED NOT NULL,
      strength TINYINT UNSIGNED NOT NULL,
      goalkeeping TINYINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_player_pool_position_rarity (position, rarity, overall_rating DESC)
    )
  `);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: string): () => number {
  let state = 2166136261;

  for (let i = 0; i < seed.length; i += 1) {
    state ^= seed.charCodeAt(i);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(random: () => number, values: T[]): T {
  return values[Math.floor(random() * values.length)];
}

function randomInt(random: () => number, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function pickCpuFormation(seed: string): string {
  const random = createSeededRng(seed);
  const index = Math.floor(random() * CPU_FORMATIONS.length);
  return CPU_FORMATIONS[index] ?? "4-4-2";
}
