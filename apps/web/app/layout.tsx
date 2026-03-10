import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AuthSessionSync } from "../src/components/auth-session-sync";
import { AppFrame } from "../src/components/app-frame";
import { BuildFooter } from "../src/components/build-footer";
import { ContextMenuGuard } from "../src/components/context-menu-guard";
import { StoreProvider } from "../src/state/store-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Football Manager Arcade",
  description: "Stylised football manager arcade game",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const appShell = (
    <StoreProvider>
      {clerkConfigured ? <AuthSessionSync /> : null}
      <ContextMenuGuard />
      <AppFrame clerkConfigured={clerkConfigured}>{children}</AppFrame>
      <BuildFooter />
    </StoreProvider>
  );

  return (
    <html lang="en">
      <body>
        {clerkConfigured ? <ClerkProvider>{appShell}</ClerkProvider> : appShell}
      </body>
    </html>
  );
}
