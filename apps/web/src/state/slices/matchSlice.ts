import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ArcadeTeamRatings,
  MatchChanceEvent,
  MatchRuntimeResult,
  MatchResult,
  StartMatchResponse,
  SubmitMatchResponse,
} from "../../../../../packages/game-core/src";

interface MatchPrepState {
  matchSeed: string;
  opponentClubId: number;
  opponentName: string;
  yourHomeKitColor: string;
  yourAwayKitColor: string;
  opponentHomeKitColor: string;
  opponentAwayKitColor: string;
  yourFormation: string;
  opponentFormation: string;
  yourTeamOverall: number;
  opponentTeamOverall: number;
  yourArcadeRatings: ArcadeTeamRatings;
  opponentArcadeRatings: ArcadeTeamRatings;
  yourRank: number;
  opponentRank: number;
}

interface MatchState {
  activeMatchSeed: string | null;
  opponentClubId: number | null;
  matchPrep: MatchPrepState | null;
  events: MatchChanceEvent[];
  runtimeResult: MatchRuntimeResult | null;
  result: MatchResult | null;
  lastSubmission: SubmitMatchResponse | null;
}

const initialState: MatchState = {
  activeMatchSeed: null,
  opponentClubId: null,
  matchPrep: null,
  events: [],
  runtimeResult: null,
  result: null,
  lastSubmission: null,
};

const matchSlice = createSlice({
  name: "match",
  initialState,
  reducers: {
    startMatchState(state, action: PayloadAction<{ matchSeed: string; opponentClubId: number }>) {
      state.activeMatchSeed = action.payload.matchSeed;
      state.opponentClubId = action.payload.opponentClubId;
      state.events = [];
      state.runtimeResult = null;
      state.result = null;
      state.lastSubmission = null;
    },
    setMatchPrep(state, action: PayloadAction<StartMatchResponse>) {
      state.activeMatchSeed = action.payload.matchSeed;
      state.opponentClubId = action.payload.opponent.clubId;
      state.matchPrep = {
        matchSeed: action.payload.matchSeed,
        opponentClubId: action.payload.opponent.clubId,
        opponentName: action.payload.opponent.name,
        yourHomeKitColor: action.payload.yourClub.homeKitColor,
        yourAwayKitColor: action.payload.yourClub.awayKitColor,
        opponentHomeKitColor: action.payload.opponent.homeKitColor,
        opponentAwayKitColor: action.payload.opponent.awayKitColor,
        yourFormation: action.payload.yourClub.formation || "4-4-2",
        opponentFormation: action.payload.opponent.formation || "4-4-2",
        yourTeamOverall: action.payload.yourClub.teamOverall,
        opponentTeamOverall: action.payload.opponent.teamOverall,
        yourArcadeRatings: action.payload.yourClub.arcadeRatings,
        opponentArcadeRatings: action.payload.opponent.arcadeRatings,
        yourRank: action.payload.yourClub.rank,
        opponentRank: action.payload.opponent.rank,
      };
      state.events = [];
      state.runtimeResult = null;
      state.result = null;
      state.lastSubmission = null;
    },
    setMatchEvents(state, action: PayloadAction<MatchChanceEvent[]>) {
      state.events = action.payload;
    },
    setMatchRuntimeResult(state, action: PayloadAction<MatchRuntimeResult | null>) {
      state.runtimeResult = action.payload;
    },
    finishMatchState(state, action: PayloadAction<MatchResult>) {
      state.result = action.payload;
    },
    setMatchSubmission(state, action: PayloadAction<SubmitMatchResponse>) {
      state.lastSubmission = action.payload;
      state.result = action.payload.result;
    },
    clearMatchState(state) {
      state.activeMatchSeed = null;
      state.opponentClubId = null;
      state.matchPrep = null;
      state.events = [];
      state.runtimeResult = null;
      state.result = null;
      state.lastSubmission = null;
    },
  },
});

export const {
  startMatchState,
  setMatchPrep,
  setMatchEvents,
  setMatchRuntimeResult,
  finishMatchState,
  setMatchSubmission,
  clearMatchState,
} = matchSlice.actions;
export const matchReducer = matchSlice.reducer;
