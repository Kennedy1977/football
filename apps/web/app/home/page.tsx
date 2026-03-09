"use client";

import Link from "next/link";
import { useClaimDailyRewardMutation, useGetDashboardSummaryQuery } from "../../src/state/apis/gameApi";
import { ProgressRow } from "../../src/components/progress-row";
import { StatCard } from "../../src/components/stat-card";
import { isAccountMissingError, readApiErrorMessage } from "../../src/lib/api-error";

export default function HomePage() {
  const { data, isLoading, error, refetch } = useGetDashboardSummaryQuery();
  const [claimDailyReward, claimState] = useClaimDailyRewardMutation();

  const dashboardErrorMessage = readApiErrorMessage(error);
  const accountMissing = isAccountMissingError(error);

  const manager = data?.manager;
  const club = data?.club;
  const daily = data?.dailyReward;
  const managerXpProgress = manager ? manager.exp % 100 : 0;
  const teamOverallProgress = club ? club.teamOverall : 0;

  return (
    <main className="page-panel page-panel-portrait">
      <section className="hero-panel">
        <div className="hero-topline">
          <div>
            <h2 className="page-title">Dashboard</h2>
            <p className="page-copy">
              {manager ? manager.name : "Manager"} • {club?.name || "Create your club"}
            </p>
          </div>
          <div className="coin-pill">{club ? club.coins.toLocaleString() : 0} coins</div>
        </div>
        <div className="inline chip-row">
          <span className="label-pill">Live</span>
          <button
            type="button"
            onClick={async () => {
              try {
                await claimDailyReward().unwrap();
                await refetch();
              } catch {
                // no-op, shown in feedback below
              }
            }}
            disabled={!daily || daily.claimed || claimState.isLoading}
          >
            {claimState.isLoading ? "Claiming..." : daily?.claimed ? "Claimed" : "Claim"}
          </button>
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
      </section>

      {isLoading && <p className="feedback">Loading dashboard...</p>}

      {accountMissing ? (
        <p className="feedback error">
          This user does not have an account yet. Go to onboarding before opening dashboard modules.
        </p>
      ) : null}

      {error && !accountMissing ? (
        <p className="feedback error">
          Unable to load dashboard: {dashboardErrorMessage || "Check API/DB connectivity."}
        </p>
      ) : null}

      {accountMissing ? (
        <div className="inline" style={{ marginBottom: 12 }}>
          <Link href="/start" className="btn">
            Open Onboarding
          </Link>
        </div>
      ) : null}

      {data && !data.onboardingComplete ? (
        <div className="inline" style={{ marginBottom: 12 }}>
          <p className="feedback">Manager exists but club setup is incomplete.</p>
          <Link href="/start" className="btn">
            Complete Club Setup
          </Link>
        </div>
      ) : null}

      {manager && (
        <section className="onboarding-card section-pad">
          <h3>Club Status</h3>
          <div className="grid cards">
            <StatCard label="Level" value={String(manager.level)} />
            <StatCard label="League" value={club?.league || "-"} />
            <StatCard label="Daily Reward" value={daily?.claimed ? "Claimed" : "Ready"} tone={daily?.claimed ? "neutral" : "good"} />
          </div>
          <div className="progress-stack">
            <ProgressRow label="Manager XP" value={managerXpProgress} valueText={`${manager.exp} XP`} tone="cyan" />
            <ProgressRow
              label="Team Overall"
              value={teamOverallProgress}
              valueText={club ? `${club.teamOverall.toFixed(1)}%` : "-"}
              tone="green"
            />
            <ProgressRow
              label="Daily Reward"
              value={daily?.claimed ? 100 : 0}
              valueText={daily?.claimed ? "Claimed" : `${daily?.coins ?? 0} coins`}
              tone="gold"
            />
          </div>
        </section>
      )}

      <section className="action-grid">
        <Link href="/match/prep" className="action-tile action-tile-primary">
          Play Match
        </Link>
        <Link href="/squad" className="action-tile">
          Squad / Team
        </Link>
        <Link href="/league" className="action-tile">
          League
        </Link>
        <Link href="/shop" className="action-tile">
          Shop
        </Link>
        <Link href="/profile" className="action-tile">
          Profile
        </Link>
      </section>

      {claimState.isError && <p className="feedback error">Daily reward claim failed.</p>}
      {claimState.isSuccess && <p className="feedback">Daily reward claimed.</p>}
    </main>
  );
}
