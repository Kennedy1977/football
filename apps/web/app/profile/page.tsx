"use client";

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

export default function ProfilePage() {
  const { data: dashboardData, isLoading, error, refetch } = useGetDashboardSummaryQuery();
  const { data: squadData } = useGetSquadQuery();
  const { data: leagueData } = useGetLeagueTableQuery();
  const [updateManagerAvatar, updateManagerAvatarState] = useUpdateManagerAvatarMutation();
  const manager = dashboardData?.manager;
  const club = dashboardData?.club;
  const [selectedAvatarFrame, setSelectedAvatarFrame] = useState(0);

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

  useEffect(() => {
    if (!manager) {
      return;
    }
    setSelectedAvatarFrame(clampManagerAvatarFrameIndex(manager.avatar.frameIndex));
  }, [manager]);

  const saveAvatar = async () => {
    if (!manager || !avatarChanged) {
      return;
    }

    await updateManagerAvatar({
      avatar: createManagerAvatar(selectedAvatarFrame),
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
