"use client";

import Link from "next/link";
import { SignInButton, SignOutButton, SignUpButton, useAuth } from "@clerk/nextjs";

export function AuthControls() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <div className="auth-controls" />;
  }

  return (
    <div className="auth-controls">
      {!isSignedIn ? (
        <>
          <SignInButton mode="modal">
            <button type="button">Sign In</button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button type="button">Create Account</button>
          </SignUpButton>
        </>
      ) : (
        <>
          <Link href="/profile" className="btn">
            Account
          </Link>
          <SignOutButton>
            <button type="button">Sign Out</button>
          </SignOutButton>
        </>
      )}
    </div>
  );
}
