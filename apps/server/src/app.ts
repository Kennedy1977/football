import express from "express";
import { clerkMiddleware } from "@clerk/express";
import { pool } from "./config/db";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { createApiRouter } from "./routes";

const app = express();

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

if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}
app.use("/api", createApiRouter());
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.apiPort, () => {
  console.log(`API server running on http://localhost:${env.apiPort}`);
});
