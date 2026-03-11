"use client";

import type { CSSProperties } from "react";
import type { ManagerAvatar as ManagerAvatarModel } from "../../../../packages/game-core/src";

export const MANAGER_AVATAR_SPRITE_SHEET = "manager-v1" as const;
export const MANAGER_AVATAR_FRAME_COUNT = 25;
const MANAGER_AVATAR_GRID_COLUMNS = 5;

interface ManagerAvatarProps {
  avatar?: ManagerAvatarModel | null;
  name?: string;
  className?: string;
  decorative?: boolean;
}

export function ManagerAvatar({ avatar, name = "Manager", className, decorative = true }: ManagerAvatarProps) {
  const spriteSheet = avatar?.spriteSheet ?? MANAGER_AVATAR_SPRITE_SHEET;
  const frameIndex = clampManagerAvatarFrameIndex(avatar?.frameIndex ?? 0);
  const isSprite = spriteSheet === MANAGER_AVATAR_SPRITE_SHEET;

  const style = isSprite
    ? ({
        "--manager-avatar-col": String(frameIndex % MANAGER_AVATAR_GRID_COLUMNS),
        "--manager-avatar-row": String(Math.floor(frameIndex / MANAGER_AVATAR_GRID_COLUMNS)),
      } as CSSProperties)
    : undefined;

  const classes = ["manager-avatar", isSprite ? "is-sprite" : "is-fallback", className].filter(Boolean).join(" ");

  if (decorative) {
    return (
      <span className={classes} style={style} aria-hidden>
        {!isSprite ? <span className="manager-avatar-initials">{toInitials(name)}</span> : null}
      </span>
    );
  }

  return (
    <span className={classes} style={style} role="img" aria-label={`${name} avatar`}>
      {!isSprite ? <span className="manager-avatar-initials">{toInitials(name)}</span> : null}
    </span>
  );
}

export function createManagerAvatar(frameIndex: number): ManagerAvatarModel {
  return {
    spriteSheet: MANAGER_AVATAR_SPRITE_SHEET,
    frameIndex: clampManagerAvatarFrameIndex(frameIndex),
  };
}

export function clampManagerAvatarFrameIndex(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(MANAGER_AVATAR_FRAME_COUNT - 1, Math.round(value)));
}

function toInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "M";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}
