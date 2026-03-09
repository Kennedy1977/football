import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn } from "@clerk/nextjs";
import { ClerkDiagnostics } from "../../../src/components/clerk-diagnostics";

export default function SignInPage() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!publishableKey) {
    return (
      <main className="page-panel">
        <h2 className="page-title">Sign In</h2>
        <p className="feedback error">
          Clerk is not configured. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in deployment env.
        </p>
      </main>
    );
  }

  return (
    <main className="page-panel page-panel-portrait">
      <h2 className="page-title">Sign In</h2>
      <p className="page-copy">Use email/password or social login to continue.</p>
      <ClerkLoading>
        <p className="feedback">Loading sign-in form...</p>
      </ClerkLoading>
      <ClerkDiagnostics publishableKey={publishableKey} />
      <ClerkFailed>
        <p className="feedback error">
          Clerk failed to load. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and allowed domain in Clerk.
        </p>
      </ClerkFailed>
      <ClerkLoaded>
        <div className="clerk-card-wrap">
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
        </div>
      </ClerkLoaded>
    </main>
  );
}
