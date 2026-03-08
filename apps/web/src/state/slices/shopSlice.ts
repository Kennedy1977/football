import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PackDefinition } from "../../../../../packages/game-core/src";

interface ShopState {
  packs: PackDefinition[];
  activePurchaseId: number | null;
  pendingRewardIds: number[];
}

const initialState: ShopState = {
  packs: [],
  activePurchaseId: null,
  pendingRewardIds: [],
};

const shopSlice = createSlice({
  name: "shop",
  initialState,
  reducers: {
    setPacks(state, action: PayloadAction<PackDefinition[]>) {
      state.packs = action.payload;
    },
    setPurchaseState(state, action: PayloadAction<{ purchaseId: number; rewardIds: number[] }>) {
      state.activePurchaseId = action.payload.purchaseId;
      state.pendingRewardIds = action.payload.rewardIds;
    },
    clearPurchaseState(state) {
      state.activePurchaseId = null;
      state.pendingRewardIds = [];
    },
  },
});

export const { setPacks, setPurchaseState, clearPurchaseState } = shopSlice.actions;
export const shopReducer = shopSlice.reducer;
