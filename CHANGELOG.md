# Changelog

## [1.5.2-p2] - 2026-10-15

Fork release (avioli/helpscout-cli) on top of 1.5.2.

### Added

- `inbox thread reply --draft` saves the reply as a draft in Help Scout instead of sending it; MCP `reply_to_conversation` takes `draft: true`
- `inbox thread reply` accepts a conversation ID or web UI number

### Fixed

- `reply_to_conversation` / `helpscout inbox thread reply` now POST to `/v2/conversations/{id}/reply` with the conversation's primary customer instead of the broken `/threads/reply` path (PATCH only)
- MCP `reply_to_conversation` sends `text` and `user` instead of the ignored `body` and `userId` fields
- Shared `buildCreateReplyRequest` so CLI and MCP use the same Create Reply path and payload

## [1.5.2-p1] - 2026-10-15

Fork release (avioli/helpscout-cli) on top of 1.5.2.

### Added

- `inbox conversation list --number <n>` finds a conversation by the number shown in the web UI, searching all statuses unless `--status` is given; list tables (CLI and MCP markdown) include a Number column
- `inbox conversation get` and `inbox thread list` accept a conversation ID or web UI number: values below 100000 are tried as a number first, larger ones as an ID first, falling back to the other
- `inbox conversation get --threads` embeds all threads; pretty/markdown output renders a plain-text transcript (oldest first, HTML converted to text, lines trimmed), JSON keeps the raw API response
- MCP: `list_conversations` takes `number`; `get_conversation` accepts a number and takes `threads` and `transcript`

### Fixed

- `npm test` no longer overwrites the real `~/.cache/helpscout/token.json` (which logged the user out); tests now run with `HOME` pointed at a throwaway temp directory

## [1.5.2] — 2026-08-11

### Fixed

