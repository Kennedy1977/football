import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
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
    <main className="page-panel">
      <h2 className="page-title">Sign In</h2>
      <p className="page-copy">Use email/password or social login to continue.</p>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </main>
  );
}
