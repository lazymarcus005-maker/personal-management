import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .limit(1);

  if (existingUser) {
    redirect("/auth/login");
  }

  const { error } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm rounded-[28px]">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#18201C] text-lg font-bold text-white">P</div>
          <CardTitle className="text-2xl">Set up Poj</CardTitle>
          <CardDescription>
            Create your admin account to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";

              const name = formData.get("name") as string;
              const email = formData.get("email") as string;
              const password = formData.get("password") as string;
              const confirmPassword = formData.get("confirmPassword") as string;

              if (!name || !email || !password) {
                redirect("/auth/setup?error=All fields are required");
              }

              if (password !== confirmPassword) {
                redirect("/auth/setup?error=Passwords do not match");
              }

              if (password.length < 6) {
                redirect(
                  "/auth/setup?error=Password must be at least 6 characters"
                );
              }

              const [existing] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.email, email))
                .limit(1);

              if (existing) {
                redirect("/auth/setup?error=Email already in use");
              }

              const passwordHash = await bcrypt.hash(password, 12);

              await db.insert(users).values({
                id: crypto.randomUUID(),
                name,
                email,
                passwordHash,
              });

              redirect("/auth/login");
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Your name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 6 characters"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Repeat password"
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
            <Button type="submit" className="w-full">
              Create Account
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
