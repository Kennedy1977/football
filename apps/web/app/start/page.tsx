"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  useCreateClubMutation,
  useCreateManagerMutation,
  useGetDashboardSummaryQuery,
} from "../../src/state/apis/gameApi";
import { ManagerAvatar, createManagerAvatar } from "../../src/components/manager-avatar";
import { ManagerAvatarPicker } from "../../src/components/manager-avatar-picker";
import { ProgressRow } from "../../src/components/progress-row";
import { isAccountMissingError, readApiErrorMessage } from "../../src/lib/api-error";

export default function StartPage() {
  const router = useRouter();
  const { data, error, isLoading, refetch } = useGetDashboardSummaryQuery();
  const [createManager, createManagerState] = useCreateManagerMutation();
  const [createClub, createClubState] = useCreateClubMutation();

  const [email, setEmail] = useState("manager@example.com");
  const [managerName, setManagerName] = useState("Manager");
  const [managerAge, setManagerAge] = useState("30");
  const [managerGender, setManagerGender] = useState("");
  const [selectedAvatarFrame, setSelectedAvatarFrame] = useState(0);

  const [clubName, setClubName] = useState("City FC");
  const [city, setCity] = useState("Manchester");
  const [stadiumName, setStadiumName] = useState("City Arena");

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
    <main className="page-panel page-panel-portrait">
      <section className="hero-panel">
        <h2 className="page-title">Kickoff Setup</h2>
        <p className="page-copy">Create your manager, then your club to unlock all modules.</p>
      </section>

      <div className="inline" style={{ marginBottom: 10 }}>
        <span className="label-pill">Manager: {hasManager ? "Created" : "Missing"}</span>
        <span className="label-pill">Club: {hasClub ? "Created" : "Missing"}</span>
        <button type="button" onClick={() => refetch()}>
          Refresh Status
        </button>
      </div>

      <section className="onboarding-card section-pad">
        <h3>Setup Progress</h3>
        <div className="progress-stack">
          <ProgressRow label="Manager Profile" value={hasManager ? 100 : 30} valueText={hasManager ? "Ready" : "Required"} />
          <ProgressRow
            label="Club Identity"
            value={hasClub ? 100 : hasManager ? 55 : 0}
            valueText={hasClub ? "Ready" : "Pending"}
            tone="green"
          />
        </div>
      </section>

      {isLoading ? <p className="feedback">Loading account state...</p> : null}

      {error && !needsManagerSetup ? (
        <p className="feedback error">
          Unable to load onboarding status: {dashboardErrorMessage || "Unknown error"}.
        </p>
      ) : null}

      {needsManagerSetup ? (
        <section className="onboarding-card section-pad">
          <h3>Create Manager</h3>
          <form
            className="form-grid"
            onSubmit={async (event) => {
              event.preventDefault();

              const normalizedEmail = email.trim();
              if (!normalizedEmail) {
                return;
              }

              await createManager({
                email: normalizedEmail,
                name: managerName.trim(),
                age: managerAge ? Number(managerAge) : undefined,
                gender: managerGender.trim() || undefined,
                avatar: createManagerAvatar(selectedAvatarFrame),
              }).unwrap();

              await refetch();
            }}
          >
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
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

            <div className="field">
              <span>Profile Picture</span>
              <div className="manager-avatar-create-preview">
                <ManagerAvatar avatar={createManagerAvatar(selectedAvatarFrame)} name={managerName} className="profile-avatar" />
                <p className="manager-avatar-create-copy">Pick your manager portrait. You can change it later in Profile.</p>
              </div>
              <ManagerAvatarPicker selectedFrameIndex={selectedAvatarFrame} onSelect={setSelectedAvatarFrame} />
            </div>

            <div className="inline">
              <button type="submit" disabled={createManagerState.isLoading || !email.trim()}>
                {createManagerState.isLoading ? "Creating..." : "Create Manager"}
              </button>
            </div>

            {createManagerState.isError ? (
              <p className="feedback error">{readApiErrorMessage(createManagerState.error) || "Manager creation failed."}</p>
            ) : null}
            {createManagerState.isSuccess ? <p className="feedback">Manager created. Continue to club setup.</p> : null}
          </form>
        </section>
      ) : null}

      {hasManager && !hasClub ? (
        <section className="onboarding-card section-pad">
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
        <section className="onboarding-card section-pad">
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
