import Link from "next/link";

const links = [
  { href: "/home", label: "Home" },
  { href: "/squad", label: "Squad" },
  { href: "/league", label: "League" },
  { href: "/shop", label: "Shop" },
  { href: "/match/live", label: "Match" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  return (
    <nav className="top-nav" aria-label="Primary">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="nav-link">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
