"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Settings, X, ChevronUp, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DashboardWidget {
  id: string;
  node: React.ReactNode;
}

interface WidgetConfig {
  order: string[];
  hidden: string[];
}

const STORAGE_KEY = "today-dashboard-config";
const CONFIG_EVENT = "today-dashboard-config-changed";

/**
 * Client-side configurable widget grid. Widgets themselves are server
 * components passed in as RSC nodes; this shell controls their visibility and
 * order with a localStorage-backed preference (read through
 * useSyncExternalStore so there is no setState-in-effect hydration dance).
 */
export function DashboardGrid({
  widgets,
  defaultVisibleCount = 6,
}: {
  widgets: DashboardWidget[];
  /** Widgets beyond this index start hidden for first-time visitors. */
  defaultVisibleCount?: number;
}) {
  const idsRef = useRef(widgets.map((w) => w.id));
  const defaultsRef = useRef({
    order: widgets.map((w) => w.id),
    hidden: widgets.slice(defaultVisibleCount).map((w) => w.id),
  });

  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener("storage", onStoreChange);
    window.addEventListener(CONFIG_EVENT, onStoreChange);
    return () => {
      window.removeEventListener("storage", onStoreChange);
      window.removeEventListener(CONFIG_EVENT, onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback((): WidgetConfig => {
    return readConfig(idsRef.current, defaultsRef.current);
  }, []);

  const getServerSnapshot = useCallback(
    (): WidgetConfig => defaultsRef.current,
    []
  );

  const config = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [showEditing, setShowEditing] = useState(false);

  const persist = (next: WidgetConfig) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage may be unavailable; config still applies for this render.
    }
    window.dispatchEvent(new Event(CONFIG_EVENT));
  };

  const ordered = config.order
    .map((id) => widgets.find((w) => w.id === id))
    .filter((w): w is DashboardWidget => Boolean(w))
    .filter((w) => !config.hidden.includes(w.id));

  const move = (id: string, direction: -1 | 1) => {
    const order = [...config.order];
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    persist({ ...config, order });
  };

  const toggle = (id: string) => {
    const hidden = config.hidden.includes(id)
      ? config.hidden.filter((h) => h !== id)
      : [...config.hidden, id];
    persist({ ...config, hidden });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="sm"
          variant="ghost"
          className="gap-1 text-[#69736D]"
          onClick={() => setShowEditing((e) => !e)}
        >
          <Settings className="h-3.5 w-3.5" />
          {showEditing ? "Done" : "Customize"}
        </Button>
      </div>

      {showEditing && (
        <div className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-[#13141A]">Dashboard sections</p>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1 text-xs"
              onClick={() => persist(defaultsRef.current)}
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </Button>
          </div>
          {config.order.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between rounded-xl bg-[#FAFBF8] px-3 py-2"
            >
              <label className="flex items-center gap-2 text-sm text-[#13141A]">
                <input
                  type="checkbox"
                  checked={!config.hidden.includes(id)}
                  onChange={() => toggle(id)}
                />
                {id}
              </label>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  aria-label="Move up"
                  onClick={() => move(id, -1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  aria-label="Move down"
                  onClick={() => move(id, 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ordered.map((widget) => (
          <div key={widget.id} className="relative">
            {showEditing && (
              <button
                className="absolute right-2 top-2 z-10 rounded-full bg-white/80 p-1 text-[#7A847E] hover:text-[#18201C]"
                aria-label={`Hide ${widget.id}`}
                onClick={() => toggle(widget.id)}
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {widget.node}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Reads and normalizes the stored config; cached to keep snapshots stable. */
function readConfig(
  knownIds: string[],
  defaults: WidgetConfig
): WidgetConfig {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return defaults;
  }
  if (!raw) return defaults;

  const cache = readConfigCache;
  if (cache.raw === raw && cache.config) return cache.config;

  let config = defaults;
  try {
    const parsed = JSON.parse(raw) as WidgetConfig;
    const order = [
      ...parsed.order.filter((id) => knownIds.includes(id)),
      ...knownIds.filter((id) => !parsed.order.includes(id)),
    ];
    config = {
      order,
      hidden: parsed.hidden.filter((id) => knownIds.includes(id)),
    };
  } catch {
    config = defaults;
  }
  cache.raw = raw;
  cache.config = config;
  return config;
}

const readConfigCache: { raw: string | null; config: WidgetConfig | null } = {
  raw: null,
  config: null,
};
