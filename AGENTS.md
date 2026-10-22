# AGENTS.md — globex-b2b

> Canon: `~/github/vault/personal/agent-config/AGENTS.md`
> Org policy: [`muntianus/.github/AGENT_POLICY.md`](https://github.com/muntianus/.github/blob/main/AGENT_POLICY.md) ·
> [Repository Standard](https://github.com/muntianus/.github/blob/main/docs/standards/REPOSITORY_STANDARD.md)

## Repo-local rules

- **Zero dependencies.** Node ≥ 20 standard library only (`node:http`, `node:test`);
  adding an npm dependency needs an ADR.
- **Contract first.** A route change updates `ROUTES` in `src/server.js` and
  `docs/api/openapi.json` in the same commit; `tests/openapi-contract.test.js` fails on drift.
- **Config is env-only.** Every variable the code reads is listed in `.env.example`;
  never commit `.env`.
- **`GET /health` stays dependency-free** (liveness only).
- **The spec is generated from code.** `buildOpenApiSpec()` in `src/server.js` is the source of truth; after changing it run `npm run openapi` — `tests/openapi-export.test.js` fails when `docs/api/openapi.json` is stale.
- **Orders are all-or-nothing.** Lines are aggregated per SKU before the stock check; an order that does not fit reserves nothing (409 `INSUFFICIENT_STOCK`). Keep the duplicate-line regression tests green.
- Before pushing: `npm test`.
- Conventional commits; branch `feat/*` / `fix/*` / `chore/*`; never push to `main`.
