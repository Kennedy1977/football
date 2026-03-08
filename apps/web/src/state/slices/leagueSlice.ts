import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface LeagueState {
  leagueCode: string | null;
  userRank: number | null;
  legendsDivision: number | null;
}

const initialState: LeagueState = {
  leagueCode: null,
  userRank: null,
  legendsDivision: null,
};

const leagueSlice = createSlice({
  name: "league",
  initialState,
  reducers: {
    setLeagueSnapshot(
      state,
      action: PayloadAction<{ leagueCode: string; userRank: number; legendsDivision: number | null }>
    ) {
      state.leagueCode = action.payload.leagueCode;
      state.userRank = action.payload.userRank;
      state.legendsDivision = action.payload.legendsDivision;
    },
  },
});

export const { setLeagueSnapshot } = leagueSlice.actions;
export const leagueReducer = leagueSlice.reducer;
