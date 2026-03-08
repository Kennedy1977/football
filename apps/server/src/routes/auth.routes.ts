import { Router } from "express";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db";
import { readClerkUserId } from "../lib/auth";
import { HttpError } from "../lib/errors";
import { asyncHandler } from "../middleware/async-handler";

export const authRouter = Router();

interface AccountRow extends RowDataPacket {
  id: number;
  clerk_user_id: string;
  email: string;
}

authRouter.post(
  "/session",
  asyncHandler(async (req, res) => {
    const clerkUserId = readClerkUserId(req);
    const email = readOptionalEmail(req.body?.email);
    const confirmLink = req.body?.confirmLink === true;

    const [existingByClerkRows] = await pool.query<AccountRow[]>(
      "SELECT id, clerk_user_id, email FROM accounts WHERE clerk_user_id = ? LIMIT 1",
      [clerkUserId]
    );

    if (existingByClerkRows.length) {
      const account = existingByClerkRows[0];
      if (email && account.email !== email) {
        await pool.execute("UPDATE accounts SET email = ? WHERE id = ?", [email, account.id]);
        account.email = email;
      }

      res.status(200).json({
        synced: true,
        created: false,
        linkedExistingEmail: false,
        account: {
          id: account.id,
          clerkUserId: account.clerk_user_id,
          email: account.email,
        },
      });
      return;
    }

    if (!email) {
      throw new HttpError(400, "email is required to create account on first sign-in");
    }

    const [existingByEmailRows] = await pool.query<AccountRow[]>(
      "SELECT id, clerk_user_id, email FROM accounts WHERE email = ? LIMIT 1",
      [email]
    );

    if (existingByEmailRows.length) {
      const account = existingByEmailRows[0];

      if (!confirmLink) {
        throw new HttpError(409, "Account link confirmation required", {
          code: "ACCOUNT_LINK_REQUIRED",
          existingClerkUserId: account.clerk_user_id,
          email: account.email,
        });
      }

      await pool.execute("UPDATE accounts SET clerk_user_id = ?, email = ? WHERE id = ?", [clerkUserId, email, account.id]);
      res.status(200).json({
        synced: true,
        created: false,
        linkedExistingEmail: true,
        account: {
          id: account.id,
          clerkUserId,
          email,
        },
      });
      return;
    }

    const [insertResult] = await pool.execute<ResultSetHeader>(
      "INSERT INTO accounts (clerk_user_id, email) VALUES (?, ?)",
      [clerkUserId, email]
    );

    res.status(201).json({
      synced: true,
      created: true,
      linkedExistingEmail: false,
      account: {
        id: insertResult.insertId,
        clerkUserId,
        email,
      },
    });
  })
);

function readOptionalEmail(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.length > 255) {
    throw new HttpError(400, "email exceeds 255 characters");
  }

  if (!normalized.includes("@") || normalized.startsWith("@") || normalized.endsWith("@")) {
    throw new HttpError(400, "email is not valid");
  }

  return normalized;
}
