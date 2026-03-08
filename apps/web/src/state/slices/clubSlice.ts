import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ApiClubSummary, ApiManagerSummary } from "../../../../../packages/game-core/src";

interface ClubState {
  manager: ApiManagerSummary | null;
  club: ApiClubSummary | null;
  onboardingComplete: boolean;
}

const initialState: ClubState = {
  manager: null,
  club: null,
  onboardingComplete: false,
};

const clubSlice = createSlice({
  name: "club",
  initialState,
  reducers: {
    setClubSnapshot(
      state,
      action: PayloadAction<{ manager: ApiManagerSummary | null; club: ApiClubSummary | null; onboardingComplete: boolean }>
    ) {
      state.manager = action.payload.manager;
      state.club = action.payload.club;
      state.onboardingComplete = action.payload.onboardingComplete;
    },
    clearClubSnapshot(state) {
      state.manager = null;
      state.club = null;
      state.onboardingComplete = false;
    },
  },
});

export const { setClubSnapshot, clearClubSnapshot } = clubSlice.actions;
export const clubReducer = clubSlice.reducer;
