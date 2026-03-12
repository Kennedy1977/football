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
import { useEffect, useMemo, useRef, useState } from "react";
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
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const { data: dashboardSummary } = useGetDashboardSummaryQuery();
  const manager = dashboardSummary?.manager;
  const notifications = useMemo(() => {
    if (dashboardSummary?.notifications) {
      return dashboardSummary.notifications;
    }

    if (dashboardSummary?.dailyReward && !dashboardSummary.dailyReward.claimed) {
      return {
        unreadCount: 1,
        items: [
          {
            id: "daily-reward",
            type: "DAILY_REWARD" as const,
            title: "Daily reward ready",
            detail: "Collect your daily coins.",
            href: "/home",
          },
        ],
      };
    }

    return {
      unreadCount: 0,
      items: [],
    };
  }, [dashboardSummary?.dailyReward, dashboardSummary?.notifications]);

  useEffect(() => {
    setIsDrawerOpen(false);
    setIsNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

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
          <div className="topbar-notifications" ref={notificationsRef}>
            <button
              type="button"
              className={`icon-btn icon-btn-muted ${isNotificationsOpen ? "is-active" : ""}`}
              aria-label="Notifications"
              aria-expanded={isNotificationsOpen}
              aria-haspopup="menu"
              onClick={() => setIsNotificationsOpen((prev) => !prev)}
            >
              <Bell size={18} />
              {notifications.unreadCount > 0 ? <span className="topbar-notification-dot" aria-hidden /> : null}
            </button>
            {isNotificationsOpen ? (
              <div className="topbar-notification-menu" role="menu" aria-label="Notifications">
                <div className="topbar-notification-menu-head">
                  <strong>Notifications</strong>
                  {notifications.unreadCount > 0 ? <span>{notifications.unreadCount}</span> : null}
                </div>
                {notifications.items.length ? (
                  <ul className="topbar-notification-list">
                    {notifications.items.map((item) => (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className="topbar-notification-item"
                          onClick={() => setIsNotificationsOpen(false)}
                        >
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.detail}</p>
                          </div>
                          {typeof item.count === "number" ? <span className="topbar-notification-count">{item.count}</span> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="topbar-notification-empty">You are all caught up.</p>
                )}
              </div>
            ) : null}
          </div>
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
