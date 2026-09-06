"use client";

import { useState, useTransition } from "react";
import { createEntityLink, deleteEntityLink } from "@/lib/actions/entity-links";
import { RELATION_TYPES, ENTITY_TYPE_LABELS } from "@/lib/entity-registry";
import type { EntityType } from "@/lib/entity-registry";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, X } from "lucide-react";

export interface LinkableEntity {
  id: string;
  entityType: EntityType;
  title: string;
}

export interface ExistingLink {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationType: string;
}

/**
 * Reusable entity picker: links any two owned entities with a relation type.
 * Used on the project detail page and anywhere entities need connecting.
 */
export function EntityLinkPicker({
  projectId,
  linkableEntities,
  existingLinks,
}: {
  projectId: string;
  linkableEntities: LinkableEntity[];
  existingLinks: ExistingLink[];
}) {
  const [entityType, setEntityType] = useState<string>("TODO");
  const [entityId, setEntityId] = useState<string>("");
  const [relationType, setRelationType] = useState<string>("PART_OF");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const options = linkableEntities.filter((e) => e.entityType === entityType);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!entityId) return;
    startTransition(async () => {
      try {
        await createEntityLink({
          sourceType: entityType,
          sourceId: entityId,
          targetType: "PROJECT",
          targetId: projectId,
          relationType,
        });
        setEntityId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to link");
      }
    });
  };

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Entity type</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["TODO", "NOTE", "GOAL", "TRANSACTION"] as const).map((t) => (
                <SelectItem key={t} value={t}>
                  {ENTITY_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 min-w-[180px] flex-1">
          <Label className="text-xs">Entity</Label>
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Choose an item" />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 && (
                <SelectItem value="_none" disabled>
                  No items available
                </SelectItem>
              )}
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Relation</Label>
          <Select value={relationType} onValueChange={setRelationType}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELATION_TYPES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={isPending || !entityId}>
          <Link2 className="h-4 w-4 mr-1" />
          {isPending ? "Linking…" : "Link"}
        </Button>
      </form>
      {error && <p className="text-xs text-red-500">{error}</p>}

      {existingLinks.length > 0 && (
        <ul className="space-y-1.5">
          {existingLinks.map((link) => {
            const isIncoming =
              link.targetType === "PROJECT" && link.targetId === projectId;
            const otherType = isIncoming ? link.sourceType : link.targetType;
            const otherId = isIncoming ? link.sourceId : link.targetId;
            const other = linkableEntities.find((e) => e.id === otherId);
            return (
              <li
                key={link.id}
                className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
              >
                <Link2 className="h-3.5 w-3.5 text-[#7A847E] shrink-0" />
                <span className="font-medium text-[#13141A] truncate">
                  {other?.title ?? otherId.slice(0, 8)}
                </span>
                <span className="text-xs text-[#7A847E] shrink-0">
                  {ENTITY_TYPE_LABELS[otherType as EntityType] ?? otherType} ·{" "}
                  {link.relationType.replace(/_/g, " ")}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="ml-auto h-6 w-6"
                  aria-label="Remove link"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => void (await deleteEntityLink(link.id)))
                  }
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
