"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/start", label: "Start" },
  { href: "/home", label: "Home" },
  { href: "/squad", label: "Squad" },
  { href: "/league", label: "League" },
  { href: "/shop", label: "Shop" },
  { href: "/playercards", label: "Cards" },
  { href: "/match/prep", label: "Match" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav" aria-label="Primary">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`nav-link ${pathname === link.href || pathname.startsWith(`${link.href}/`) ? "is-active" : ""}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
