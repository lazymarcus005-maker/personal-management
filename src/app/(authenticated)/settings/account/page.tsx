import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { updateProfile, changePassword } from "@/lib/actions/auth";
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
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AccountSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    profileError?: string;
    profileMessage?: string;
    passwordError?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { profileError, profileMessage, passwordError } = await searchParams;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link
            href="/settings"
            className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[#69736D] hover:text-[#18201C]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to settings
          </Link>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
            Account
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Manage account
          </h1>
          <p className="mt-1 text-sm text-[#69736D]">
            Update your profile details and password.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Your name and email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={session.user.name ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={session.user.email ?? ""}
                  required
                />
              </div>
              {profileMessage && (
                <p className="text-sm text-green-700">{profileMessage}</p>
              )}
              {profileError && (
                <p className="text-sm text-red-500">{profileError}</p>
              )}
              <Button type="submit">Save profile</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              Change your password. You&apos;ll be signed out afterwards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                />
              </div>
              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}
              <Button type="submit">Change password</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
