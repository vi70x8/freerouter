# Design — FreeLLMProxy Submodule Integration

---

## D1: Current Architecture (As-Is)

```
~/freerouter/                         ~/freeproxy/
├── server/                            ├── src/
│   ├── src/                           │   ├── worker.ts      (dispatch by WORKER_ROLE)
│   │   ├── app.ts      (Express)      │   ├── router.ts      (auth, URL decode, proxy select)
│   │   ├── routes/                    │   ├── proxy.ts       (header strip, fake IP, upstream fetch)
│   │   └── providers/                │   ├── fake-ip.ts
│   └── data/          (SQLite)        │   ├── base64url.ts
├── client/           (Vite/React)    │   ├── public.ts      (URL encoder page)
├── shared/                            │   ├── http.ts
├── scripts/cli.mjs    (api start/stop)│   ├── url-normalize.ts
├── package.json       (monorepo root) │   └── regions.txt
└── docker-compose.yml                 ├── scripts/deploy.ts  (TOML gen + wrangler deploy)
                                       ├── wrangler.toml     (base config for dev)
                                       ├── package.json
                                       └── .env.example
```

Two completely separate git repos. The proxy lives at `~/freeproxy` tracking `animaios/freeproxy` (fork of `vadash/llm-proxy`). The gateway knows nothing about it.

---

## D2: Target Architecture (To-Be)

```
~/freerouter/
├── server/
├── client/
├── shared/
├── scripts/
│   ├── cli.mjs           (api start/stop)
│   └── proxy-integrate.mjs  ← NEW: auto-init, env bootstrap, deploy orchestration
├── freellmproxy/             ← GIT SUBMODULE (was ~/freeproxy)
│   ├── src/                  (unchanged)
│   ├── scripts/deploy.ts     (unchanged)
│   ├── wrangler.toml         (unchanged)
│   ├── package.json          (unchanged)
│   ├── .env                  (auto-generated, gitignored)
│   └── node_modules/         (installed via postinstall)
├── .gitmodules               ← NEW: tracks freellmproxy
├── package.json              ← MODIFIED: add scripts + postinstall
└── .github/workflows/ci.yml  ← MODIFIED: add submodule checkout + proxy test
```

The proxy becomes a subtree of the monorepo via git submodule. All proxy source files remain untouched. Integration logic lives entirely in the monorepo's `scripts/` and `package.json`.

---

## D3: Submodule Configuration

### .gitmodules

```ini
[submodule "freellmproxy"]
	path = freellmproxy
	url = https://github.com/animaios/freeproxy.git
	branch = main
```

### Adding the submodule (one-time, during implementation)

```bash
# From the monorepo root
git submodule add -b main https://github.com/animaios/freeproxy.git freellmproxy
git submodule update --init --recursive
```

This creates:
- `.gitmodules` (tracked)
- `freellmproxy/` (gitlink — the submodule pointer)
- `.git/modules/freellmproxy/` (local, not tracked)

### Updating the submodule (daily driver workflow)

```bash
# Pull latest from upstream
git submodule update --remote freellmproxy
# Or from inside the submodule:
cd freellmproxy && git pull origin main
```

---

## D4: Postinstall / Auto-Init Script

### `scripts/proxy-integrate.mjs`

This is the **single orchestration script** that handles everything. It runs as `postinstall` and also as the backend for `npm run proxy:deploy`.

```
proxy-integrate.mjs <command>

Commands:
  init        Auto-init submodule if missing, install deps
  env         Bootstrap freellmproxy/.env if missing
  deploy      Full pipeline: init → env → install → wrangler deploy
  dev         Run wrangler dev
  status      Run wrangler deployments list
  test        Run proxy vitest
```

### init flow

