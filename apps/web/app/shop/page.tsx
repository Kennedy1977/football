"use client";

import { useState } from "react";
import {
  useDecidePackRewardMutation,
  useGetPacksQuery,
  usePurchasePackMutation,
} from "../../src/state/apis/gameApi";

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
    <main className="page-panel">
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
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Pack</th>
                <th>Price</th>
                <th>Rewards</th>
                <th>Hint</th>
                <th>Focus</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.packs.map((pack) => (
                <tr key={pack.id}>
                  <td>{pack.name}</td>
                  <td>{pack.priceCoins}</td>
                  <td>{pack.rewardCount}</td>
                  <td>{pack.rarityHint}</td>
                  <td>{pack.rewardFocus}</td>
                  <td>
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
                      {purchaseState.isLoading ? "Buying..." : "Buy"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {purchaseState.isError && <p className="feedback error">Pack purchase failed.</p>}

      {lastRewards.length ? (
        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px" }}>Latest Pack Rewards</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Rarity</th>
                  <th>Ovr</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lastRewards.map((reward) => (
                  <tr key={reward.rewardId}>
                    <td>{reward.playerName}</td>
                    <td>{reward.rarity}</td>
                    <td>{reward.overall}</td>
                    <td>
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rewardDecisionState.isError && <p className="feedback error">Reward decision failed.</p>}
          {rewardDecisionState.isSuccess && <p className="feedback">Reward decision saved.</p>}
        </section>
      ) : null}
    </main>
  );
}
