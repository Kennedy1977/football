"use client";

import { useState } from "react";
import {
  useDecidePackRewardMutation,
  useGetPacksQuery,
  usePurchasePackMutation,
} from "../../src/state/apis/gameApi";
import { toRarityFrame } from "../../src/lib/rarity-frame";

type ChestTier = "green" | "blue" | "purple" | "epic" | "gold" | "legend";

export default function ShopPage() {
  const { data, isLoading, error, refetch } = useGetPacksQuery();
  const [purchasePack, purchaseState] = usePurchasePackMutation();
  const [decideReward, rewardDecisionState] = useDecidePackRewardMutation();
  const [purchasingPackId, setPurchasingPackId] = useState<number | null>(null);
  const [lastRewards, setLastRewards] = useState<
    Array<{
      rewardId: number;
      playerName: string;
      rarity: string;
      overall: number;
      keepAvailable: boolean;
      convertCoins: number;
      convertExp: number;
    }>
  >([]);

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
                      const response = await purchasePack({ packId: pack.id }).unwrap();
                      setLastRewards(
                        response.rewards.map((reward) => ({
                          rewardId: reward.rewardId,
                          playerName: reward.player.name,
                          rarity: reward.player.rarity,
                          overall: reward.player.overall,
                          keepAvailable: reward.keepAvailable,
                          convertCoins: reward.convertCoins,
                          convertExp: reward.convertExp,
                        }))
                      );
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

      {lastRewards.length ? (
        <section className="onboarding-card section-pad" style={{ marginTop: 16 }}>
          <h3>Chest Opened</h3>
          <div className="player-grid">
            {lastRewards.map((reward) => (
              <article key={reward.rewardId} className={`player-card rarity-${toRarityFrame(reward.rarity)}`}>
                <div className="player-card-head">
                  <div>
                    <h3>{reward.playerName}</h3>
                    <p>{reward.rarity}</p>
                  </div>
                  <div className="player-overall">{reward.overall}</div>
                </div>
                <div className="inline">
                  <button
                    type="button"
                    disabled={rewardDecisionState.isLoading || !reward.keepAvailable}
                    onClick={async () => {
                      await decideReward({ rewardId: reward.rewardId, decision: "KEEP" }).unwrap();
                    }}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    disabled={rewardDecisionState.isLoading}
                    onClick={async () => {
                      await decideReward({ rewardId: reward.rewardId, decision: "CONVERT_COINS" }).unwrap();
                    }}
                  >
                    +{reward.convertCoins} Coins
                  </button>
                </div>
              </article>
            ))}
          </div>
          {rewardDecisionState.isError && <p className="feedback error">Reward decision failed.</p>}
          {rewardDecisionState.isSuccess && <p className="feedback">Reward decision saved.</p>}
        </section>
      ) : null}

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

  const base = {
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
  } satisfies Record<ChestTier, { name: string; copy: string; ribbon?: string }>;

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
  if (normalized.includes("exp")) return "EXP Focus";
  if (normalized.includes("player")) return "Player Focus";
  if (normalized.includes("coin")) return "Coin Focus";
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
