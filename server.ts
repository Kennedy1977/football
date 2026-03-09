import path from "node:path";
import dotenv from "dotenv";
import express from "express";
import next from "next";
import { clerkMiddleware } from "@clerk/express";
import { pool } from "./apps/server/src/config/db";
import { errorHandler, notFoundHandler } from "./apps/server/src/middleware/error-handler";
import { createApiRouter } from "./apps/server/src/routes";

dotenv.config({
  path: process.env.ENV_FILE || path.resolve(process.cwd(), ".env"),
  quiet: true,
});

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || process.env.API_PORT || 3000);
const appUrl = process.env.APP_URL || `http://localhost:${port}`;
const apiBaseUrl = process.env.API_BASE_URL || `${appUrl}/api`;

const nextApp = next({
  dev,
  dir: path.join(process.cwd(), "apps/web"),
});

const handle = nextApp.getRequestHandler();

async function start() {
  await nextApp.prepare();

  const server = express();
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  const clerkPublishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  server.set("trust proxy", 1);
  server.use(express.json());

  server.get("/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.status(200).json({
        ok: true,
        message: "Web and API process running",
        appUrl,
        apiBaseUrl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "DB unreachable";
      res.status(500).json({ ok: false, message });
    }
  });

  if (clerkSecretKey && clerkPublishableKey) {
    server.use(
      "/api",
      clerkMiddleware({
        secretKey: clerkSecretKey,
        publishableKey: clerkPublishableKey,
      })
    );
  } else if (clerkSecretKey && !clerkPublishableKey) {
    console.warn("CLERK_SECRET_KEY is set but publishable key is missing. Skipping Clerk middleware.");
  }
  server.use("/api", createApiRouter());
  server.use("/api", notFoundHandler);
  server.use("/api", errorHandler);

  server.use((req, res) => handle(req, res));

  server.listen(port, () => {
    console.log(`App server running on ${appUrl}`);
    console.log(`API available at ${apiBaseUrl}`);
  });
}

start().catch((error) => {
  console.error("Failed to start app server:", error);
  process.exit(1);
});
