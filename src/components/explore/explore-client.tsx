"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ENTITY_TYPES, ENTITY_TYPE_LABELS } from "@/lib/entity-registry";
import type { EntityType } from "@/lib/entity-registry";

interface SearchResult {
  id: string;
  entity_type: string;
  title: string;
  snippet: string | null;
  area: string | null;
  project: string | null;
  created_at: string;
  updated_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  TODO: "bg-[#FBD4E6] text-[#13141A]",
  NOTE: "bg-[#D0E77F] text-[#13141A]",
  PROJECT: "bg-[#E5DBFE] text-[#13141A]",
  GOAL: "bg-[#ACCDFF] text-[#13141A]",
  JOURNAL_ENTRY: "bg-[#E4EED7] text-[#13141A]",
  BILL: "bg-[#EEF0F5] text-[#6B7280]",
  SUBSCRIPTION: "bg-[#EEF0F5] text-[#6B7280]",
  TRANSACTION: "bg-[#FDF1F6] text-[#13141A]",
  AREA: "bg-[#ACCDFF] text-[#13141A]",
  TAG: "bg-[#EEF0F5] text-[#6B7280]",
};

export function ExploreClient({
  areas,
  projects,
}: {
  areas: string[];
  projects: string[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [areaFilter, setAreaFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    if (query.trim().length < 2) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query.trim() });
      if (typeFilter !== "ALL") params.set("type", typeFilter);
      if (areaFilter !== "ALL") params.set("area", areaFilter);
      if (projectFilter !== "ALL") params.set("project", projectFilter);
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(to).toISOString());

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, areaFilter, projectFilter, from, to]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    // Reset results outside the effect so no state is set synchronously there.
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
    }
  };

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      void runSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [runSearch, query]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
          Life OS
        </p>
        <h1 className="text-2xl font-bold text-[#18201C]">Explore</h1>
        <p className="text-sm text-[#69736D] mt-0.5">
          One search across tasks, notes, projects, goals, journal, money and
          more.
        </p>
      </div>

      {/* Search box */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB6AE]" />
        <Input
          className="pl-9 h-11 rounded-2xl"
          placeholder="Search everything…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoFocus
        />
      </div>

      {/* Filters */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              {ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTITY_TYPE_LABELS[t as EntityType] ?? t}
                </SelectItem>
              ))}
              <SelectItem value="TAG">Tag</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Area</Label>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All areas</SelectItem>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Project</Label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="explore-from">
            From
          </Label>
          <Input
            id="explore-from"
            type="date"
            className="h-9"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="explore-to">
            To
          </Label>
          <div className="flex gap-1">
            <Input
              id="explore-to"
              type="date"
              className="h-9"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              aria-label="Search"
              onClick={runSearch}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading && (
        <p className="text-sm text-[#7A847E] text-center py-6">Searching…</p>
      )}
      {!loading && searched && results.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
          No results for “{query}”.
        </div>
      )}
      {!loading && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((result) => (
            <li
              key={`${result.entity_type}-${result.id}`}
              className="rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  className={`${TYPE_COLORS[result.entity_type] ?? "bg-[#EEF0F5]"} border-0 shrink-0`}
                >
                  {ENTITY_TYPE_LABELS[result.entity_type as EntityType] ??
                    result.entity_type}
                </Badge>
                <p className="font-semibold text-[#13141A] text-sm truncate">
                  {result.title}
                </p>
              </div>
              {result.snippet && (
                <p className="text-xs text-[#6B7280] line-clamp-2">
                  {result.snippet}
                </p>
              )}
              <p className="text-[10px] text-[#AEB6AE] mt-1">
                {result.area ? `${result.area} · ` : ""}
                {result.project ? `${result.project} · ` : ""}
                updated {new Date(result.updated_at).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!searched && !loading && (
        <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
          Type at least 2 characters to search across your life OS.
        </div>
      )}
    </div>
  );
}
