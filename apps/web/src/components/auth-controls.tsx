"use client";

import { SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";

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
        <UserButton />
      )}
    </div>
  );
}
