"use client";

import { useState } from "react";
import {
  useDecidePackRewardMutation,
  useGetPacksQuery,
  usePurchasePackMutation,
} from "../../src/state/apis/gameApi";
import { ProgressRow } from "../../src/components/progress-row";

export default function ShopPage() {
  const { data, isLoading, error, refetch } = useGetPacksQuery();
  const [purchasePack, purchaseState] = usePurchasePackMutation();
  const [decideReward, rewardDecisionState] = useDecidePackRewardMutation();
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
      <h2 className="page-title">Shop & Packs</h2>
      <p className="page-copy">Purchase packs, then keep players or convert for coins/EXP.</p>

      <div className="inline" style={{ marginBottom: 10 }}>
        <button type="button" onClick={() => refetch()}>
          Refresh Packs
        </button>
      </div>

      {isLoading && <p className="feedback">Loading packs...</p>}
      {error && <p className="feedback error">Unable to load pack catalogue.</p>}

      {data?.packs?.length ? (
        <section className="pack-grid">
          {data.packs.map((pack) => (
            <article key={pack.id} className="pack-card">
              <div className="pack-card-head">
                <h3>{pack.priceCoins}</h3>
                <p>coins</p>
              </div>
              <p className="pack-name">{pack.name}</p>
              <div className="inline">
                <span className="label-pill">{pack.rewardCount} rewards</span>
                <span className="label-pill">{pack.rewardFocus}</span>
              </div>
              <div className="progress-stack compact">
                <ProgressRow
                  label="Rarity Bias"
                  value={pack.name.includes("Legends") ? 90 : pack.name.includes("Champion") ? 72 : 55}
                  valueText={pack.rarityHint}
                  tone="violet"
                />
              </div>
              <button
                type="button"
                disabled={purchaseState.isLoading}
                onClick={async () => {
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
                }}
              >
                {purchaseState.isLoading ? "Buying..." : "Buy Pack"}
              </button>
            </article>
          ))}
        </section>
      ) : null}

      {purchaseState.isError && <p className="feedback error">Pack purchase failed.</p>}

      {lastRewards.length ? (
        <section className="onboarding-card section-pad" style={{ marginTop: 16 }}>
          <h3>Pack Opened</h3>
          <div className="player-grid">
            {lastRewards.map((reward) => (
              <article key={reward.rewardId} className="player-card">
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