```
┌─────────────────────────────────────────────┐
│  npm install (root)                         │
│                                             │
│  1. Root npm workspaces install             │
│     (server, client, shared)               │
│                                             │
│  2. postinstall hook fires                 │
│     → node scripts/proxy-integrate.mjs init│
│                                             │
│  3. Check: does freellmproxy/ exist?        │
│     ├─ YES → Check: node_modules/ ?         │
│     │        ├─ YES → done                  │
│     │        └─ NO  → npm install --prefix  │
│     │                 freellmproxy          │
│     └─ NO  → Check: .git/modules/freellmproxy? │
│              ├─ YES → git submodule update  │
│              │        --init --recursive     │
│              │        then npm install       │
│              └─ NO  → echo warning, continue│
│                       (non-fatal for CI)    │
└─────────────────────────────────────────────┘
```

Key invariants:
- **Idempotent**: running twice is a no-op
- **Non-fatal on missing**: if `.git/modules/freellmproxy/` doesn't exist (shallow clone, no submodules), log a warning and continue. Don't block the main gateway install.
- **No interactive prompts**: everything is automated

---

## D5: Environment Bootstrap

```
┌─────────────────────────────────────────────┐
│  node scripts/proxy-integrate.mjs env       │
│                                             │
│  1. Check: does freellmproxy/.env exist?    │
│     ├─ YES → skip (never overwrite)         │
│     └─ NO  → Generate:                      │
│                                             │
│       AUTH_KEY = ?                          │
│         ├─ Read freerouter/.env              │
│         │  ENCRYPTION_KEY → first 16 hex    │
│         └─ Fallback:                        │
│            crypto.randomBytes(16) → hex     │
│            → slice(0, 16)                   │
│                                             │
│       INTERNAL_AUTH_SECRET = ?              │
│         └─ Always fresh:                    │
│            crypto.randomBytes(32).toString   │
│            ('hex')                           │
│                                             │
│       PROXY_COUNT = 3                       │
│                                             │
│       ROUTER_DOMAIN = ?                     │
│         ├─ Read freerouter/.env              │
│         │  PROXY_ROUTER_DOMAIN if set        │
│         └─ Fallback: router.example.com     │
│                                             │
│  2. Write freellmproxy/.env                 │
│  3. Print: ✅ Generated freellmproxy/.env   │
│     with defaults. Edit ROUTER_DOMAIN       │
│     before deploying to production.         │
│     Note: custom domain must also be        │
│     configured in the Cloudflare dashboard. │
└─────────────────────────────────────────────┘
```

The `AUTH_KEY` derivation from the gateway's `ENCRYPTION_KEY` creates a natural link: if you have a working gateway, you already have a strong key source. The `INTERNAL_AUTH_SECRET` is always freshly generated because it's router↔proxy internal auth — there's no reason to reuse the gateway's key for a different trust boundary.

---

## D6: Deploy Pipeline

```
┌─────────────────────────────────────────────┐
│  npm run proxy:deploy                       │
│     = node scripts/proxy-integrate.mjs deploy│
│                                             │
│  1. Check wrangler available               │
│     (try `wrangler --version`, fallback     │
│      to `npx wrangler --version` in proxy)  │
│     └─ Both fail → print error, exit 1      │
│                                             │
│  2. Run init (D4)                           │
│     Ensure submodule + deps                 │
│                                             │
│  3. Run env (D5)                            │
│     Ensure .env exists                      │
│                                             │
│  4. cd freellmproxy &&                      │
│     npx tsx scripts/deploy.ts               │
│     └─ Existing deploy script unchanged     │
│        - Reads .env itself (no need to      │
│          pre-load into process.env)         │
│        - Generates TOML into dist/          │
│        - Deploys proxies in parallel         │
│        - Deploys router last                │
│        - Retries failures 3x                │
│        - Prints summary table               │
│                                             │
│  5. Exit with deploy.ts exit code           │
└─────────────────────────────────────────────┘
```

The deploy script is `scripts/deploy.ts` which already exists in the proxy repo. We invoke it unchanged via `npx tsx scripts/deploy.ts` (the proxy has `tsx` as a devDependency). The deploy script reads `.env` itself — no need to pre-load env vars into `process.env`. The orchestration script only handles the steps *before* deploy: prerequisites, submodule, env.

---

## D7: NPM Script Wiring

### Root `package.json` additions

