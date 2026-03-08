import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: "Route not found" });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ message: err.message, details: err.details || null });
    return;
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(500).json({ message });
}
