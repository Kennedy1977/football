import type { SerializedError } from "@reduxjs/toolkit";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === "object" && error !== null && "status" in error;
}

function isSerializedError(error: unknown): error is SerializedError {
  return typeof error === "object" && error !== null && "message" in error;
}

export function readApiErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (isFetchBaseQueryError(error)) {
    const data = error.data;
    if (typeof data === "string" && data.trim()) {
      return data;
    }

    if (typeof data === "object" && data !== null && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }

    return `Request failed (${String(error.status)})`;
  }

  if (isSerializedError(error) && typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unknown request error";
}

export function isAccountMissingError(error: unknown): boolean {
  const message = readApiErrorMessage(error);
  if (!message) {
    return false;
  }

  return message.includes("Account not found for provided Clerk user id");
}
