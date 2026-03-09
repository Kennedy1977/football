import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextMiddleware } from "next/server";

const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);
const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const clerkProxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

const noAuthProxy: NextMiddleware = () => NextResponse.next();
const authProxy: NextMiddleware = clerkConfigured ? (clerkProxy as unknown as NextMiddleware) : noAuthProxy;

const proxy: NextMiddleware = async (req, evt) => {
  const isApiRequest = req.nextUrl.pathname.startsWith("/api") || req.nextUrl.pathname.startsWith("/trpc");
  const response = await authProxy(req, evt);

  // Prevent browser/CDN from serving cached RSC payload as full page document.
  if (req.method === "GET" && !isApiRequest && response) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
};

export default proxy;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
