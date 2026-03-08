"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useSyncAuthSessionMutation } from "../state/apis/gameApi";
import { clearAuth, setAuth } from "../state/slices/authSlice";

function readPrimaryEmail(user: ReturnType<typeof useUser>["user"]): string | undefined {
  if (!user) {
    return undefined;
  }

  return user.primaryEmailAddress?.emailAddress || user.emailAddresses[0]?.emailAddress || undefined;
}

export function AuthSessionSync() {
  const dispatch = useDispatch();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [syncAuthSession] = useSyncAuthSessionMutation();
  const lastSyncedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn || !userId) {
      dispatch(clearAuth());
      lastSyncedKeyRef.current = null;
      return;
    }

    dispatch(setAuth({ clerkUserId: userId }));

    const email = readPrimaryEmail(user);
    if (!email) {
      return;
    }

    const syncKey = `${userId}:${email}`;
    if (lastSyncedKeyRef.current === syncKey) {
      return;
    }

    lastSyncedKeyRef.current = syncKey;
    void syncAuthSession({
      clerkUserId: userId,
      email,
    })
      .unwrap()
      .catch(() => {
        // Keep UI responsive and avoid auth deadlock; screens handle API errors explicitly.
      });
  }, [dispatch, isLoaded, isSignedIn, syncAuthSession, user, userId]);

  return null;
}
