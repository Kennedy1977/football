import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  ClubIdentityPayload,
  CreateManagerRequest,
  CreateManagerResponse,
  CreateOrResetClubResponse,
  DailyClaimResponse,
  DashboardSummaryResponse,
  GetPacksResponse,
  LeagueTableResponse,
  LegendsTableResponse,
  PromotionClaimResponse,
  PurchasePackRequest,
  PurchasePackResponse,
  RewardDecisionRequest,
  RewardDecisionResponse,
  SellPlayerRequest,
  SellPlayerResponse,
  SquadResponse,
  StartMatchResponse,
  SubmitMatchRequest,
  SubmitMatchResponse,
  UpdateLineupRequest,
  UpdateLineupResponse,
} from "../../../../../packages/game-core/src";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "/api";
}

export const gameApi = createApi({
  reducerPath: "gameApi",
  baseQuery: fetchBaseQuery({
    baseUrl: getApiBaseUrl(),
    prepareHeaders: (headers) => {
      const clerkUserId = process.env.NEXT_PUBLIC_DEV_CLERK_USER_ID || process.env.CLERK_USER_ID || "dev-local-user";
      headers.set("x-clerk-user-id", clerkUserId);
      headers.set("content-type", "application/json");
      return headers;
    },
  }),
  tagTypes: ["Dashboard", "Squad", "League", "Packs"],
  endpoints: (builder) => ({
    createManager: builder.mutation<CreateManagerResponse, CreateManagerRequest>({
      query: (body) => ({ url: "/onboarding/manager", method: "POST", body }),
      invalidatesTags: ["Dashboard"],
    }),
    createClub: builder.mutation<CreateOrResetClubResponse, ClubIdentityPayload>({
      query: (body) => ({ url: "/onboarding/club", method: "POST", body }),
      invalidatesTags: ["Dashboard", "Squad", "League"],
    }),
    resetClub: builder.mutation<CreateOrResetClubResponse, ClubIdentityPayload>({
      query: (body) => ({ url: "/onboarding/reset-club", method: "POST", body }),
      invalidatesTags: ["Dashboard", "Squad", "League", "Packs"],
    }),
    getDashboardSummary: builder.query<DashboardSummaryResponse, void>({
      query: () => ({ url: "/dashboard/summary" }),
      providesTags: ["Dashboard"],
    }),
    getSquad: builder.query<SquadResponse, void>({
      query: () => ({ url: "/squad/players" }),
      providesTags: ["Squad"],
    }),
    updateLineup: builder.mutation<UpdateLineupResponse, UpdateLineupRequest>({
      query: (body) => ({ url: "/squad/lineup", method: "PUT", body }),
      invalidatesTags: ["Squad", "Dashboard"],
    }),
    sellPlayer: builder.mutation<SellPlayerResponse, SellPlayerRequest>({
      query: (body) => ({ url: "/squad/sell", method: "POST", body }),
      invalidatesTags: ["Squad", "Dashboard"],
    }),
    startMatch: builder.mutation<StartMatchResponse, void>({
      query: () => ({ url: "/match/start", method: "POST" }),
    }),
    submitMatch: builder.mutation<SubmitMatchResponse, SubmitMatchRequest>({
      query: (body) => ({ url: "/match/submit", method: "POST", body }),
      invalidatesTags: ["Dashboard", "Squad", "League"],
    }),
    getPacks: builder.query<GetPacksResponse, void>({
      query: () => ({ url: "/shop/packs" }),
      providesTags: ["Packs"],
    }),
    purchasePack: builder.mutation<PurchasePackResponse, PurchasePackRequest>({
      query: (body) => ({ url: "/shop/packs/purchase", method: "POST", body }),
      invalidatesTags: ["Dashboard", "Packs", "Squad"],
    }),
    decidePackReward: builder.mutation<RewardDecisionResponse, RewardDecisionRequest>({
      query: (body) => ({ url: "/shop/packs/reward-decision", method: "POST", body }),
      invalidatesTags: ["Dashboard", "Packs", "Squad"],
    }),
    claimDailyReward: builder.mutation<DailyClaimResponse, void>({
      query: () => ({ url: "/rewards/daily-claim", method: "POST" }),
      invalidatesTags: ["Dashboard"],
    }),
    claimPromotionReward: builder.mutation<PromotionClaimResponse, void>({
      query: () => ({ url: "/rewards/promotion-claim", method: "POST" }),
      invalidatesTags: ["Dashboard", "League"],
    }),
    getLeagueTable: builder.query<LeagueTableResponse, void>({
      query: () => ({ url: "/league/table" }),
      providesTags: ["League"],
    }),
    getLegendsTable: builder.query<LegendsTableResponse, void>({
      query: () => ({ url: "/league/legends" }),
      providesTags: ["League"],
    }),
  }),
});

export const {
  useCreateManagerMutation,
  useCreateClubMutation,
  useResetClubMutation,
  useGetDashboardSummaryQuery,
  useGetSquadQuery,
  useUpdateLineupMutation,
  useSellPlayerMutation,
  useStartMatchMutation,
  useSubmitMatchMutation,
  useGetPacksQuery,
  usePurchasePackMutation,
  useDecidePackRewardMutation,
  useClaimDailyRewardMutation,
  useClaimPromotionRewardMutation,
  useGetLeagueTableQuery,
  useGetLegendsTableQuery,
} = gameApi;
