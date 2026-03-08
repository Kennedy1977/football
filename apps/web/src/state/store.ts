import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { gameApi } from "./apis/gameApi";
import { authReducer } from "./slices/authSlice";
import { clubReducer } from "./slices/clubSlice";
import { leagueReducer } from "./slices/leagueSlice";
import { matchReducer } from "./slices/matchSlice";
import { rewardsReducer } from "./slices/rewardsSlice";
import { shopReducer } from "./slices/shopSlice";
import { squadReducer } from "./slices/squadSlice";
import { uiReducer } from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    [gameApi.reducerPath]: gameApi.reducer,
    auth: authReducer,
    club: clubReducer,
    squad: squadReducer,
    match: matchReducer,
    league: leagueReducer,
    shop: shopReducer,
    rewards: rewardsReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(gameApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
