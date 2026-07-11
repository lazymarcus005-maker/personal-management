import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";
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
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Personal Hub</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
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
              href="/auth/setup"
              className="font-medium underline underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-50"
            >
              Set up now
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
