"use client";

import { Coins, Flag, Shield, ShoppingBag, TrendingUp, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { useClaimDailyRewardMutation, useGetDashboardSummaryQuery } from "../../src/state/apis/gameApi";
import { ManagerAvatar } from "../../src/components/manager-avatar";
import { ProgressRow } from "../../src/components/progress-row";
import { StatCard } from "../../src/components/stat-card";
import { isAccountMissingError, readApiErrorMessage } from "../../src/lib/api-error";
import { formatLeagueLabel } from "../../src/lib/league-format";

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

  const claimReward = async () => {
    try {
      await claimDailyReward().unwrap();
      await refetch();
    } catch {
      // handled in UI feedback
    }
  };

  return (
    <main className="page-panel page-panel-portrait home-page">
      <section className="home-hero">
        <p className="home-hero-kicker">Season Live</p>
        <h2 className="home-hero-title">Build your club and climb to Legends</h2>
        <p className="home-hero-copy">
          {manager ? manager.name : "Manager"} • {club?.name || "Create your club"}
        </p>
        <div className="home-hero-actions">
          <Link href="/match/prep" className="home-cta-primary">
            <Shield size={18} />
            <span>Play Match</span>
          </Link>
          <button
            type="button"
            className="home-cta-secondary"
            onClick={claimReward}
            disabled={!daily || daily.claimed || claimState.isLoading}
          >
            <Coins size={16} />
            <span>{claimState.isLoading ? "Claiming..." : daily?.claimed ? "Reward Claimed" : "Claim Rewards"}</span>
          </button>
        </div>
      </section>

      {isLoading ? <p className="feedback">Loading dashboard...</p> : null}

      {accountMissing ? (
        <p className="feedback error">
          This user does not have an account yet. Complete onboarding first.
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

      {manager ? (
        <>
          <section className="home-summary-card">
            <div className="home-summary-head">
              <div className="home-summary-identity">
                <ManagerAvatar avatar={manager.avatar} name={manager.name} className="home-summary-avatar" />
                <div className="home-summary-text">
                  <h3>Manager Summary</h3>
                  <p className="home-summary-meta">
                    {manager.name} • {club?.name || "No club"} • {formatLeagueLabel(club?.league)}
                  </p>
                </div>
              </div>
              <span className="coin-pill">{club ? club.coins.toLocaleString() : 0} coins</span>
            </div>
            <div className="progress-stack compact">
              <ProgressRow label="Manager XP" value={managerXpProgress} valueText={`${manager.exp} XP`} tone="cyan" />
              <ProgressRow
                label="Team Overall"
                value={teamOverallProgress}
                valueText={club ? `${club.teamOverall.toFixed(1)} overall` : "-"}
                tone="green"
              />
            </div>
          </section>

          <section className="home-stats-grid">
            <StatCard label="Manager Level" value={String(manager.level)} />
            <StatCard label="League" value={formatLeagueLabel(club?.league)} />
            <StatCard label="Coins" value={club ? club.coins.toLocaleString() : "0"} tone="good" />
            <StatCard label="Daily Reward" value={daily?.claimed ? "Claimed" : "Ready"} tone={daily?.claimed ? "neutral" : "good"} />
          </section>

          <section className="home-milestones">
            <div className="home-section-head">
              <Flag size={16} />
              <h3>Milestones</h3>
            </div>
            <div className="progress-stack">
              <ProgressRow
                label="Reach Next Level"
                value={manager.exp % 100}
                valueText={`${100 - (manager.exp % 100)} XP left`}
                tone="gold"
              />
              <ProgressRow
                label="Upgrade Team"
                value={club?.teamOverall ?? 0}
                valueText={club ? `${Math.max(0, 80 - club.teamOverall).toFixed(1)} to reach 80` : "-"}
                tone="violet"
              />
            </div>
          </section>
        </>
      ) : null}

      <section className="home-quick-actions">
        <div className="home-section-head">
          <TrendingUp size={16} />
          <h3>Quick Actions</h3>
        </div>
        <div className="home-action-grid">
          <Link href="/squad" className="home-action-card">
            <Users size={16} />
            <span>Open Squad</span>
          </Link>
          <Link href="/shop" className="home-action-card">
            <ShoppingBag size={16} />
            <span>Upgrade Team</span>
          </Link>
          <Link href="/league" className="home-action-card">
            <Trophy size={16} />
            <span>League Table</span>
          </Link>
          <Link href="/match/prep" className="home-action-card">
            <Shield size={16} />
            <span>Start Match</span>
          </Link>
        </div>
      </section>

      {claimState.isError ? <p className="feedback error">Daily reward claim failed.</p> : null}
      {claimState.isSuccess ? <p className="feedback">Daily reward claimed.</p> : null}
    </main>
  );
}
