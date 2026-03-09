import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextMiddleware } from "next/server";
import { APP_CACHE_BUST } from "./src/lib/build-meta";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

const noAuthProxy: NextMiddleware = () => NextResponse.next();
const authProxy: NextMiddleware = clerkConfigured ? (clerkProxy as unknown as NextMiddleware) : noAuthProxy;

const proxy: NextMiddleware = (req, evt) => {
  const isApiRequest = req.nextUrl.pathname.startsWith("/api") || req.nextUrl.pathname.startsWith("/trpc");
  const shouldVersionQuery = req.method === "GET" && !isApiRequest;

  if (shouldVersionQuery) {
    const currentVersion = req.nextUrl.searchParams.get("v");
    if (currentVersion !== APP_CACHE_BUST) {
      const nextUrl = req.nextUrl.clone();
      nextUrl.searchParams.set("v", APP_CACHE_BUST);
      return NextResponse.redirect(nextUrl);
    }
  }

  return authProxy(req, evt);
};

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