- `add_note` / `helpscout inbox thread note` now POST to `/v2/conversations/{id}/notes` with `{ text, user? }` instead of the broken `/threads/note` path ([#13](https://github.com/mobilelocker/helpscout-cli/issues/13))
- Shared `buildCreateNoteRequest` so CLI and MCP use the same Create Note path and payload

## [1.5.1] — 2026-07-18

### Fixed

- `install.sh` and `npm run install:bin` stop running `helpscout-mcp` processes after installing a new binary so upgrades are not shadowed by an old in-memory server ([#12](https://github.com/mobilelocker/helpscout-cli/issues/12))

## [1.5.0] — 2026-07-18

### Added

- **Load free-form HTML/text from a file** instead of passing large bodies inline (MCP tool args or CLI flags)
  - MCP: optional `filePath` on `create_article`, `update_article`, `save_article_draft`, `reply_to_conversation`, `add_note`, and `create_conversation` (uses `body` or `filePath`)
  - CLI: `--file <path>` on `docs article create|update|save-draft`, `inbox thread reply|note`, and `inbox conversation create` (uses `--body` or `--file`)
  - Exactly one of text/body or file for required bodies; at most one when the body is optional
  - Still uses the existing JSON create/update/reply APIs (not multipart `upload_article`)
- Shared `resolveTextOrFile` helper (`src/text-or-file.js`) for CLI and MCP, with clear errors for mutual exclusivity, missing files, and unreadable paths
- Unit, CLI, and MCP tests for file-path body loading (offline; no live Help Scout calls)

### Changed

- Live integration tests in `test/integration/` are **opt-in** via `HELPSCOUT_RUN_INTEGRATION=1` (or `npm run test:integration`). Plain `npm test` stays offline even when credentials are present in the environment.
- Project docs: GitHub commit conventions (plain subjects, `#N` / `Closes #N`; no `MLH-` subject prefix for new work)

## [1.4.1] — 2026-07-09

### Fixed

- `update_article` / `docs article update` now follow Docs API `categories` semantics on update: omit = unchanged, `null` / `--clear-categories` = move to Uncategorized, array = replace (empty array normalizes to `null`; Uncategorized id must not be passed in an array) ([API docs](https://developer.helpscout.com/docs-api/articles/update/))

## [1.4.0] — 2026-07-09

### Added

- Full Docs API **field parity** — CLI flags and MCP tool schemas now expose every documented request body field, query param, and multipart form field across articles, collections, categories, redirects, and sites
- Shared request builders (`src/docs-request-builders.js`) and Zod schemas (`src/docs-api-schemas.js`) used by both CLI and MCP to prevent drift
- Machine-readable field metadata on `docs/docs-api-endpoints.json` (`bodyFields`, `queryParams`, `requiredBody`, `formFields`)
- Field coverage test (`test/docs-api-field-coverage.test.js`) and endpoint→tool mapping (`src/docs-api-field-map.js`)
- Articles: `slug`, `categories[]`, `related[]`, `keywords[]` on create/update; `--clear-categories`, `--clear-related`, `--clear-keywords` on update; list/search sort/order/pageSize; list default `--status all`
- Sites: all accepted create/update fields (logo, favicon, contact form, stylesheet, header code, etc.)
- Collections/categories: `sort` and `order` query params; collection update `siteId` move and `reload`
- Redirect update: fetch-then-merge so all three required body fields are sent; `siteId` and `reload`
- Site restrictions: explicit `authentication` param (MCP and CLI)

### Changed

- `create_article` / `docs article create` now require `text` (matches API)
- Scraper extracts Accepted Fields and query params from developer.helpscout.com pages
- Catalog path corrections: article view count uses `/views`; site restrictions use `/restricted`

## [1.3.1] — 2026-07-09

### Fixed

- `docs article get-revision` and MCP `get_article_revision` returned HTTP 404 — use the correct Docs API endpoint `GET /v1/revisions/{id}` instead of `/articles/{articleId}/revisions/{revisionId}` ([API docs](https://developer.helpscout.com/docs-api/articles/revisions/get/))

## [1.3.0] — 2026-07-09

### Added

- Full Docs API v1 parity — 39 endpoints across articles, assets, categories, collections, redirects, and sites with matching CLI commands and MCP tools (61 MCP tools total, up from 29)
- Shared create-response parsing for `201` responses with empty bodies — Docs API `Location` header and Mailbox API `Resource-ID` header now yield `{ id, location }` on create
- Optional `reload=true` on Docs article/collection create (CLI `--reload`, MCP `reload` param) to return the full resource without a follow-up GET
- Multipart asset upload support (`docs asset create-article`, `docs asset create-settings`)
- Endpoint catalog at `docs/docs-api-endpoints.json` and `npm run scrape:docs-api` Playwright scraper to refresh it
- Coverage test ensuring catalog, CLI commands, and MCP tools stay in sync

### Changed

- Docs article list requires `--collection` or `--category` (matches API scoping)
- MCP Docs tools moved to `src/mcp-server-docs.js` via `registerDocsTools()`
- `create_conversation`, `create_customer`, and all Docs create MCP tools return resource IDs when the API provides them

## [1.2.2] — 2026-07-09

### Fixed

- Docs `--all` pagination (`docs article search/list`, `docs collection list`, and MCP list/search tools with `all: true`) returned no results — `docs.getAll()` now unwraps nested API envelopes such as `{ articles: { items, pages } }` instead of expecting top-level `items`
- MCP server failed for Docs API calls in Cursor and Cursor CLI because subprocesses do not inherit shell profile env vars — credentials are loaded from `~/.config/helpscout/env` at startup, `install.sh` seeds that file on first install, and Cursor registration includes `envFile`

## [1.2.1] — 2026-07-09

### Fixed

- `install.sh` no longer fails on re-run when the helpscout MCP server is already registered in Claude Code — `register-mcp.js` checks the existing config and skips when the command path is unchanged, or removes and re-adds when it needs updating

## [1.2.0] — 2026-07-09

### Added

- `scripts/register-mcp.js` — registers the MCP server with Claude Code (when `claude` is on PATH) and Cursor (when detected), merging into `~/.cursor/mcp.json` without clobbering other servers
- Unit tests for MCP registration merge logic, idempotency, and malformed-config handling

### Changed

- `install.sh` now uses `register-mcp.js` instead of calling `claude mcp add` directly; install succeeds when only one editor is present (or neither)

## [1.1.0] — 2026-07-08

### Added

- `helpscout inbox webhook create --payload-version <v2|v3>` — opt into Mailbox API V3 webhook payloads, which preserve the `system_user` type on conversation data so AI agents can be distinguished from regular users (V2 remains the default)
- User status support, matching the Mailbox API's Set/Get/List User Status endpoints:
  - CLI: `helpscout inbox user status get <id>`, `helpscout inbox user status list [--all]`, `helpscout inbox user status set <id> --status <active|away> [--text] [--emoji] [--emoji-name]`
  - MCP tools: `get_user_status`, `list_user_statuses`, `set_user_status` (29 MCP tools total, up from 26)

### Fixed

- Crash on write endpoints (e.g. Docs `POST/PUT /articles`) that return a 200/201 with an empty body instead of JSON — `request()` in both `docs-client.js` and `mailbox-client.js` now safely returns `null` for empty responses instead of throwing on JSON parsing
- MCP tools `create_article`, `update_article`, `create_conversation`, and `create_customer` now handle the empty-body case above correctly instead of returning `"null"` to the calling agent
- `helpscout --version` and the MCP server's reported version now read from `package.json` instead of a hardcoded string
- Raised minimum Node version to `>=20.10.0` (previously `>=20.0.0`), which is what's actually required by JSON import attribute syntax already in use

### Changed

- Extracted shared `USER_AGENT` and `parseJsonBody()` helpers (`src/http.js`) out of duplicated logic in `mailbox-client.js` and `docs-client.js`

## [1.0.0] — 2026-04-01

### Added

- CLI binary (`helpscout`) covering the full Help Scout Mailbox API v2 and Docs API v1
- MCP server binary (`helpscout-mcp`) exposing 26 tools for agent use with Claude Code and Claude Desktop
- OAuth 2.0 authentication with 48-hour token caching and silent auto-refresh
- Conversations: list, get, create, update, delete (with filters for status, tag, assignee)
- Threads: list, reply, add internal note
- Customers: list, get, create, update
- Mailboxes: list, get
- Users: list, get, me
- Tags: list
- Webhooks: list, get, create, delete
- Docs Articles: list, get, search, create, update, delete
- Docs Collections: list, get
- Auto-detecting output: JSON when piped, pretty tables in terminal
- `--json`, `--pretty`, and `--markdown` output flags on all list commands
- Rate limit handling (429) with automatic retry
- Automatic token refresh on 401
- `install.sh` for one-step installation to `/usr/local/bin`
