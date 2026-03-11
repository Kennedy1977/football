"use client";

import { MANAGER_AVATAR_FRAME_COUNT, ManagerAvatar, clampManagerAvatarFrameIndex, createManagerAvatar } from "./manager-avatar";

interface ManagerAvatarPickerProps {
  selectedFrameIndex: number;
  onSelect: (frameIndex: number) => void;
  disabled?: boolean;
  className?: string;
}

export function ManagerAvatarPicker({ selectedFrameIndex, onSelect, disabled = false, className }: ManagerAvatarPickerProps) {
  const selected = clampManagerAvatarFrameIndex(selectedFrameIndex);
  const classes = ["manager-avatar-picker", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="listbox" aria-label="Manager profile picture options">
      {Array.from({ length: MANAGER_AVATAR_FRAME_COUNT }, (_, frameIndex) => {
        const isSelected = frameIndex === selected;

        return (
          <button
            key={frameIndex}
            type="button"
            className={`manager-avatar-picker-button ${isSelected ? "is-selected" : ""}`}
            onClick={() => onSelect(frameIndex)}
            aria-label={`Select manager profile picture ${frameIndex + 1}`}
            aria-pressed={isSelected}
            disabled={disabled}
          >
            <ManagerAvatar avatar={createManagerAvatar(frameIndex)} className="manager-avatar-picker-tile" />
          </button>
        );
      })}
    </div>
  );
}
