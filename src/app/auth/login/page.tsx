import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error, message } = await searchParams;

  const [existingUser] = await db.select({ id: users.id }).from(users).limit(1);

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#18201C] text-lg font-bold text-white">P</div>
        <p className="text-sm text-[#69736D]">Everything important, in one calm place.</p>
      </div>
      <Card className="w-full rounded-[28px]">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to Poj</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: "/",
              });
            }}
            className="space-y-4"
          >
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
                placeholder="••••••••"
                required
              />
            </div>
            <div className="text-right">
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-[#69736D] underline underline-offset-4 hover:text-neutral-900"
              >
                Forgot password?
              </Link>
            </div>
            {message && (
              <p className="text-sm text-green-700">{message}</p>
            )}
            {error && (
              <p className="text-sm text-red-500">
                Invalid email or password
              </p>
            )}
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-neutral-500">
            Don&apos;t have an account?{" "}
            <Link
              href={existingUser ? "/auth/register" : "/auth/setup"}
              className="font-medium underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              {existingUser ? "Sign up" : "Set up now"}
            </Link>
          </p>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}
