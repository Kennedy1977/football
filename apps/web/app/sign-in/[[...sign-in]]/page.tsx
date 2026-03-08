import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="page-panel">
      <h2 className="page-title">Sign In</h2>
      <p className="page-copy">Use email/password or social login to continue.</p>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </main>
  );
}
