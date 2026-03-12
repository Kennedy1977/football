"use client";

import { useEffect, useRef, useState } from "react";
import {
  useDecidePackRewardMutation,
  useGetPendingPackRewardsQuery,
  useGetPacksQuery,
  usePurchasePackMutation,
} from "../../src/state/apis/gameApi";
import { toRarityFrame } from "../../src/lib/rarity-frame";

type ChestTier = "green" | "blue" | "purple" | "epic" | "gold" | "legend";

export default function ShopPage() {
  const [activeTab, setActiveTab] = useState("chests");
  const { data, isLoading, error, refetch } = useGetPacksQuery();
  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useGetPendingPackRewardsQuery();
  const [purchasePack, purchaseState] = usePurchasePackMutation();
  const [decideReward, rewardDecisionState] = useDecidePackRewardMutation();
  const [purchasingPackId, setPurchasingPackId] = useState<number | null>(null);
  const pendingSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const tab = new URLSearchParams(window.location.search).get("tab");
    setActiveTab((tab || "chests").toLowerCase());
  }, []);

  useEffect(() => {
    if (activeTab !== "pending") {
      return;
    }

    pendingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab, pendingData?.rewards?.length]);

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Shop & Chests</h2>
      <p className="page-copy">Open chests to earn players, coins, and EXP.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <button type="button" onClick={() => refetch()}>
          Refresh Chests
        </button>
      </div>

      {isLoading && <p className="feedback">Loading chests...</p>}
      {error && <p className="feedback error">Unable to load chest catalogue.</p>}

      {data?.packs?.length ? (
        <section className="chest-grid">
          {data.packs.map((pack) => {
            const chest = getChestPresentation(pack.priceCoins, pack.rewardFocus, pack.rarityHint);
            const buyingThisChest = purchaseState.isLoading && purchasingPackId === pack.id;

            return (
              <article key={pack.id} className={`chest-card tier-${chest.tier}`}>
                {chest.ribbon ? <span className="chest-ribbon">{chest.ribbon}</span> : null}
                <div className="chest-head">
                  <div className={`chest-visual tier-${chest.tier}`} aria-hidden>
                    <span className="chest-lock" />
                  </div>
                  <div className="chest-price">
                    <strong>{pack.priceCoins.toLocaleString()}</strong>
                    <span>coins</span>
                  </div>
                </div>

                <h3 className="chest-name">{chest.name}</h3>
                <p className="chest-copy">{chest.copy}</p>

                <div className="chest-meta-row">
                  <span className="chest-meta-pill">
                    {pack.rewardCount} reward{pack.rewardCount === 1 ? "" : "s"}
                  </span>
                  <span className="chest-meta-pill">{chest.focus}</span>
                </div>

                <div className="chest-rarity-row">
                  <span className="chest-rarity-label">Rarity</span>
                  <span className={`chest-rarity-badge tier-${chest.tier}`}>{chest.rarity}</span>
                </div>

                <button
                  type="button"
                  disabled={purchaseState.isLoading}
                  onClick={async () => {
                    setPurchasingPackId(pack.id);
                    try {
                      await purchasePack({ packId: pack.id }).unwrap();
                      await refetchPending();
                    } finally {
                      setPurchasingPackId(null);
                    }
                  }}
                >
                  {buyingThisChest ? "Unlocking..." : "Buy Chest"}
                </button>
              </article>
            );
          })}
        </section>
      ) : null}

      {purchaseState.isError && <p className="feedback error">Chest purchase failed.</p>}

      <section
        ref={pendingSectionRef}
        className={`onboarding-card section-pad ${activeTab === "pending" ? "shop-pending-focus" : ""}`}
        style={{ marginTop: 16 }}
      >
        <h3>Unfinished Chests</h3>
        <p className="page-copy">Complete your reward decisions for unopened chest pulls.</p>
        {pendingLoading ? <p className="feedback">Loading unfinished rewards...</p> : null}
        {pendingData?.rewards?.length ? (
          <div className="player-grid">
            {pendingData.rewards.map((reward) => (
              <article key={reward.rewardId} className={`player-card rarity-${toRarityFrame(reward.player.rarity)}`}>
                <div className="player-card-head">
                  <div>
                    <h3>{reward.player.name}</h3>
                    <p>{reward.player.rarity}</p>
                    <p>{reward.pack.name}</p>
                  </div>
                  <div className="player-overall">{reward.player.overall}</div>
                </div>
                <div className="inline">
                  <button
                    type="button"
                    disabled={rewardDecisionState.isLoading || !reward.keepAvailable}
                    onClick={async () => {
                      await decideReward({ rewardId: reward.rewardId, decision: "KEEP" }).unwrap();
                      await refetchPending();
                    }}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={rewardDecisionState.isLoading}
                    onClick={async () => {
                      await decideReward({ rewardId: reward.rewardId, decision: "CONVERT_COINS" }).unwrap();
                      await refetchPending();
                    }}
                  >
                    +{reward.convertCoins} Coins
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="feedback">No unfinished chest rewards.</p>
        )}
        {rewardDecisionState.isError && <p className="feedback error">Reward decision failed.</p>}
        {rewardDecisionState.isSuccess && <p className="feedback">Reward decision saved.</p>}
      </section>

    </main>
  );
}

function getChestPresentation(priceCoins: number, rewardFocus: string, rarityHint: string): {
  tier: ChestTier;
  name: string;
  copy: string;
  focus: string;
  rarity: string;
  ribbon?: string;
} {
  const tier = getChestTier(priceCoins);
  const focus = simplifyFocusLabel(rewardFocus);
  const rarity = simplifyRarityHint(rarityHint);

  const base: Record<ChestTier, { name: string; copy: string; ribbon?: string }> = {
    green: {
      name: "Scout Chest",
      copy: "Entry chest with fast squad-building rewards.",
    },
    blue: {
      name: "Club Chest",
      copy: "Balanced club growth rewards and upgrades.",
    },
    purple: {
      name: "Elite Chest",
      copy: "Higher-tier chest tuned for stronger pulls.",
    },
    epic: {
      name: "Pro Chest",
      copy: "Premium chest with elevated rare and epic value.",
    },
    gold: {
      name: "Champion Chest",
      copy: "High-value chest built for title pushes.",
    },
    legend: {
      name: "Legends Vault",
      copy: "Top-tier vault with the best reward ceiling.",
      ribbon: "Top Tier",
    },
  };

  return {
    tier,
    name: base[tier].name,
    copy: base[tier].copy,
    focus,
    rarity,
    ribbon: base[tier].ribbon,
  };
}

function getChestTier(priceCoins: number): ChestTier {
  if (priceCoins <= 250) return "green";
  if (priceCoins <= 500) return "blue";
  if (priceCoins <= 1000) return "purple";
  if (priceCoins <= 2500) return "epic";
  if (priceCoins <= 5000) return "gold";
  return "legend";
}

function simplifyFocusLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "Balanced";
  if (normalized.includes("exp")) return "EXP Chest";
  if (normalized.includes("player")) return "Player Chest";
  if (normalized.includes("coin")) return "Coin Chest";
  if (normalized.includes("balance")) return "Balanced";
  if (normalized.length > 22) {
    return `${value.slice(0, 22).trim()}...`;
  }
  return value;
}

function simplifyRarityHint(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "Balanced Odds";
  if (normalized.length > 26) {
    return `${normalized.slice(0, 26).trim()}...`;
  }
  return normalized;
}
