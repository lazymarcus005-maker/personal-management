"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { auth, signIn, signOut, unstable_update } from "@/auth";
import { getDb } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { sendMail } from "@/lib/mail";

const PASSWORD_MIN_LENGTH = 6;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getBaseUrl(): Promise<string> {
  const envUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().email("Enter a valid email"),
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function registerUser(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      `/auth/register?error=${encodeURIComponent(parsed.error.issues[0].message)}`
    );
  }

  const { name, email, password } = parsed.data;
  const db = await getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (existing) {
    redirect(
      `/auth/register?error=${encodeURIComponent("An account with that email already exists")}`
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db.insert(users).values({
    id: crypto.randomUUID(),
    name,
    email,
    passwordHash,
  });

  await signIn("credentials", {
    email,
    password,
    redirectTo: "/",
  });
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export async function requestPasswordReset(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent(parsed.error.issues[0].message)}`
    );
  }

  const email = parsed.data.email;
  const db = await getDb();

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  // Respond identically whether or not the account exists so this endpoint
  // can't be used to enumerate registered emails.
  if (!user) {
    redirect("/auth/forgot-password?sent=1");
  }

  // Any previously issued link becomes invalid once a new one is requested.
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id));

  const rawToken = crypto.randomBytes(32).toString("hex");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const resetUrl = `${await getBaseUrl()}/auth/reset-password/${rawToken}`;

  const { sent } = await sendMail({
    to: user.email,
    subject: "Reset your Poj password",
    text: `We received a request to reset your Poj password.\n\nReset it here: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.`,
    html: `<p>We received a request to reset your Poj password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>`,
  });

  // Without SMTP configured there's no way to deliver the link, so surface it
  // directly for local/dev testing. Never do this in production.
  if (!sent && process.env.NODE_ENV !== "production") {
    redirect(`/auth/forgot-password?sent=1&devResetUrl=${encodeURIComponent(resetUrl)}`);
  }

  redirect("/auth/forgot-password?sent=1");
}

// ---------------------------------------------------------------------------
// Reset password
// ---------------------------------------------------------------------------

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function resetPassword(token: string, formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      `/auth/reset-password/${token}?error=${encodeURIComponent(parsed.error.issues[0].message)}`
    );
  }

  const db = await getDb();
  const tokenHash = hashToken(token);

  const [resetToken] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  const isValid =
    resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date();

  if (!isValid) {
    redirect(
      `/auth/reset-password/${token}?error=${encodeURIComponent(
        "This reset link is invalid or has expired"
      )}`
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, resetToken.userId));

  // Invalidate every outstanding token for this user, not just the one used.
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, resetToken.userId));

  redirect(
    `/auth/login?message=${encodeURIComponent("Password updated. Please sign in.")}`
  );
}

// ---------------------------------------------------------------------------
// Account settings: profile
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Enter a valid email"),
});

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    redirect(
      `/settings/account?profileError=${encodeURIComponent(parsed.error.issues[0].message)}`
    );
  }

  const { name, email } = parsed.data;
  const db = await getDb();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (existing && existing.id !== session.user.id) {
    redirect(
      `/settings/account?profileError=${encodeURIComponent("An account with that email already exists")}`
    );
  }

  await db.update(users).set({ name, email }).where(eq(users.id, session.user.id));

  await unstable_update({ user: { name, email } });

  redirect(`/settings/account?profileMessage=${encodeURIComponent("Profile updated")}`);
}

// ---------------------------------------------------------------------------
// Account settings: change password
// ---------------------------------------------------------------------------

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    redirect(
      `/settings/account?passwordError=${encodeURIComponent(parsed.error.issues[0].message)}`
    );
  }

  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const validCurrentPassword = user?.passwordHash
    ? await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)
    : false;

  if (!validCurrentPassword) {
    redirect(
      `/settings/account?passwordError=${encodeURIComponent("Current password is incorrect")}`
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await db.update(users).set({ passwordHash }).where(eq(users.id, session.user.id));

  // Clear the session cookie so the new password must be used to sign back in.
  await signOut({
    redirectTo: `/auth/login?message=${encodeURIComponent(
      "Password changed. Please sign in again."
    )}`,
  });
}
