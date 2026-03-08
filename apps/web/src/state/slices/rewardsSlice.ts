import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface RewardsState {
  dailyClaimed: boolean;
  nextDailyResetAt: string | null;
  lastPromotionFrom: string | null;
  lastPromotionTo: string | null;
}

const initialState: RewardsState = {
  dailyClaimed: false,
  nextDailyResetAt: null,
  lastPromotionFrom: null,
  lastPromotionTo: null,
};

const rewardsSlice = createSlice({
  name: "rewards",
  initialState,
  reducers: {
    setDailyRewardState(state, action: PayloadAction<{ claimed: boolean; nextResetAt: string }>) {
      state.dailyClaimed = action.payload.claimed;
      state.nextDailyResetAt = action.payload.nextResetAt;
    },
    setPromotionState(state, action: PayloadAction<{ fromLeague: string; toLeague: string }>) {
      state.lastPromotionFrom = action.payload.fromLeague;
      state.lastPromotionTo = action.payload.toLeague;
    },
  },
});

export const { setDailyRewardState, setPromotionState } = rewardsSlice.actions;
export const rewardsReducer = rewardsSlice.reducer;
