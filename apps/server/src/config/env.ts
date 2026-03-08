import path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: process.env.ENV_FILE || path.resolve(process.cwd(), ".env"),
  quiet: true,
});

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readRequired(value: string | undefined, key: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Missing required environment variable: ${key}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  apiPort: readNumber(process.env.API_PORT || process.env.PORT, 4000),
  appUrl: process.env.APP_URL || "http://localhost:3000",
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:4000/api",
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: readNumber(process.env.DB_PORT, 3306),
  dbName: process.env.DB_NAME || "u749960985_football",
  dbUser: readRequired(process.env.DB_USER, "DB_USER"),
  dbPassword: readRequired(process.env.DB_PASSWORD, "DB_PASSWORD"),
};
