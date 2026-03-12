"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ManagerAvatar, clampManagerAvatarFrameIndex, createManagerAvatar } from "../../src/components/manager-avatar";
import { ManagerAvatarPicker } from "../../src/components/manager-avatar-picker";
import { ProgressRow } from "../../src/components/progress-row";
import { StatCard } from "../../src/components/stat-card";
import {
  useGetDashboardSummaryQuery,
  useGetLeagueTableQuery,
  useGetSquadQuery,
  useUpdateClubKitsMutation,
  useUpdateManagerAvatarMutation,
} from "../../src/state/apis/gameApi";
import { formatLeagueLabel } from "../../src/lib/league-format";

interface SquadPlayerProfile {
  id: number;
  name: string;
  position: "GK" | "DEF" | "MID" | "ATT";
  overall: number;
  stamina: number;
  isStarting: boolean;
  isBench: boolean;
}

const SHIRT_SPRITE_COLUMNS = 8;
const SHIRT_SPRITE_ROWS = 6;

const KIT_PRESETS = [
  { key: "red", label: "Red", color: "#d72638", shirtIndex: 0 },
  { key: "blue", label: "Blue", color: "#2f8ef0", shirtIndex: 1 },
  { key: "yellow", label: "Yellow", color: "#f4c534", shirtIndex: 2 },
  { key: "green", label: "Green", color: "#22c55e", shirtIndex: 3 },
  { key: "white", label: "White", color: "#f8fafc", shirtIndex: 4 },
  { key: "black", label: "Black", color: "#111827", shirtIndex: 5 },
] as const;

type KitPreset = (typeof KIT_PRESETS)[number];
type KitPresetKey = KitPreset["key"];

