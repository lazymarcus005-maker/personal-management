import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Lightweight brute-force mitigation.
//
// This is an in-memory sliding-window throttle keyed by email. It slows down
// credential stuffing / password guessing for single-instance / self-hosted
// deployments. It is intentionally dependency-free.
//
// NOTE: In-memory state is per-process and does NOT survive across serverless
// instances or restarts. For a horizontally-scaled or serverless production
// deployment, replace this with a shared store (e.g. Redis / Upstash) and/or
// an edge rate limiter (e.g. @upstash/ratelimit) keyed by IP + email.
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const attempts = new Map<string, { count: number; firstAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record) return false;
  if (now - record.firstAt > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string): void {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
  } else {
    record.count += 1;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const key = email.toLowerCase();

        // Reject early once too many failures have accumulated for this email.
        if (isRateLimited(key)) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        // Always run bcrypt.compare against a hash (real or dummy) so response
        // timing does not reveal whether the email exists.
        const hash =
          user?.passwordHash ??
          "$2a$12$0000000000000000000000000000000000000000000000000000u";
        const valid = await bcrypt.compare(password, hash);

        if (!user?.passwordHash || !valid) {
          registerFailure(key);
          return null;
        }

        // Clear the failure counter on a successful login.
        attempts.delete(key);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  // trustHost lets NextAuth derive the callback URL from the request Host
  // header. It is required for self-hosted / reverse-proxied deployments
  // (Docker, Vercel behind a custom proxy) where AUTH_URL is not pinned.
  //
  // PRODUCTION NOTE: only safe when a trusted proxy sets X-Forwarded-Host /
  // Host. If the app is ever exposed directly to untrusted clients, pin the
  // canonical origin via the AUTH_URL env var and set trustHost: false to
  // prevent Host-header spoofing of auth/callback URLs.
  trustHost: true,
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
});
