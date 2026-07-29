import Link from "next/link";
import { format } from "date-fns";
import { auth } from "@/auth";
import {
  getActivitySummaryForUser,
  getConnectionByUserId,
  getLatestSyncJob,
  listActivitiesForUser,
} from "@/lib/strava/repository";
import {
  Activity,
  AlertCircle,
  Bike,
  CalendarDays,
  Footprints,
  HeartPulse,
  Mountain,
  RotateCcw,
  Timer,
  type LucideIcon,
} from "lucide-react";

function formatDistance(meters: number | null | undefined) {
  if (!meters) return "—";
  return `${(meters / 1000).toLocaleString(undefined, {
    maximumFractionDigits: meters >= 10_000 ? 0 : 1,
  })} km`;
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

function formatPace(secondsPerKm: number | null | undefined) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm)) return null;
  const total = Math.max(0, Math.round(secondsPerKm));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} /km`;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getSportMeta(sportType?: string | null): {
  label: string;
  icon: LucideIcon;
  bg: string;
} {
  const value = (sportType ?? "").toUpperCase();
  if (value.includes("RUN") || value.includes("WALK") || value.includes("HIK")) {
    return { label: titleCase(value || "Run"), icon: Footprints, bg: "#FBD4E6" };
  }
  if (value.includes("RIDE") || value.includes("BIKE") || value.includes("CYCLE")) {
    return { label: titleCase(value || "Ride"), icon: Bike, bg: "#E5DBFE" };
  }
  if (value.includes("SWIM")) {
    return { label: titleCase(value || "Swim"), icon: Activity, bg: "#ACCDFF" };
  }
  if (value.includes("MOUNTAIN") || value.includes("TRAIL")) {
    return { label: titleCase(value || "Hike"), icon: Mountain, bg: "#D0E77F" };
  }
  return {
    label: titleCase(value || "Activity"),
    icon: Activity,
    bg: "#EEF0F5",
  };
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  bgColor,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  bgColor: string;
}) {
  return (
    <div
      className="rounded-[20px] p-4 text-[#13141A]"
      style={{ backgroundColor: bgColor }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium opacity-70">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function ActivityStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F7F8F5] px-3 py-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
        <Icon className="h-4 w-4 text-[#13141A]" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7A847E]">
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-[#13141A]">{value}</p>
      </div>
    </div>
  );
}

function ActivityCard({
  activity,
}: {
  activity: Awaited<ReturnType<typeof listActivitiesForUser>>[number];
}) {
  const sport = getSportMeta(activity.sportType);
  const startAt = activity.startDate ?? activity.createdAt;
  const performance =
    activity.averageSpeed && activity.distance && activity.distance > 0
      ? activity.averageSpeed * 3.6 >= 12
        ? `${(activity.averageSpeed * 3.6).toFixed(1)} km/h avg`
        : formatPace(activity.movingTime && activity.distance ? activity.movingTime / (activity.distance / 1000) : null) ?? "—"
      : null;

  return (
    <div className="rounded-[20px] bg-white p-4 sm:p-5">
      <div className="flex items-start gap-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: sport.bg }}
        >
          <sport.icon className="h-5 w-5 text-[#13141A]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#13141A]">{activity.name}</p>
              <p className="text-sm text-[#6B7280]">
                {sport.label} · {format(startAt, "EEE, MMM d, yyyy")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {activity.manual && (
                <span className="rounded-full bg-[#EEF0F5] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                  Manual
                </span>
              )}
              {activity.trainer && (
                <span className="rounded-full bg-[#EEF0F5] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                  Trainer
                </span>
              )}
              {activity.commute && (
                <span className="rounded-full bg-[#EEF0F5] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">
                  Commute
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ActivityStat label="Distance" value={formatDistance(activity.distance)} icon={Activity} />
            <ActivityStat label="Moving" value={formatDuration(activity.movingTime)} icon={Timer} />
            <ActivityStat label="Elevation" value={activity.totalElevationGain ? `${Math.round(activity.totalElevationGain)} m` : "—"} icon={Mountain} />
            <ActivityStat label="HR / Pace" value={performance ?? (activity.averageHeartrate ? `${Math.round(activity.averageHeartrate)} bpm avg` : "—")} icon={HeartPulse} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#69736D]">
            {activity.kudosCount !== null && activity.kudosCount !== undefined && (
              <span className="rounded-full bg-[#F7F8F5] px-2.5 py-1 font-medium">
                {activity.kudosCount} kudos
              </span>
            )}
            {activity.prCount !== null && activity.prCount !== undefined && activity.prCount > 0 && (
              <span className="rounded-full bg-[#F7F8F5] px-2.5 py-1 font-medium">
                {activity.prCount} PRs
              </span>
            )}
            {activity.averageCadence !== null && activity.averageCadence !== undefined && (
              <span className="rounded-full bg-[#F7F8F5] px-2.5 py-1 font-medium">
                {Math.round(activity.averageCadence)} cadence
              </span>
            )}
            {activity.gearId && (
              <span className="rounded-full bg-[#F7F8F5] px-2.5 py-1 font-medium">
                Gear {activity.gearId}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ sportType?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { sportType } = await searchParams;
  const activeSport = sportType?.trim().toUpperCase() || "ALL";
  const userId = session.user.id;
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const connection = await getConnectionByUserId(userId);
  const summary = connection ? await getActivitySummaryForUser(userId) : null;
  const latestSyncJob = connection
    ? await getLatestSyncJob(connection.id)
    : null;
  const activities = connection
    ? await listActivitiesForUser(userId, { limit: 100 })
    : [];

  const sportBuckets = activities.reduce<Record<string, number>>((acc, activity) => {
    const key = (activity.sportType || "OTHER").toUpperCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const filters = [
    { value: "ALL", label: "All", count: activities.length },
    ...Object.entries(sportBuckets)
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, label: titleCase(value), count })),
  ];

  const visibleActivities =
    activeSport === "ALL"
      ? activities
      : activities.filter(
          (activity) => (activity.sportType || "OTHER").toUpperCase() === activeSport
        );

  const totalMovingTime = summary?.totalMovingTime ?? 0;
  const totalElevation = summary?.totalElevationGain ?? 0;
  const latestActivityAt = summary?.latestActivityAt
    ? new Date(summary.latestActivityAt)
    : activities[0]?.startDate ?? null;

  const latestSyncLabel = latestSyncJob
    ? `${titleCase(latestSyncJob.type)} · ${titleCase(latestSyncJob.status)}`
    : "No sync jobs yet";

  if (!connection) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
              Activities
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Activity Library
            </h1>
            <p className="mt-1 text-sm text-[#69736D]">
              Sync your Strava account first to see workouts here.
            </p>
          </div>

          <div className="rounded-[28px] bg-white p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E4EED7]">
                <Activity className="h-6 w-6 text-[#18201C]" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-[#13141A]">No Strava connection yet</h2>
                <p className="mt-1 text-sm leading-6 text-[#69736D]">
                  Once Strava is connected, your activities, totals, and sync history will appear
                  here in a calm card-based view.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/settings"
                    className="inline-flex items-center justify-center rounded-full bg-[#18201C] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2B352F]"
                  >
                    Open settings
                  </Link>
                  <Link
                    href="/settings"
                    className="inline-flex items-center justify-center rounded-full bg-[#F7F8F5] px-4 py-2.5 text-sm font-semibold text-[#18201C] transition-colors hover:bg-[#EEF0EB]"
                  >
                    Connect Strava
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
              Activities
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[#13141A] sm:text-3xl">
              Activity Library
            </h1>
            <p className="mt-1 text-sm text-[#69736D]">{dateStr}</p>
          </div>
          <Link
            href="/settings"
            className="hidden rounded-full bg-[#F7F8F5] px-4 py-2.5 text-sm font-semibold text-[#18201C] transition-colors hover:bg-[#EEF0EB] sm:inline-flex"
          >
            Manage Strava
          </Link>
        </div>

        <div
          className="relative mb-6 overflow-hidden rounded-[28px] p-6 text-[#13141A]"
          style={{ backgroundColor: "#ACCDFF" }}
        >
          <div className="relative z-10 max-w-3xl">
            <p className="mb-1 text-sm font-medium opacity-70">Synced Activity Library</p>
            <p className="text-xs opacity-60">
              {activities.length} activities · {Object.keys(sportBuckets).length} sport types
            </p>
            <p className="mt-2 text-[32px] font-bold tracking-tight">
              {formatDistance(summary?.totalDistance ?? 0)}
            </p>
            <p className="mt-1 text-sm opacity-70">
              {visibleActivities.length} visible activities · {latestSyncLabel}
            </p>
          </div>
          <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full border-2 border-[#13141A]/10" />
          <div className="absolute -right-4 -top-4 h-36 w-36 rounded-full border-2 border-[#13141A]/8" />
          <div className="absolute right-4 -bottom-4 h-24 w-24 rounded-full border-2 border-[#13141A]/6" />
        </div>

        <div className="mobile-carousel mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard
            title="Total Distance"
            value={formatDistance(summary?.totalDistance ?? 0)}
            sub="all synced activities"
            icon={Activity}
            bgColor="#FBD4E6"
          />
          <MetricCard
            title="Moving Time"
            value={formatDuration(totalMovingTime)}
            sub="in motion"
            icon={Timer}
            bgColor="#E5DBFE"
          />
          <MetricCard
            title="Elevation Gain"
            value={totalElevation ? `${Math.round(totalElevation)} m` : "—"}
            sub="climbed"
            icon={Mountain}
            bgColor="#D0E77F"
          />
          <MetricCard
            title="Latest Activity"
            value={latestActivityAt ? format(latestActivityAt, "MMM d") : "—"}
            sub={latestActivityAt ? format(latestActivityAt, "HH:mm") : "no data"}
            icon={CalendarDays}
            bgColor="#ACCDFF"
          />
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((filter) => {
            const isActive = filter.value === activeSport;
            const href = filter.value === "ALL" ? "/activities" : `/activities?sportType=${encodeURIComponent(filter.value)}`;
            return (
              <Link
                key={filter.value}
                href={href}
                className={
                  isActive
                    ? "shrink-0 rounded-full bg-[#18201C] px-4 py-2 text-sm font-semibold text-white"
                    : "shrink-0 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#69736D] shadow-sm transition-colors hover:bg-[#F7F8F5]"
                }
              >
                {filter.label} <span className="opacity-70">({filter.count})</span>
              </Link>
            );
          })}
        </div>

        {latestSyncJob && (
          <div className="mb-6 rounded-[20px] bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7A847E]">
                  Latest sync
                </p>
                <p className="mt-1 text-sm font-semibold text-[#13141A]">
                  {titleCase(latestSyncJob.type)} · {titleCase(latestSyncJob.status)}
                </p>
                <p className="mt-0.5 text-sm text-[#69736D]">
                  {latestSyncJob.activitiesProcessed ?? 0} activities processed
                  {latestSyncJob.finishedAt
                    ? ` · finished ${format(new Date(latestSyncJob.finishedAt), "MMM d, HH:mm")}`
                    : latestSyncJob.startedAt
                      ? ` · started ${format(new Date(latestSyncJob.startedAt), "MMM d, HH:mm")}`
                      : ""}
                </p>
              </div>
              <Link
                href="/settings"
                className="inline-flex items-center gap-2 rounded-full bg-[#F7F8F5] px-4 py-2 text-sm font-semibold text-[#18201C] transition-colors hover:bg-[#EEF0EB]"
              >
                <RotateCcw className="h-4 w-4" />
                Sync settings
              </Link>
            </div>
          </div>
        )}

        {visibleActivities.length === 0 ? (
          <div className="rounded-[20px] bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF0F5]">
              <AlertCircle className="h-5 w-5 text-[#13141A]" />
            </div>
            <p className="font-semibold text-[#13141A]">No activities in this filter</p>
            <p className="mt-1 text-sm text-[#69736D]">
              Try another sport type or sync more data from Strava.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleActivities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
