"use client";

import { SignInButton, SignOutButton, SignUpButton, useAuth } from "@clerk/nextjs";
import {
  Bell,
  CircleHelp,
  House,
  LogOut,
  Menu,
  Settings,
  Shield,
  ShoppingBag,
  Trophy,
  WalletCards,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useGetDashboardSummaryQuery } from "../state/apis/gameApi";
import { ManagerAvatar } from "./manager-avatar";

interface AppFrameProps {
  children: React.ReactNode;
  clerkConfigured: boolean;
}

const drawerLinks = [
  { href: "/home", label: "Home", icon: House },
  { href: "/squad", label: "Squad", icon: Users },
  { href: "/league", label: "League", icon: Trophy },
  { href: "/playercards", label: "Cards", icon: WalletCards },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/help", label: "Help", icon: CircleHelp },
];

const bottomLinks = [
  { href: "/home", label: "Home", icon: House },
  { href: "/squad", label: "Squad", icon: Users },
  { href: "/match/prep", label: "Match", icon: Shield },
  { href: "/league", label: "League", icon: Trophy },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
];

export function AppFrame({ children, clerkConfigured }: AppFrameProps) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { data: dashboardSummary } = useGetDashboardSummaryQuery();
  const manager = dashboardSummary?.manager;

  useEffect(() => {
    setIsDrawerOpen(false);
  }, [pathname]);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setIsDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className="app-topbar-title">
          <p>Football Manager Arcade</p>
        </div>
        <div className="app-topbar-actions">
          <button type="button" className="icon-btn icon-btn-muted" aria-label="Notifications">
            <Bell size={18} />
          </button>
          <Link
            href="/profile"
            className={`icon-btn ${isActivePath(pathname, "/profile") ? "is-active" : ""}`}
            aria-label="Profile"
          >
            <ManagerAvatar avatar={manager?.avatar} name={manager?.name} className="topbar-profile-avatar" />
          </Link>
        </div>
      </header>

      <button
        type="button"
        className={`drawer-backdrop ${isDrawerOpen ? "is-open" : ""}`}
        onClick={() => setIsDrawerOpen(false)}
        aria-label="Close menu"
      />

      <aside className={`app-drawer ${isDrawerOpen ? "is-open" : ""}`} aria-hidden={!isDrawerOpen}>
        <div className="app-drawer-head">
          <h2>Menu</h2>
          <button type="button" className="icon-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Close menu">
            <Menu size={18} />
          </button>
        </div>

        <nav className="drawer-links" aria-label="Main menu">
          {drawerLinks.map((link) => {
            const Icon = link.icon;
            const active = isActivePath(pathname, link.href);
            return (
              <Link key={link.href} href={link.href} className={`drawer-link ${active ? "is-active" : ""}`}>
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {clerkConfigured ? <DrawerAuthActions /> : null}
      </aside>

      {children}

      <nav className="bottom-nav" aria-label="Bottom navigation">
        {bottomLinks.map((link) => {
          const Icon = link.icon;
          const active = isActivePath(pathname, link.href);
          return (
            <Link key={link.href} href={link.href} className={`bottom-nav-link ${active ? "is-active" : ""}`}>
              <Icon size={18} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function DrawerAuthActions() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="drawer-auth">
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
        <SignOutButton>
          <button type="button" className="drawer-link drawer-link-danger">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </SignOutButton>
      )}
    </div>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
