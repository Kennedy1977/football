import type { Request } from "express";
import type { RowDataPacket } from "mysql2";
import { getAuth } from "@clerk/express";
import { pool } from "../config/db";
import { HttpError } from "./errors";

interface AccountRow extends RowDataPacket {
  id: number;
  clerk_user_id: string;
}

export function readClerkUserId(req: Request): string {
  try {
    const auth = getAuth(req);
    if (auth.userId) {
      return auth.userId;
    }
  } catch {
    // Fallback path for local scripts where Clerk middleware is not mounted.
  }

  const fromHeader = req.header("x-clerk-user-id");
  const fromBody = typeof req.body?.clerkUserId === "string" ? req.body.clerkUserId : undefined;
  const clerkUserId = fromHeader || fromBody;

  if (!clerkUserId) {
    throw new HttpError(401, "Missing authenticated Clerk user id");
  }

  return clerkUserId;
}

export async function requireAccountId(req: Request): Promise<number> {
  const clerkUserId = readClerkUserId(req);

  const [rows] = await pool.query<AccountRow[]>(
    "SELECT id, clerk_user_id FROM accounts WHERE clerk_user_id = ? LIMIT 1",
    [clerkUserId]
  );

  if (!rows.length) {
    throw new HttpError(401, "Account not found for provided Clerk user id");
  }

  return rows[0].id;
}