export default function ProfilePage() {
  const { data: dashboardData, isLoading, error, refetch } = useGetDashboardSummaryQuery();
  const { data: squadData } = useGetSquadQuery();
  const { data: leagueData } = useGetLeagueTableQuery();
  const [updateManagerAvatar, updateManagerAvatarState] = useUpdateManagerAvatarMutation();
  const [updateClubKits, updateClubKitsState] = useUpdateClubKitsMutation();
  const manager = dashboardData?.manager;
  const club = dashboardData?.club;
  const [selectedAvatarFrame, setSelectedAvatarFrame] = useState(0);
  const [selectedHomeKit, setSelectedHomeKit] = useState<KitPresetKey>("blue");
  const [selectedAwayKit, setSelectedAwayKit] = useState<KitPresetKey>("red");

  const squadPlayers = useMemo(
    () => ((squadData?.players ?? []) as SquadPlayerProfile[]),
    [squadData?.players]
  );
  const starters = useMemo(() => squadPlayers.filter((player) => player.isStarting), [squadPlayers]);
  const averageStamina = useMemo(() => {
    if (!squadPlayers.length) {
      return 0;
    }
    return squadPlayers.reduce((sum, player) => sum + player.stamina, 0) / squadPlayers.length;
  }, [squadPlayers]);
  const topPlayers = useMemo(
    () =>
      squadPlayers
        .slice()
        .sort((a, b) => (b.overall !== a.overall ? b.overall - a.overall : b.stamina - a.stamina))
        .slice(0, 5),
    [squadPlayers]
  );

  const leagueRow = useMemo(() => {
    if (!leagueData?.table?.length) {
      return null;
    }
    return leagueData.table.find((row) => row.rank === leagueData.userRank) ?? null;
  }, [leagueData]);
  const leaderPoints = leagueData?.table?.[0]?.points ?? 0;
  const pointsBehindLeader = leagueRow ? Math.max(0, leaderPoints - leagueRow.points) : null;
  const topFourPoints =
    leagueData?.table?.length && leagueData.table.length >= 4
      ? leagueData.table[3].points
      : leagueData?.table?.[leagueData?.table.length - 1]?.points ?? null;
  const pointsToTopFour = leagueRow && typeof topFourPoints === "number" ? Math.max(0, topFourPoints - leagueRow.points) : null;

  const managerLevelProgress = manager ? manager.exp % 100 : 0;
  const xpToNextLevel = manager ? (managerLevelProgress === 0 ? 100 : 100 - managerLevelProgress) : 100;
  const currentAvatarFrame = clampManagerAvatarFrameIndex(manager?.avatar?.frameIndex ?? 0);
  const avatarChanged = Boolean(manager) && currentAvatarFrame !== selectedAvatarFrame;
  const savedHomeKit = useMemo(
    () => resolveKitPresetKey(club?.homeKit, "blue"),
    [club?.homeKit]
  );
  const savedAwayKit = useMemo(
    () => resolveKitPresetKey(club?.awayKit, "red"),
    [club?.awayKit]
  );
  const selectedHomeColor = getKitPreset(selectedHomeKit).color;
  const selectedAwayColor = getKitPreset(selectedAwayKit).color;
  const hasKitColorConflict = selectedHomeColor === selectedAwayColor;
  const kitsChanged = selectedHomeKit !== savedHomeKit || selectedAwayKit !== savedAwayKit;

  useEffect(() => {
    if (!manager) {
      return;
    }
    setSelectedAvatarFrame(clampManagerAvatarFrameIndex(manager.avatar.frameIndex));
  }, [manager]);

  useEffect(() => {
    setSelectedHomeKit(resolveKitPresetKey(club?.homeKit, "blue"));
    setSelectedAwayKit(resolveKitPresetKey(club?.awayKit, "red"));
  }, [club?.homeKit, club?.awayKit]);

  const saveAvatar = async () => {
    if (!manager || !avatarChanged) {
      return;
    }

    await updateManagerAvatar({
      avatar: createManagerAvatar(selectedAvatarFrame),
    }).unwrap();
  };

  const saveKits = async () => {
    if (!club || !kitsChanged || hasKitColorConflict) {
      return;
    }

    await updateClubKits({
      homeKit: buildKitPayload(selectedHomeKit, "home"),
      awayKit: buildKitPayload(selectedAwayKit, "away"),
    }).unwrap();
  };

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Manager Profile</h2>
      <p className="page-copy">Identity, season status, and squad leadership in one place.</p>

      {isLoading && <p className="feedback">Loading profile...</p>}
      {error ? (
        <>
          <p className="feedback error">Unable to load profile.</p>
          <div className="inline" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        </>
      ) : null}

      {manager ? (
        <>
          <section className="onboarding-card section-pad profile-hero">
            <div className="profile-hero-head">
              <ManagerAvatar avatar={manager.avatar} name={manager.name} className="profile-avatar" />
              <div className="profile-hero-copy">
                <p className="manager-name">{manager.name}</p>
                <p className="manager-sub">
                  {club?.name || "No club yet"} • {formatLeagueLabel(club?.league)}
                </p>
                <div className="profile-badge-row">
                  <span className="label-pill">Manager ID #{manager.id}</span>
                  <span className="label-pill">Lv {manager.level}</span>
                  <span className="label-pill">Rank #{leagueData?.userRank ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="progress-stack">
              <ProgressRow
                label="Manager XP"
                value={managerLevelProgress}
                valueText={`${manager.exp} XP (${xpToNextLevel} to next level)`}
                tone="violet"
              />
              <ProgressRow
                label="Club Strength"
                value={club?.teamOverall ?? 0}
                valueText={club ? `${club.teamOverall.toFixed(1)} overall` : "No club yet"}
                tone="green"
              />
              <ProgressRow
                label="Squad Stamina"
                value={averageStamina}
                valueText={`${averageStamina.toFixed(1)} avg`}
                tone="gold"
              />
            </div>
          </section>

          <section className="onboarding-card section-pad" style={{ marginTop: 12 }}>
            <h3>Profile Picture</h3>
            <p className="page-copy">Choose a manager portrait from the sprite sheet. You can update this at any time.</p>
            <ManagerAvatarPicker
              selectedFrameIndex={selectedAvatarFrame}
              onSelect={setSelectedAvatarFrame}
              disabled={updateManagerAvatarState.isLoading}
            />
            <div className="inline profile-avatar-save-row">
              <button
                type="button"
                onClick={saveAvatar}
                disabled={!avatarChanged || updateManagerAvatarState.isLoading}
              >
                {updateManagerAvatarState.isLoading ? "Saving..." : "Save Profile Picture"}
              </button>
            </div>
            {updateManagerAvatarState.isError ? (
              <p className="feedback error">Unable to update manager profile picture.</p>
            ) : null}
            {updateManagerAvatarState.isSuccess ? <p className="feedback">Profile picture updated.</p> : null}
          </section>

          <section className="onboarding-card section-pad" style={{ marginTop: 12 }}>
            <h3>Team Kits</h3>
            <p className="page-copy">Set your home and away shirt from the sprite kit options.</p>
            <div className="profile-kit-grid">
              <KitPickerColumn
                title="Home Kit"
                selectedKey={selectedHomeKit}
                onSelect={setSelectedHomeKit}
                disabled={updateClubKitsState.isLoading}
              />
              <KitPickerColumn
                title="Away Kit"
                selectedKey={selectedAwayKit}
                onSelect={setSelectedAwayKit}
                disabled={updateClubKitsState.isLoading}
              />
            </div>
            <div className="inline profile-kit-save-row">
              <button
                type="button"
                onClick={saveKits}
                disabled={!kitsChanged || hasKitColorConflict || updateClubKitsState.isLoading}
              >
                {updateClubKitsState.isLoading ? "Saving..." : "Save Team Kits"}
              </button>
            </div>
            {hasKitColorConflict ? (
              <p className="feedback error">Home and away kits must use different shirt colours.</p>
            ) : null}
            {updateClubKitsState.isError ? (
              <p className="feedback error">Unable to update team kits.</p>
            ) : null}
            {updateClubKitsState.isSuccess ? <p className="feedback">Team kits updated.</p> : null}
          </section>

          <section className="profile-kpi-grid">
            <article className="profile-kpi-tile">
              <p>League Rank</p>
              <strong>#{leagueData?.userRank ?? "-"}</strong>
            </article>
            <article className="profile-kpi-tile">
              <p>League Points</p>
              <strong>{leagueRow?.points ?? "-"}</strong>
            </article>
            <article className="profile-kpi-tile">
              <p>Record</p>
              <strong>{leagueRow ? `${leagueRow.wins}-${leagueRow.draws}-${leagueRow.losses}` : "-"}</strong>
            </article>
            <article className="profile-kpi-tile">
              <p>Points To Top 4</p>
              <strong>{typeof pointsToTopFour === "number" ? pointsToTopFour : "-"}</strong>
            </article>
            <article className="profile-kpi-tile">
              <p>Behind Leader</p>
              <strong>{typeof pointsBehindLeader === "number" ? pointsBehindLeader : "-"}</strong>
            </article>
            <article className="profile-kpi-tile">
              <p>Club Coins</p>
              <strong>{club ? club.coins.toLocaleString() : "-"}</strong>
            </article>
          </section>

          <section className="onboarding-card section-pad" style={{ marginTop: 12 }}>
            <h3>Club Operations</h3>
            <div className="profile-ops-grid">
              <div className="profile-ops-row">
                <span>Club</span>
                <strong>{club?.name || "Not created"}</strong>
              </div>
              <div className="profile-ops-row">
                <span>City</span>
                <strong>{club?.city || "-"}</strong>
              </div>
              <div className="profile-ops-row">
                <span>Stadium</span>
                <strong>{club?.stadiumName || "-"}</strong>
              </div>
              <div className="profile-ops-row">
                <span>League</span>
                <strong>{formatLeagueLabel(club?.league)}</strong>
              </div>
              <div className="profile-ops-row">
                <span>Squad Size</span>
                <strong>{squadPlayers.length}</strong>
              </div>
              <div className="profile-ops-row">
                <span>Starting XI</span>
                <strong>{starters.length}/11</strong>
              </div>
              <div className="profile-ops-row">
                <span>Bench</span>
                <strong>{squadPlayers.filter((player) => player.isBench).length}</strong>
              </div>
              <div className="profile-ops-row">
                <span>Formation</span>
                <strong>{squadData?.lineup?.formation || "Not set"}</strong>
              </div>
            </div>
          </section>

          <section className="onboarding-card section-pad" style={{ marginTop: 12 }}>
            <h3>Squad Leadership</h3>
            {topPlayers.length ? (
              <ul className="profile-leaderboard">
                {topPlayers.map((player) => (
                  <li key={player.id} className="profile-leader-item">
                    <div className="profile-leader-head">
                      <strong>{player.name}</strong>
                      <span className="profile-leader-role">{player.position}</span>
                    </div>
                    <div className="profile-leader-meta">
                      <span>OVR {player.overall}</span>
                      <span>Stamina {Math.round(player.stamina)}%</span>
                      <span>{player.isStarting ? "Starter" : player.isBench ? "Bench" : "Reserve"}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="feedback">No squad data available yet.</p>
            )}
          </section>
        </>
      ) : null}

      {manager ? null : (
        <>
          <section className="grid cards">
            <StatCard label="Manager Name" value="Not created" />
            <StatCard label="Status" value="Start onboarding" tone="warn" />
            <StatCard label="Club" value="Not created" tone="warn" />
            <StatCard label="Next Step" value="Create manager + club" />
          </section>
          <div className="inline" style={{ marginTop: 12 }}>
            <Link href="/start" className="btn">
              Open Onboarding
            </Link>
          </div>
        </>
      )}
    </main>
  );
}

function KitPickerColumn({
  title,
  selectedKey,
  onSelect,
  disabled,
}: {
  title: string;
  selectedKey: KitPresetKey;
  onSelect: (key: KitPresetKey) => void;
  disabled: boolean;
}) {
  return (
    <div className="profile-kit-column">
      <p className="profile-kit-column-title">{title}</p>
      <div className="profile-kit-options" role="listbox" aria-label={`${title} options`}>
        {KIT_PRESETS.map((preset) => {
          const isSelected = preset.key === selectedKey;
          const shirtStyle: CSSProperties = { backgroundPosition: toShirtSpritePosition(preset.shirtIndex) };
          return (
            <button
              key={`${title}-${preset.key}`}
              type="button"
              className={`profile-kit-option ${isSelected ? "is-selected" : ""}`}
              onClick={() => onSelect(preset.key)}
              aria-label={`Select ${preset.label} for ${title}`}
              aria-pressed={isSelected}
              disabled={disabled}
            >
              <span className="profile-kit-shirt-preview" aria-hidden>
                <span className="profile-kit-shirt-sprite" style={shirtStyle} />
              </span>
              <span className="profile-kit-option-meta">
                <span className="profile-kit-option-dot" style={{ backgroundColor: preset.color }} aria-hidden />
                <span>{preset.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function resolveKitPresetKey(rawKit: unknown, fallback: KitPresetKey): KitPresetKey {
  const parsed = parseKitRecord(rawKit);
  if (!parsed) {
    return fallback;
  }

  const indexValue = Number(parsed.shirtSpriteIndex);
  if (Number.isInteger(indexValue)) {
    const byIndex = KIT_PRESETS.find((preset) => preset.shirtIndex === indexValue);
    if (byIndex) {
      return byIndex.key;
    }
  }

  const shirtColor = normalizeHexColor(parsed.shirt);
  if (shirtColor) {
    const byColor = KIT_PRESETS.find((preset) => preset.color === shirtColor);
    if (byColor) {
      return byColor.key;
    }
  }

  return fallback;
}

function buildKitPayload(key: KitPresetKey, side: "home" | "away"): Record<string, unknown> {
  const preset = getKitPreset(key);
  return {
    shirt: preset.color,
    shorts: side === "home" ? "#ffffff" : "#111827",
    pattern: "solid",
    shirtSpriteIndex: preset.shirtIndex,
    colorGroup: preset.key,
  };
}

function getKitPreset(key: KitPresetKey): KitPreset {
  return KIT_PRESETS.find((preset) => preset.key === key) ?? KIT_PRESETS[0];
}

function parseKitRecord(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
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
      return null;
    }
  }

  return null;
}

function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }

  return null;
}

function toShirtSpritePosition(index: number): string {
  const safeIndex = Math.max(0, Math.floor(index));
  const col = safeIndex % SHIRT_SPRITE_COLUMNS;
  const row = Math.floor(safeIndex / SHIRT_SPRITE_COLUMNS);
  const x = SHIRT_SPRITE_COLUMNS > 1 ? (col / (SHIRT_SPRITE_COLUMNS - 1)) * 100 : 0;
  const y = SHIRT_SPRITE_ROWS > 1 ? (row / (SHIRT_SPRITE_ROWS - 1)) * 100 : 0;
  return `${x}% ${y}%`;
}
