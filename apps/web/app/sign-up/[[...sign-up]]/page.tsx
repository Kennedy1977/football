import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <main className="page-panel">
        <h2 className="page-title">Create Account</h2>
        <p className="feedback error">
          Clerk is not configured. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in deployment env.
        </p>
      </main>
    );
  }

  return (
    <main className="page-panel">
      <h2 className="page-title">Create Account</h2>
      <p className="page-copy">Create your account first, then build your manager and club.</p>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </main>
  );
}