```jsonc
{
  "scripts": {
    // Existing (modified):
    "dev": "concurrently --kill-others-on-fail ...",
    "dev:lan": "concurrently ...",
    "test": "npm run test -w server && npm run typecheck -w client && npm run proxy:test",
    "build": "npm run build -w server && npm run build -w client",
    "build:server": "npm run build -w server",

    // NEW:
    "postinstall": "node scripts/proxy-integrate.mjs init",
    "proxy:deploy": "node scripts/proxy-integrate.mjs deploy",
    "proxy:dev": "cd freellmproxy && npx wrangler dev",
    "proxy:status": "cd freellmproxy && npx wrangler deployments list",
    "proxy:test": "node scripts/proxy-integrate.mjs test"
  }
}
```

> **Note on `proxy:test`:** Uses the orchestration script (not `cd && npm test`) so it can handle the case where `freellmproxy/` is absent gracefully (R12.3). When the submodule exists, it delegates to `npm test --prefix freellmproxy`.

### Why `postinstall` and not `prepare`

`prepare` runs on `npm install` **and** `npm pack`. `postinstall` runs only on `npm install`. Since our script installs a submodule's deps, we want `postinstall` — we don't want it running during `npm pack`. 

However, `postinstall` has a caveat: it runs after every `npm install` (including in CI). The script must be idempotent (R6.2) and non-fatal on missing submodule (R6.3).

---

## D8: CI Workflow Modification

The current CI runs individual workspace commands directly (not the root `npm test` script). The modification adds submodule checkout and a proxy test step.

### `.github/workflows/ci.yml` — full target state

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          submodules: recursive   # ← NEW: ensures freellmproxy/ is populated

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm install --include=dev   # postinstall will install proxy deps

      - run: npm run test:coverage -w server
      - run: npm run proxy:test          # ← NEW: proxy vitest suite
      - run: npm run typecheck -w client
      - run: npm run build

      # Coverage upload (unchanged)
```

> **Important:** CI does **not** run `npm test` (the root script). Each step runs independently so failures are attributed clearly. The `proxy:test` step (R10.1 item 4) is a separate CI step, not chained into the root `test` script.

If the `submodules: recursive` checkout option is missing, the postinstall script will detect the absent submodule directory, log a warning, and continue. The `proxy:test` step will fail with a clear error, which is the correct CI signal.

---

## D9: Gateway → Proxy Registration (Configuration Only)

The gateway already supports custom providers (`server/src/routes/custom.ts` — `createProviderSchema`, `buildProviderFor`). To route traffic through the deployed proxy:

1. **Configure the domain**: In the Cloudflare dashboard, add a custom domain for the `llm-proxy-router` worker (Workers & Pages → Settings → Domains). The proxy's `deploy.ts` does not yet configure routes automatically.
2. **Determine your target**: e.g., `https://api.openai.com/v1`
3. **Base64url-encode it**: `node -e "console.log(Buffer.from('https://api.openai.com/v1').toString('base64url'))"` → `aHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MQ`
4. **Construct proxy URL**: `https://{ROUTER_DOMAIN}/{AUTH_KEY}/{PROXY_NUM}/{BASE64_URL}`
   e.g., `https://router.example.com/myauthkey/1/aHR0cHM6Ly9hcGkub3BlbmFpLmNvbS92MQ`
5. **In the dashboard**: Keys page → Add custom provider → Base URL = the proxy URL → Done

The proxy auto-discovers models via `/v1/models`. The request flow becomes:

```
Client → Gateway (port 3001)
  → Cloud Proxy Router (router.example.com)
    → Proxy Worker #N (Azure region)
      → Upstream API (with fake IP, stripped headers)
```

This is a pure configuration step. No gateway code changes.

---

## D10: Rollback Path

```
Remove submodule:
  git submodule deinit -f freellmproxy
  git rm -f freellmproxy
  rm -rf .git/modules/freellmproxy
  # Remove proxy:* scripts from package.json
  # Remove postinstall script
  # Remove .gitmodules if empty

Remove the proxy-integrate.mjs script:
  git rm scripts/proxy-integrate.mjs

Revert CI:
  Remove submodules: recursive from checkout

Result: Monorepo works exactly as before. Deployed Cloudflare Workers are unaffected.
```
