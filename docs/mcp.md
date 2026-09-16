# MCP Server (AI access)

The app exposes a [Model Context Protocol](https://modelcontextprotocol.io) server at
**`/api/mcp`** (Streamable HTTP), so AI clients (ZCode, Claude Code, Claude Desktop,
Cursor, …) can read and write your Personal Life OS data directly.

## Setup

### 1. Apply the migration

```bash
npx drizzle-kit migrate   # applies drizzle/0003_mcp_tokens.sql
# or, if you manage the schema with push:
npm run db:push
```

### 2. Mint a personal access token

```bash
node scripts/mcp-token.mjs --email you@example.com --name "my laptop"
```

The raw token (`mcp_...`) is printed **once** — only its SHA-256 hash is stored in
the `mcp_tokens` table. Revoke anytime:

```bash
node scripts/mcp-token.mjs --revoke mcp_...   # or delete the row
```

### 3. Point your AI client at the endpoint

URL: `https://<your-deployment>/api/mcp` (locally: `http://localhost:3000/api/mcp`),
with header `Authorization: Bearer mcp_...`.

ZCode — `~/.zcode/mcp.json` (or workspace `.mcp.json`):

```json
{
  "mcpServers": {
    "personal-life-os": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer mcp_<your-token>" }
    }
  }
}
```

Claude Code:

```bash
claude mcp add --transport http personal-life-os http://localhost:3000/api/mcp \
  --header "Authorization: Bearer mcp_<your-token>"
```

Claude Desktop (no native remote-MCP support): use the `mcp-remote` bridge:

```json
{
  "mcpServers": {
    "personal-life-os": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp",
               "--header", "Authorization: Bearer mcp_<your-token>"]
    }
  }
}
```

## Tools

Read: `search_entities`, `get_dashboard`, `list_areas`, `list_projects`, `get_project`,
`list_goals`, `list_todos`, `list_notes`, `list_journal_entries`, `list_capture_items`,
`list_accounts`, `list_categories`, `list_transactions`, `get_finance_summary`,
`get_entity_links`.

Write: `create_area`, `create_project`, `update_project`, `create_goal`, `update_goal`,
`create_todo`, `update_todo`, `create_note`, `create_journal_entry`, `create_capture_item`
(optionally converts via the deterministic Thai/English classifier), `dismiss_capture_item`,
`create_transaction`, `delete_transaction` (soft delete + balance reversal), `link_entities`.

A good pattern for the agent: `get_dashboard` or `search_entities` first to discover ids,
then read detail, then write.

## Security model

- **Token auth, not sessions.** The route checks `Authorization: Bearer mcp_...`
  against the hash in `mcp_tokens`; a revoked/unknown token gets `401`.
- **User scoping is absolute.** Every tool closes over the `userId` resolved from the
  token; ids passed as tool arguments are always verified against that user
  (same invariant as `src/lib/guards.ts` in the web app).
- **Financial integrity.** Transactions are soft-deleted and balances adjust
  atomically; capture-to-transaction conversion refuses currency mismatches.
- **Audit trail.** Every tool call writes one JSON line (`channel: "mcp_audit"`) with
  the user id, tool name and truncated args to the server log.

## Implementation notes

- Built on [`mcp-handler`](https://github.com/vercel/mcp-handler) v2 in
  `src/app/api/mcp/route.ts` (stateless mode: the server is re-created per request,
  with the userId closure).
- Tool definitions live in `src/lib/mcp/tools/*`; registration in
  `src/lib/mcp/register-tools.ts`.
- Shared query/mutation logic with the web app lives in `src/lib/services/`
  (`search.ts`, `capture.ts`, `transactions.ts`, `finance-summary.ts`) — the UI and
  MCP can never drift apart on the invariants.
