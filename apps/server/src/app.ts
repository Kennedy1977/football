import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { pool } from "./config/db";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { createApiRouter } from "./routes";

const app = express();
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

app.set("trust proxy", 1);
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      ok: true,
      message: "API and DB reachable",
      appUrl: env.appUrl,
      apiBaseUrl: env.apiBaseUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "DB unreachable";
    res.status(500).json({ ok: false, message });
  }
});

if (clerkSecretKey && clerkPublishableKey) {
  app.use(
    clerkMiddleware({
      secretKey: clerkSecretKey,
      publishableKey: clerkPublishableKey,
    })
  );
} else if (clerkSecretKey && !clerkPublishableKey) {
  console.warn("CLERK_SECRET_KEY is set but publishable key is missing. Skipping Clerk middleware.");
}
app.use("/api", createApiRouter());
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.apiPort, () => {
  console.log(`API server running on http://localhost:${env.apiPort}`);
});
