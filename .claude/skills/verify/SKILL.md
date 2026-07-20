---
name: verify
description: Repo-specific build/launch/drive recipe for air-lohas-controller-server (Next.js on Cloudflare Workers). Use when verifying a change end-to-end instead of cold-starting from README.
---

# Verifying air-lohas-controller-server

This app has two runtime surfaces: the HTTP app (Next.js pages/Server
Actions via `ACCESS_SECRET` auth) and the Cloudflare Workers **cron
trigger** (`worker.mjs` → `scheduled()`, which applies due
reservations from `src/lib/aircon-cron.ts`). Most behavior-changing
diffs touch the second one, and it has no browser surface — you must
drive it via `wrangler dev`, not `next dev`.

## Fast path: HTTP-only changes (UI, forms, routes)

```bash
ACCESS_SECRET=abc npm run dev -- --port 3901
# then open http://localhost:3901/?key=abc (sets an 8h auth cookie)
```

This uses the in-memory KV fallback (`src/lib/aircon-settings.ts`),
not real KV — fine for UI/form work, **not** for cron/KV-shape changes.

## Full path: cron / KV / worker.mjs changes

The cron logic can only be observed by actually running the
Cloudflare Worker locally with a real (local, ephemeral) KV binding
and firing the scheduled trigger:

```bash
npm run cf:build   # builds .open-next/worker.js that worker.mjs wraps
npx wrangler dev --env stg --local --port 8799 --test-scheduled
```

- `--env stg` is required to get an `AC_SETTINGS_KV` binding at all —
  the top-level `wrangler.jsonc` config has no KV namespace, only
  `env.stg`/`env.prod` do.
- `--local` is **required** to keep it local: `env.stg`'s KV entry has
  `"remote": true`, which would otherwise hit the real staging KV
  namespace on Cloudflare. `--local` forces local/ephemeral bindings
  regardless. Never drop `--local` here.
- `--test-scheduled` exposes `GET /__scheduled`, which fires the
  `scheduled()` handler once, synchronously, for local testing.
- `worker.mjs` bundles fine with direct `import ... from
  "./src/lib/....ts"` — wrangler's esbuild resolves `.ts` sources
  directly, no separate build step needed for that half.

Drive it:

```bash
# auth + inspect current state
curl -s "http://localhost:8799/?key=abc" | grep -o '.\{0,20\}℃.\{0,5\}'

# create a reservation via the real UI (Playwright), time in the past
# (JST) so it's immediately due — see e2e/reservations.spec.ts and
# e2e/helpers.ts for the interaction patterns (time input, mode
# button group, "予約追加" button).

# fire the cron trigger
curl -s "http://localhost:8799/__scheduled"

# check the wrangler dev log for the structured cron log line, e.g.:
#   {"type":"cron","level":"info","message":"applied","reservationId":...,
#    "mode":"heat","baseTemperature":27,"markedCount":1}

# confirm the home page now reflects the applied reservation
curl -s "http://localhost:8799/?key=abc" | grep -o '.\{0,20\}℃.\{0,5\}'

# re-fire /__scheduled — should log "skipped: no due reservations"
# (idempotency: lastAppliedDate already matches today in JST)
```

## Gotchas hit while setting this up

- Playwright's chromium needs system libs not in the devcontainer
  image: `sudo env "PATH=$PATH" npx playwright install-deps chromium`
  (plain `sudo npx ...` fails with "npx: command not found" — pass
  `PATH` through explicitly).
- `wrangler dev`/`opennextjs-cloudflare build` want to write to
  `~/.config/.wrangler` for logs/metrics; that path is outside this
  sandbox's writable set and needs `dangerouslyDisableSandbox` (or run
  outside the sandbox). Not a real bug — just sandbox-log noise.
- Do **not** run `cf:deploy:stg`/`cf:deploy:prod` or `wrangler deploy`
  (without `--dry-run`) as part of verification — those actually push
  to Cloudflare and, for prod, affect the real house's air
  conditioning. `--dry-run` is enough to confirm the worker bundles.

## Always also run

```bash
npm run test:unit   # vitest — src/lib/*.test.ts, fast, covers clamp/normalize/cron decision logic
npx tsc --noEmit
npm run lint
npm run test:e2e    # Playwright, spins up its own dev server on :3099
```
