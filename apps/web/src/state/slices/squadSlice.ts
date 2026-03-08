import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ApiPlayerSummary, FormationCode } from "../../../../../packages/game-core/src";

interface SquadState {
  players: ApiPlayerSummary[];
  formation: FormationCode | null;
  startingPlayerIds: number[];
  benchPlayerIds: number[];
  comparePlayerId: number | null;
}

const initialState: SquadState = {
  players: [],
  formation: null,
  startingPlayerIds: [],
  benchPlayerIds: [],
  comparePlayerId: null,
};

const squadSlice = createSlice({
  name: "squad",
  initialState,
  reducers: {
    setSquad(
      state,
      action: PayloadAction<{
        players: ApiPlayerSummary[];
        formation: FormationCode | null;
        startingPlayerIds: number[];
        benchPlayerIds: number[];
      }>
    ) {
      state.players = action.payload.players;
      state.formation = action.payload.formation;
      state.startingPlayerIds = action.payload.startingPlayerIds;
      state.benchPlayerIds = action.payload.benchPlayerIds;
    },
    setComparePlayerId(state, action: PayloadAction<number | null>) {
      state.comparePlayerId = action.payload;
    },
  },
});

export const { setSquad, setComparePlayerId } = squadSlice.actions;
export const squadReducer = squadSlice.reducer;
