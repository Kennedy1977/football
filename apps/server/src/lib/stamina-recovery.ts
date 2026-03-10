import type { RowDataPacket } from "mysql2";
import { recoverStaminaRealtime } from "../../../../packages/game-core/src/formulas";
import { pool } from "../config/db";

interface ClubRecoveryRow extends RowDataPacket {
  last_login_at: Date | string | null;
}

interface PlayerStaminaRow extends RowDataPacket {
  id: number;
  stamina: number;
}

interface RecoveryOptions {
  bootstrapMinutes?: number;
}

const DEFAULT_BOOTSTRAP_MINUTES = 30;
const DEFAULT_RECOVERY_MULTIPLIER = 4;

export async function recoverClubStamina(clubId: number, options: RecoveryOptions = {}): Promise<void> {
  const [clubRows] = await pool.query<ClubRecoveryRow[]>(
    "SELECT last_login_at FROM clubs WHERE id = ? LIMIT 1",
    [clubId]
  );

  if (!clubRows.length) {
    return;
  }

  const now = Date.now();
  const fallbackMinutes = Math.max(0, options.bootstrapMinutes ?? DEFAULT_BOOTSTRAP_MINUTES);
  const lastSeen = parseTimestampMs(clubRows[0].last_login_at);
  const baseTime = lastSeen ?? now - fallbackMinutes * 60_000;
  const elapsedMinutes = Math.max(0, (now - baseTime) / 60_000);
  const recoveryMultiplier = readRecoveryMultiplier();
  const effectiveRecoveryMinutes = elapsedMinutes * recoveryMultiplier;

  if (effectiveRecoveryMinutes > 0) {
    const [players] = await pool.query<PlayerStaminaRow[]>(
      "SELECT id, stamina FROM players WHERE club_id = ?",
      [clubId]
    );

    for (const player of players) {
      const nextStamina = recoverStaminaRealtime(Number(player.stamina), effectiveRecoveryMinutes);
      if (Math.abs(nextStamina - Number(player.stamina)) < 0.01) {
        continue;
      }

      await pool.query("UPDATE players SET stamina = ? WHERE id = ?", [nextStamina, player.id]);
    }
  }

  await pool.query("UPDATE clubs SET last_login_at = NOW() WHERE id = ?", [clubId]);
}

function parseTimestampMs(value: Date | string | null): number | null {
  if (!value) return null;
  if (value instanceof Date) {
    const parsed = value.getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readRecoveryMultiplier(): number {
  const raw = process.env.STAMINA_RECOVERY_MULTIPLIER;
  if (!raw) {
    return DEFAULT_RECOVERY_MULTIPLIER;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_RECOVERY_MULTIPLIER;
  }

  return Math.min(20, Math.max(0, parsed));
}

