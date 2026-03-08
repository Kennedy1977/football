import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MatchChanceEvent, MatchResult } from "../../../../../packages/game-core/src";

interface MatchState {
  activeMatchSeed: string | null;
  opponentClubId: number | null;
  events: MatchChanceEvent[];
  result: MatchResult | null;
}

const initialState: MatchState = {
  activeMatchSeed: null,
  opponentClubId: null,
  events: [],
  result: null,
};

const matchSlice = createSlice({
  name: "match",
  initialState,
  reducers: {
    startMatchState(state, action: PayloadAction<{ matchSeed: string; opponentClubId: number }>) {
      state.activeMatchSeed = action.payload.matchSeed;
      state.opponentClubId = action.payload.opponentClubId;
      state.events = [];
      state.result = null;
    },
    setMatchEvents(state, action: PayloadAction<MatchChanceEvent[]>) {
      state.events = action.payload;
    },
    finishMatchState(state, action: PayloadAction<MatchResult>) {
      state.result = action.payload;
    },
    clearMatchState(state) {
      state.activeMatchSeed = null;
      state.opponentClubId = null;
      state.events = [];
      state.result = null;
    },
  },
});

export const { startMatchState, setMatchEvents, finishMatchState, clearMatchState } = matchSlice.actions;
export const matchReducer = matchSlice.reducer;
