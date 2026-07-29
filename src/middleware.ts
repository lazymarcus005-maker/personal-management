import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Uses the edge-safe config (no db-touching Credentials provider) since
// middleware runs in the Edge Runtime, which can't load `pg`.
const { auth } = NextAuth(authConfig);

export const middleware = auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth).*)"],
};
