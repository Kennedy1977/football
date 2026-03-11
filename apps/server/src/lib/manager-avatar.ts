import type { ManagerAvatar } from "../../../../packages/game-core/src";

export const MANAGER_AVATAR_SPRITE_SHEET = "manager-v1" as const;
export const MANAGER_AVATAR_FRAME_COUNT = 25;
const DEFAULT_MANAGER_AVATAR_FRAME = 0;

export function clampManagerAvatarFrameIndex(value: unknown, fallback = DEFAULT_MANAGER_AVATAR_FRAME): number {
  const parsed = parseFrameIndex(value);
  if (parsed === null) {
    return fallback;
  }

  return Math.max(0, Math.min(MANAGER_AVATAR_FRAME_COUNT - 1, Math.round(parsed)));
}

export function buildManagerAvatar(frameIndex: number): ManagerAvatar {
  return {
    spriteSheet: MANAGER_AVATAR_SPRITE_SHEET,
    frameIndex: clampManagerAvatarFrameIndex(frameIndex),
  };
}

export function normalizeManagerAvatar(rawAvatarJson: unknown, rawAvatarFrame?: unknown): ManagerAvatar {
  const fromJson = readAvatar(rawAvatarJson);
  if (fromJson) {
    return fromJson;
  }

  const fromFrame = parseFrameIndex(rawAvatarFrame);
  if (fromFrame !== null) {
    return buildManagerAvatar(fromFrame);
  }

  return buildManagerAvatar(DEFAULT_MANAGER_AVATAR_FRAME);
}

export function readAvatarFromRequest(rawValue: unknown): ManagerAvatar | null {
  return readAvatar(rawValue);
}

export function serializeManagerAvatar(rawValue: unknown): {
  avatar: ManagerAvatar;
  avatarJson: string;
  avatarFrame: string;
} {
  const avatar = readAvatar(rawValue) ?? buildManagerAvatar(DEFAULT_MANAGER_AVATAR_FRAME);
  return {
    avatar,
    avatarJson: JSON.stringify(avatar),
    avatarFrame: String(avatar.frameIndex),
  };
}

function readAvatar(rawValue: unknown): ManagerAvatar | null {
  const json = parseJsonObject(rawValue);
  if (!json) {
    return null;
  }

  const rawSheet = json.spriteSheet;
  if (rawSheet !== undefined && rawSheet !== MANAGER_AVATAR_SPRITE_SHEET) {
    return null;
  }

  const frameCandidate = parseFrameIndex(json.frameIndex ?? json.frame ?? json.index);
  if (frameCandidate === null) {
    return null;
  }

  return buildManagerAvatar(frameCandidate);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (Buffer.isBuffer(value)) {
    try {
      const parsed = JSON.parse(value.toString("utf8")) as unknown;
      return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return typeof parsed === "object" && parsed ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  return null;
}

function parseFrameIndex(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}
