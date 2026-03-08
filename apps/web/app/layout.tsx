import type { Metadata } from "next";
import { AppNav } from "../src/components/app-nav";
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
        <StoreProvider>
          <div className="app-shell">
            <header className="app-header">
              <h1 className="app-title">Football Manager Arcade</h1>
              <p className="app-subtitle">Build your club, play 3-minute matches, climb to Legends.</p>
              <AppNav />
            </header>
            {children}
          </div>
        </StoreProvider>
      </body>
    </html>
  );
}
