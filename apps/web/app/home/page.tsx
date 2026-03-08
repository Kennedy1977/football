"use client";

import { useClaimDailyRewardMutation, useGetDashboardSummaryQuery } from "../../src/state/apis/gameApi";
import { StatCard } from "../../src/components/stat-card";

export default function HomePage() {
  const { data, isLoading, error, refetch } = useGetDashboardSummaryQuery();
  const [claimDailyReward, claimState] = useClaimDailyRewardMutation();

  const manager = data?.manager;
  const club = data?.club;
  const daily = data?.dailyReward;

  return (
    <main className="page-panel">
      <h2 className="page-title">Main Dashboard</h2>
      <p className="page-copy">Core game loop: manage squad, play match, earn coins, improve team, climb leagues.</p>

      {isLoading && <p className="feedback">Loading dashboard...</p>}
      {error && <p className="feedback error">Unable to load dashboard. Check API/DB connectivity.</p>}

      {manager && (
        <section className="grid cards">
          <StatCard label="Manager" value={manager.name} />
          <StatCard label="Manager Level" value={String(manager.level)} />
          <StatCard label="Manager EXP" value={String(manager.exp)} />
          <StatCard label="Club" value={club?.name || "Not created"} tone={club ? "good" : "warn"} />
          <StatCard label="League" value={club?.league || "-"} />
          <StatCard label="Coins" value={club ? String(club.coins) : "0"} tone="good" />
          <StatCard label="Team Overall" value={club ? `${club.teamOverall}%` : "-"} />
          <StatCard label="Daily Reward" value={daily?.claimed ? "Claimed" : "Available"} tone={daily?.claimed ? "neutral" : "good"} />
        </section>
      )}

      <div className="inline" style={{ marginTop: 14 }}>
        <button
          type="button"
          onClick={async () => {
            try {
              await claimDailyReward().unwrap();
              await refetch();
            } catch {
              // error handled by feedback text below
            }
          }}
          disabled={!daily || daily.claimed || claimState.isLoading}
        >
          {claimState.isLoading ? "Claiming..." : "Claim Daily Reward"}
        </button>
        <button type="button" onClick={() => refetch()}>
          Refresh Dashboard
        </button>
      </div>

      {claimState.isError && <p className="feedback error">Daily reward claim failed.</p>}
      {claimState.isSuccess && <p className="feedback">Daily reward claimed.</p>}
    </main>
  );
}
