"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  useCreateClubMutation,
  useCreateManagerMutation,
  useGetDashboardSummaryQuery,
} from "../../src/state/apis/gameApi";
import { isAccountMissingError, readApiErrorMessage } from "../../src/lib/api-error";

export default function StartPage() {
  const router = useRouter();
  const { user } = useUser();
  const { data, error, isLoading, refetch } = useGetDashboardSummaryQuery();
  const [createManager, createManagerState] = useCreateManagerMutation();
  const [createClub, createClubState] = useCreateClubMutation();

  const [managerName, setManagerName] = useState("Manager");
  const [managerAge, setManagerAge] = useState("30");
  const [managerGender, setManagerGender] = useState("");

  const [clubName, setClubName] = useState("City FC");
  const [city, setCity] = useState("Manchester");
  const [stadiumName, setStadiumName] = useState("City Arena");
  const sessionEmail = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress;

  const dashboardErrorMessage = readApiErrorMessage(error);

  const needsManagerSetup = useMemo(() => {
    if (!error) {
      return !isLoading && !data?.manager;
    }

    if (isAccountMissingError(error)) {
      return true;
    }

    return dashboardErrorMessage?.includes("Manager profile not found") || false;
  }, [dashboardErrorMessage, data?.manager, error, isLoading]);

  const hasManager = Boolean(data?.manager);
  const hasClub = Boolean(data?.club);

  useEffect(() => {
    if (data?.onboardingComplete && hasClub) {
      router.replace("/home");
    }
  }, [data?.onboardingComplete, hasClub, router]);

  return (
    <main className="page-panel">
      <h2 className="page-title">Start Game</h2>
      <p className="page-copy">Create your manager, then create your club to unlock dashboard, squad, league, and match flow.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">Manager: {hasManager ? "Created" : "Missing"}</span>
        <span className="label-pill">Club: {hasClub ? "Created" : "Missing"}</span>
        <button type="button" onClick={() => refetch()}>
          Refresh Status
        </button>
      </div>

      {isLoading ? <p className="feedback">Loading account state...</p> : null}

      {error && !needsManagerSetup ? (
        <p className="feedback error">
          Unable to load onboarding status: {dashboardErrorMessage || "Unknown error"}.
        </p>
      ) : null}

      {needsManagerSetup ? (
        <section className="onboarding-card">
          <h3>Create Manager</h3>
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();

              if (!sessionEmail) {
                return;
              }

              await createManager({
                email: sessionEmail,
                name: managerName.trim(),
                age: managerAge ? Number(managerAge) : undefined,
                gender: managerGender.trim() || undefined,
              }).unwrap();

              await refetch();
            }}
          >
            <label className="field">
              <span>Account Email</span>
              <input className="input" type="text" value={sessionEmail || "Unavailable from auth session"} readOnly />
            </label>

            <label className="field">
              <span>Manager Name</span>
              <input
                className="input"
                type="text"
                required
                maxLength={64}
                value={managerName}
                onChange={(event) => setManagerName(event.target.value)}
              />
            </label>

            <div className="grid two">
              <label className="field">
                <span>Age</span>
                <input
                  className="input"
                  type="number"
                  min={16}
                  max={80}
                  value={managerAge}
                  onChange={(event) => setManagerAge(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Gender</span>
                <input
                  className="input"
                  type="text"
                  maxLength={24}
                  value={managerGender}
                  onChange={(event) => setManagerGender(event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="inline">
              <button type="submit" disabled={createManagerState.isLoading || !sessionEmail}>
                {createManagerState.isLoading ? "Creating..." : "Create Manager"}
              </button>
            </div>

            {!sessionEmail ? (
              <p className="feedback error">No account email found from Clerk session. Re-sign in and try again.</p>
            ) : null}
            {createManagerState.isError ? (
              <p className="feedback error">{readApiErrorMessage(createManagerState.error) || "Manager creation failed."}</p>
            ) : null}
            {createManagerState.isSuccess ? <p className="feedback">Manager created. Continue to club setup.</p> : null}
          </form>
        </section>
      ) : null}

      {hasManager && !hasClub ? (
        <section className="onboarding-card">
          <h3>Create Club</h3>
          <form
            className="form-grid"
            onSubmit={async (event: FormEvent) => {
              event.preventDefault();

              await createClub({
                clubName: clubName.trim(),
                city: city.trim(),
                stadiumName: stadiumName.trim(),
              }).unwrap();

              await refetch();
              router.push("/home");
            }}
          >
            <label className="field">
              <span>Club Name</span>
              <input
                className="input"
                type="text"
                required
                maxLength={64}
                value={clubName}
                onChange={(event) => setClubName(event.target.value)}
              />
            </label>

            <label className="field">
              <span>City</span>
              <input
                className="input"
                type="text"
                required
                maxLength={64}
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </label>

            <label className="field">
              <span>Stadium Name</span>
              <input
                className="input"
                type="text"
                required
                maxLength={64}
                value={stadiumName}
                onChange={(event) => setStadiumName(event.target.value)}
              />
            </label>

            <div className="inline">
              <button type="submit" disabled={createClubState.isLoading}>
                {createClubState.isLoading ? "Creating..." : "Create Club"}
              </button>
            </div>

            {createClubState.isError ? (
              <p className="feedback error">{readApiErrorMessage(createClubState.error) || "Club creation failed."}</p>
            ) : null}
          </form>
        </section>
      ) : null}

      {data?.onboardingComplete && hasClub ? (
        <section className="onboarding-card">
          <h3>Club Ready</h3>
          <p className="feedback">Your manager and club are ready. Continue to dashboard.</p>
          <div className="inline">
            <Link href="/home" className="btn">
              Open Dashboard
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
