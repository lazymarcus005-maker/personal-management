#!/usr/bin/env node
/**
 * Mint (or revoke) an MCP personal access token.
 *
 * Usage:
 *   node scripts/mcp-token.mjs --email you@example.com --name "my laptop"
 *   node scripts/mcp-token.mjs --revoke <token>       # revoke an existing token
 *
 * Requires DATABASE_URL in the environment (reads .env.local automatically).
 * The raw token is printed once and never stored — only its SHA-256 hash is.
 */
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import pg from "pg";

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    const file = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const match = file.match(/^DATABASE_URL=(.*)$/m);
    if (match) process.env.DATABASE_URL = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {
    // fall through — the check below reports the problem
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--email") args.email = argv[++i];
    else if (arg === "--name") args.name = argv[++i];
    else if (arg === "--revoke") args.revoke = argv[++i];
    else args._.push(arg);
  }
  return args;
}

async function main() {
  loadEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (.env.local not found either)");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  try {
    if (args.revoke) {
      const result = await pool.query(
        `UPDATE mcp_tokens SET revoked_at = now()
         WHERE token_hash = $1 AND revoked_at IS NULL
         RETURNING id, name`,
        [sha256(args.revoke)]
      );
      if (result.rowCount === 0) {
        console.error("Token not found or already revoked");
        process.exitCode = 1;
      } else {
        console.log(`Revoked token "${result.rows[0].name}" (${result.rows[0].id})`);
      }
      return;
    }

    if (!args.email) {
      console.error("Usage: node scripts/mcp-token.mjs --email you@example.com [--name \"label\"]");
      process.exit(1);
    }

    const user = await pool.query(
      "SELECT id FROM \"user\" WHERE email = $1",
      [args.email]
    );
    if (user.rowCount === 0) {
      console.error(`No user found with email ${args.email}`);
      process.exit(1);
    }

    const token = `mcp_${randomBytes(32).toString("base64url")}`;
    const inserted = await pool.query(
      `INSERT INTO mcp_tokens (user_id, name, token_hash)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [user.rows[0].id, args.name ?? "unnamed", sha256(token)]
    );

    console.log("MCP token created (copy it now — it is shown only once):");
    console.log(token);
    console.log(`id: ${inserted.rows[0].id}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
