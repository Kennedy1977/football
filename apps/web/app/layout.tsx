import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { AppNav } from "../src/components/app-nav";
import { AuthControls } from "../src/components/auth-controls";
import { AuthSessionSync } from "../src/components/auth-session-sync";
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
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">Football Manager Arcade</h1>
          <p className="app-subtitle">Build your club, play 3-minute matches, climb to Legends.</p>
          <div className="header-actions">
            <AppNav />
            {clerkConfigured ? <AuthControls /> : null}
          </div>
        </header>
        {children}
      </div>
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
