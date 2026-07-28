import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requestPasswordReset } from "@/lib/actions/auth";
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

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; devResetUrl?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error, sent, devResetUrl } = await searchParams;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#18201C] text-lg font-bold text-white">
            P
          </div>
          <p className="text-sm text-[#69736D]">
            Everything important, in one calm place.
          </p>
        </div>
        <Card className="w-full rounded-[28px]">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Forgot password</CardTitle>
            <CardDescription>
              We&apos;ll email you a link to reset it
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {sent ? (
              <div className="space-y-3">
                <p className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  If an account exists for that email, a reset link is on its
                  way. It expires in 1 hour.
                </p>
                {devResetUrl && (
                  <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">
                      Dev mode: SMTP isn&apos;t configured, so here&apos;s the
                      link directly.
                    </p>
                    <Link
                      href={devResetUrl}
                      className="break-all underline underline-offset-4"
                    >
                      {devResetUrl}
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <form action={requestPasswordReset} className="space-y-4">
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
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full">
                  Send reset link
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-neutral-500">
              <Link
                href="/auth/login"
                className="font-medium underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-50"
              >
                Back to sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
