"use client";

import { Button } from "@/components/ui/button";
import { useEffect, useState, useTransition } from "react";

interface StravaStatusResponse {
  connected: boolean;
  connection: {
    status: string;
    lastSyncedAt: string | null;
    lastError: string | null;
  } | null;
  athlete: {
    firstname: string | null;
    lastname: string | null;
    username: string | null;
    profile: string | null;
  } | null;
  latestJob: {
    status: string;
    activitiesProcessed: number | null;
  } | null;
  summary: {
    totalActivities: number;
    totalDistance: number;
  } | null;
}

export function StravaConnectionCard() {
  const [status, setStatus] = useState<StravaStatusResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [action, setAction] = useState<string | null>(null);

  async function refreshStatus() {
    const res = await fetch("/api/integrations/strava/status");
    if (res.ok) setStatus(await res.json());
    setLoaded(true);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/integrations/strava/status")
      .then(async (res) => {
        if (!active) return;
        if (res.ok) setStatus(await res.json());
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function connect() {
    setAction("connect");
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/integrations/strava/connect");
      if (!res.ok) {
        setError("Unable to start Strava connection");
        setAction(null);
        return;
      }
      const { url } = await res.json();
      window.location.href = url;
    });
  }

  function sync(kind: "backfill" | "sync") {
    setAction(kind);
    startTransition(async () => {
      setError(null);
      const res = await fetch(`/api/integrations/strava/${kind}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
      }
      setAction(null);
      await refreshStatus();
    });
  }

  function disconnect() {
    setAction("disconnect");
    startTransition(async () => {
      setError(null);
      const res = await fetch("/api/integrations/strava/connection", {
        method: "DELETE",
      });
      if (!res.ok) setError("Unable to disconnect");
      setAction(null);
      await refreshStatus();
    });
  }

  const connected = status?.connected;
  const athleteName = status?.athlete
    ? [status.athlete.firstname, status.athlete.lastname]
        .filter(Boolean)
        .join(" ") || status.athlete.username
    : null;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {connected === false || !status ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Connect Strava</p>
            <p className="text-sm text-[#69736D]">
              Sync your activities to track fitness alongside your finances.
            </p>
          </div>
          <Button
            onClick={connect}
            disabled={!loaded || (pending && action === "connect")}
          >
            {!loaded
              ? "Loading…"
              : pending && action === "connect"
                ? "Redirecting…"
                : "Connect"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {status.athlete?.profile && (
              <img
                src={status.athlete.profile}
                alt="Strava profile"
                className="h-12 w-12 rounded-full"
              />
            )}
            <div>
              <p className="font-medium">{athleteName ?? "Connected athlete"}</p>
              <p className="text-sm text-[#69736D]">
                Status: {status.connection?.status}
                {status.summary
                  ? ` · ${status.summary.totalActivities} activities`
                  : ""}
              </p>
            </div>
          </div>

          {status.connection?.lastError && (
            <p className="text-sm text-red-600">
              {status.connection.lastError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => sync("sync")}
              disabled={pending && action === "sync"}
            >
              {pending && action === "sync" ? "Syncing…" : "Sync now"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => sync("backfill")}
              disabled={pending && action === "backfill"}
            >
              {pending && action === "backfill" ? "Backfilling…" : "Backfill"}
            </Button>
            <Button
              variant="destructive"
              onClick={disconnect}
              disabled={pending && action === "disconnect"}
            >
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
