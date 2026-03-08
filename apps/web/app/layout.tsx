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
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <StoreProvider>
            <AuthSessionSync />
            <div className="app-shell">
              <header className="app-header">
                <h1 className="app-title">Football Manager Arcade</h1>
                <p className="app-subtitle">Build your club, play 3-minute matches, climb to Legends.</p>
                <div className="header-actions">
                  <AppNav />
                  <AuthControls />
                </div>
              </header>
              {children}
            </div>
          </StoreProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
