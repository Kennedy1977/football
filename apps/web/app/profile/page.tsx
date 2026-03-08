"use client";

import { useGetDashboardSummaryQuery } from "../../src/state/apis/gameApi";
import { StatCard } from "../../src/components/stat-card";

export default function ProfilePage() {
  const { data, isLoading, error } = useGetDashboardSummaryQuery();

  return (
    <main className="page-panel">
      <h2 className="page-title">Manager Profile</h2>
      <p className="page-copy">Manager progression, club identity, and long-term unlock status.</p>

      {isLoading && <p className="feedback">Loading profile...</p>}
      {error && <p className="feedback error">Unable to load profile.</p>}

      {data?.manager ? (
        <section className="grid cards">
          <StatCard label="Manager Name" value={data.manager.name} />
          <StatCard label="Manager Level" value={String(data.manager.level)} />
          <StatCard label="Manager EXP" value={String(data.manager.exp)} />
          <StatCard label="Club" value={data.club?.name || "Not created"} />
          <StatCard label="City" value={data.club?.city || "-"} />
          <StatCard label="Stadium" value={data.club?.stadiumName || "-"} />
          <StatCard label="League" value={data.club?.league || "-"} />
          <StatCard label="Coins" value={String(data.club?.coins || 0)} />
        </section>
      ) : null}
    </main>
  );
}
