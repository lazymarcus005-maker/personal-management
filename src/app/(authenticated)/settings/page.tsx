import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Manage your account settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt="Profile"
                className="h-16 w-16 rounded-full"
              />
            ) : (
              <Avatar className="h-16 w-16 bg-neutral-200 dark:bg-neutral-800" />
            )}
            <div>
              <p className="font-medium">{session?.user?.name}</p>
              <p className="text-sm text-neutral-500">{session?.user?.email}</p>
            </div>
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
          <p className="text-sm text-neutral-500">
            Theme customization, notification preferences, and more will be
            available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
