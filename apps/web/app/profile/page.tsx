"use client";

import { useGetDashboardSummaryQuery } from "../../src/state/apis/gameApi";
import { ProgressRow } from "../../src/components/progress-row";
import { StatCard } from "../../src/components/stat-card";
import { formatLeagueLabel } from "../../src/lib/league-format";

export default function ProfilePage() {
  const { data, isLoading, error } = useGetDashboardSummaryQuery();
  const manager = data?.manager;
  const club = data?.club;

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Manager Profile</h2>
      <p className="page-copy">Manager progression, club identity, and long-term unlock status.</p>

      {isLoading && <p className="feedback">Loading profile...</p>}
      {error && <p className="feedback error">Unable to load profile.</p>}

      {manager ? (
        <section className="onboarding-card section-pad">
          <h3>Manager Card</h3>
          <div className="manager-card">
            <div className="manager-avatar">{manager.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <p className="manager-name">{manager.name}</p>
              <p className="manager-sub">
                {club?.name || "No club yet"} • {club?.league ? formatLeagueLabel(club.league) : "Unranked"}
              </p>
            </div>
          </div>
          <div className="progress-stack">
            <ProgressRow label="Manager Level" value={Math.min(100, manager.level * 5)} valueText={`Lv ${manager.level}`} tone="cyan" />
            <ProgressRow label="Manager XP" value={manager.exp % 100} valueText={`${manager.exp} XP`} tone="violet" />
            <ProgressRow
              label="Club Strength"
              value={club?.teamOverall ?? 0}
              valueText={club ? `${club.teamOverall.toFixed(1)} overall` : "-"}
              tone="green"
            />
          </div>
        </section>
      ) : null}

      {manager ? (
        <section className="grid cards" style={{ marginTop: 12 }}>
          <StatCard label="Club" value={club?.name || "Not created"} />
          <StatCard label="City" value={club?.city || "-"} />
          <StatCard label="Stadium" value={club?.stadiumName || "-"} />
          <StatCard label="League" value={formatLeagueLabel(club?.league)} />
          <StatCard label="Coins" value={String(club?.coins || 0)} tone="good" />
          <StatCard label="Team Overall" value={club ? `${club.teamOverall.toFixed(1)}` : "-"} />
        </section>
      ) : null}

      {manager ? (
        <section className="onboarding-card section-pad" style={{ marginTop: 12 }}>
          <h3>Next Milestones</h3>
          <div className="progress-stack">
            <ProgressRow
              label="Reach Next Level"
              value={manager.exp % 100}
              valueText={`${100 - (manager.exp % 100)} XP remaining`}
              tone="gold"
            />
            <ProgressRow
              label="Push Team Overall"
              value={club?.teamOverall ?? 0}
              valueText={club ? `${Math.max(0, 80 - club.teamOverall).toFixed(1)} to reach 80` : "-"}
              tone="red"
            />
          </div>
        </section>
      ) : null}

      {manager ? null : (
        <section className="grid cards">
          <StatCard label="Manager Name" value="Not created" />
          <StatCard label="Status" value="Start onboarding" tone="warn" />
        </section>
      )}
    </main>
  );
}
