/**
 * Registry of linkable entity types. Used by entity links, unified search,
 * and the entity picker so type strings stay consistent across the app.
 *
 * Entity links are polymorphic (no DB foreign keys), so the owning action
 * verifies ownership of both endpoints against the mapped table.
 */

export const ENTITY_TYPES = [
  "TODO",
  "NOTE",
  "PROJECT",
  "GOAL",
  "JOURNAL_ENTRY",
  "BILL",
  "SUBSCRIPTION",
  "TRANSACTION",
  "ACCOUNT",
  "AREA",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export function isEntityType(value: string): value is EntityType {
  return (ENTITY_TYPES as readonly string[]).includes(value);
}

export const RELATION_TYPES = [
  "PART_OF",
  "RELATED_TO",
  "SUPPORTS",
  "BLOCKS",
  "PAID_FOR",
  "GENERATED_FROM",
  "INSPIRED_BY",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

export function isRelationType(value: string): value is RelationType {
  return (RELATION_TYPES as readonly string[]).includes(value);
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  TODO: "Todo",
  NOTE: "Note",
  PROJECT: "Project",
  GOAL: "Goal",
  JOURNAL_ENTRY: "Journal",
  BILL: "Bill",
  SUBSCRIPTION: "Subscription",
  TRANSACTION: "Transaction",
  ACCOUNT: "Account",
  AREA: "Area",
};
