import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="page-panel">
      <h2 className="page-title">Create Account</h2>
      <p className="page-copy">Create your account first, then build your manager and club.</p>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </main>
  );
}
