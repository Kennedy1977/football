import { Router } from "express";
import { authRouter } from "./auth.routes";
import { onboardingRouter } from "./onboarding.routes";
import { dashboardRouter } from "./dashboard.routes";
import { squadRouter } from "./squad.routes";
import { matchRouter } from "./match.routes";
import { shopRouter } from "./shop.routes";
import { rewardsRouter } from "./rewards.routes";
import { leagueRouter } from "./league.routes";

export function createApiRouter(): Router {
  const api = Router();

  api.use("/auth", authRouter);
  api.use("/onboarding", onboardingRouter);
  api.use("/dashboard", dashboardRouter);
  api.use("/squad", squadRouter);
  api.use("/match", matchRouter);
  api.use("/shop", shopRouter);
  api.use("/rewards", rewardsRouter);
  api.use("/league", leagueRouter);

  return api;
}
