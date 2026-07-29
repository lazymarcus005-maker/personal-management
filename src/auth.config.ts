import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no providers or callbacks that touch the database
// (e.g. Credentials' `authorize`, which imports `@/db` → `pg`). `pg` relies on
// Node.js built-ins (`node:net`, `node:util/types`, ...) that don't exist in
// the Edge Runtime that `middleware.ts` runs in, so this file must stay free
// of any db import. The full config with the Credentials provider lives in
// `auth.ts` and is only used from Node.js runtime code (route handlers,
// server components/actions).
export default {
  providers: [],
  trustHost: true,
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    jwt({ token, user, trigger, session }) {
      if (user) token.sub = user.id;
      if (trigger === "update" && session?.user) {
        if (session.user.name !== undefined) token.name = session.user.name;
        if (session.user.email !== undefined) token.email = session.user.email;
      }
      return token;
    },
  },
  session: {
    strategy: "jwt",
  },
} satisfies NextAuthConfig;
