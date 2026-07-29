import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StravaConnectionCard } from "@/components/integrations/strava-connection-card";
import Link from "next/link";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string; reason?: string }>;
}) {
  const session = await auth();
  const { strava, reason } = await searchParams;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">Account</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-[#69736D]">
          Your profile and preferences.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {session?.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Profile"
                  className="h-16 w-16 rounded-full"
                />
              ) : (
                <Avatar className="h-16 w-16 bg-[#E4EED7]" />
              )}
              <div>
                <p className="font-medium">{session?.user?.name}</p>
                <p className="text-sm text-[#69736D]">{session?.user?.email}</p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link href="/settings/account">Manage account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Coming soon - customize your experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-[#69736D]">
            Theme customization, notification preferences, and more will be
            available in a future update.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Connect external services</CardDescription>
        </CardHeader>
        <CardContent>
          {strava === "connected" && (
            <p className="mb-4 text-sm text-green-700">
              Strava connected successfully.
            </p>
          )}
          {strava === "error" && (
            <p className="mb-4 text-sm text-red-600">
              Strava connection failed
              {reason ? `: ${reason}` : "."}
            </p>
          )}
          {strava === "denied" && (
            <p className="mb-4 text-sm text-red-600">
              Strava authorization was denied.
            </p>
          )}
          <StravaConnectionCard />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
