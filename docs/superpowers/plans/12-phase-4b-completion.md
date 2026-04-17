# 12 — Phase 4b: Plugin Marketplace Completion

Phase 4 shipped the theme marketplace end-to-end but left the plugin marketplace unfinished. Themes got: registry, install API, safety checks, in-app browser, custom upload, 5 community themes. Plugins got: the host, the bundled `text-to-tasks`, four examples sitting in `examples/plugins/` with no way for a user to install them.

Phase 4b closes that gap. It does not add features — it finishes what 04-phases.md promised.

## What's already built (don't redo)

- `pluginInstalls` schema (exists in `lib/db/schema/plugins.ts`) — but only the built-in plugin gets rows via seed/install logic
- `lib/plugins/host.ts` — loader, registry, dispatcher (works, but only handles bundled plugins)
- `packages/plugin-sdk/` — `@kairos/plugin-sdk` with `definePlugin`, `createMockContext`
- `examples/plugins/` — 4 reference plugins as standalone repos' worth of code
- `app/api/plugins/route.ts`, `app/api/plugins/[name]/route.ts` — list + enable/disable
- `app/(app)/settings/marketplace/page.tsx` — Plugins tab exists but only shows locally-registered plugins

## What's missing (the Phase 4b scope)

From the unchecked items in `TODO.md` Phase 4:

1. **Plugin registry** — `kairos-plugins-registry` equivalent or `public/plugin-registry/` (mirror of theme registry)
2. **Plugin install flow** — install-from-registry, including fetching, validating, and inserting rows into `pluginInstalls`
3. **Plugin signing** — non-trivial; plugins execute code, themes don't
4. **Version management** — update notifications, changelogs, rollback
5. **`@kairos/plugin-validator` CLI** — plus `@kairos/theme-validator` (same shape, pair them)
6. **Plugin-shipped themes** — plugin manifest can declare a theme; installing the plugin also installs its theme
7. **Registry CI** — validates submitted manifests automatically
8. **Get to 10 plugins** — curate the 4 examples + ~6 more before launch

## Distribution model decision (load-bearing)

ADR-R3 left three options open: (1) npm-installed + redeploy, (2) HTTP plugins, (3) hybrid. This needs to be locked before any of the below gets built, because the rest of the plan forks on it.

### Option 1 — npm-installed, redeploy on install
User adds `@kairos-plugin/instagram` to `package.json`, redeploys. Marketplace UI would trigger `pnpm add` + Vercel rebuild hook.
- **Pro:** type-safe, fast at runtime, no network hop on parse, straightforward trust model (npm provenance)
- **Con:** every install is a redeploy (~2 min); hosted instance can't let users install plugins without Sam triggering a rebuild for each user; impossible in serverless multi-tenant

### Option 2 — HTTP plugins
Plugin authors deploy plugins as separate Vercel/Cloudflare functions. Kairos calls them over HTTP with a standardised contract.
- **Pro:** install without redeploy, isolation by default (plugin runs in its own process), works natively on hosted multi-tenant
- **Con:** network latency per parse (+200-500ms), more failure modes, plugin authors must maintain their own hosting, cold-start chaos

### Option 3 — Hybrid (recommended)
Built-in plugins (`text-to-tasks`) ship bundled. Community plugins default to HTTP. Advanced users can bundle a plugin at build time via a config file if they self-host and want zero latency.
- **Pro:** best of both for the two user groups (hosted wants HTTP, self-hosters who care about latency get bundling)
- **Con:** two paths to document, two code paths in the host

### Conclusion

**Go with Option 3.** Reasoning:

- The hosted instance at `kairos.app` is multi-tenant. Option 1 is architecturally incompatible with "user installs plugin without Sam doing anything."
- Option 2 alone rules out the power-user self-hoster who wants zero-latency Instagram parsing.
- Option 3 lets phase 4b ship HTTP-first (which is what unblocks the hosted marketplace) while leaving the npm-bundled path available for anyone who really wants it. The bundled path is essentially what already exists for `text-to-tasks`.
- Cost of implementing Option 3 vs Option 2: roughly 1 extra day of work (a bundle-time config hook). Cost of closing the door on Option 1: zero, it's already not implemented.

This becomes **ADR-R15** and gets promoted to `references/architecture-decisions.md` at session end.

## Build checklist

### Registry
- [ ] `public/plugin-registry/index.json` + `manifests/` (mirror theme registry structure)
- [ ] Plugin manifest schema (`PluginManifestSchema` in Zod, in `packages/plugin-sdk/src/manifest.ts`)
- [ ] Submission docs in `CONTRIBUTING.md`
- [ ] CI workflow in `.github/workflows/validate-plugin-registry.yml` — runs `@kairos/plugin-validator` on PRs touching `public/plugin-registry/`

### Install flow (mirrors theme install)
- [ ] `lib/plugins/install.ts` — `installFromRegistryUrl()`, `uninstallPlugin()`, `listInstalledPlugins()`
- [ ] `lib/plugins/safety.ts` — manifest safety checks (size, URL allowlist for HTTP plugins, signature verification if present)
- [ ] `app/api/plugins/install/route.ts` — POST
- [ ] `app/api/plugins/[installId]/route.ts` — DELETE (uninstall)
- [ ] `app/api/plugins/registry/route.ts` — GET (proxy for the registry index with TTL caching)
- [ ] `lib/hooks/use-plugins.ts` — add `useInstallPlugin`, `useUninstallPlugin`, `usePluginRegistry`

### Marketplace UI (extend existing Plugins tab)
- [ ] Plugins tab in `app/(app)/settings/marketplace/page.tsx` — currently only shows toggle; add registry-backed cards with Install / Uninstall / Configure
- [ ] Install count + "Update available" badge
- [ ] Configure button deep-links to plugin settings page (already exists for bundled, extend for installed)

### HTTP plugin runtime
- [ ] `lib/plugins/http-adapter.ts` — wraps a remote plugin URL as a `ScratchpadPlugin` (implements `canHandle` + `parse` by calling the remote endpoint)
- [ ] HTTP plugin contract: `POST /parse` with `ScratchpadInput` body, returns `ParseResult`; `GET /manifest` returns `PluginManifest`
- [ ] Request signing for self-host-to-plugin calls (HMAC with user-scoped secret)
- [ ] Timeout (5s default), retry (0), circuit breaker on repeated failure

### Signing
- [ ] Opt-in `provenance` field in `PluginManifest` pointing at a Sigstore bundle
- [ ] CI in plugin author's repo (GitHub Actions) generates provenance automatically via npm's `--provenance` flag
- [ ] `lib/plugins/safety.ts` verifies the bundle if present; absence is a warning, not a block, in v1

### Version management
- [ ] `pluginInstalls.version` column already exists — use it
- [ ] Update check: `lib/plugins/updates.ts` — on load, compare installed version against registry; expose via `GET /api/plugins/updates`
- [ ] Update button in UI — re-runs install flow with new version, preserves config + memory + rulesets
- [ ] Changelog display — manifest has `changelog` field, shown in update dialog
- [ ] Rollback — keep the last 2 versions in `pluginInstalls` (one active + one previous); rollback is a flip of `active` flag

### Validator CLI
- [ ] New package `packages/plugin-validator/` — `@kairos/plugin-validator`
- [ ] New package `packages/theme-validator/` — `@kairos/theme-validator` (same shape, different schema)
- [ ] Both share a common `packages/validator-core/` for I/O, output formatting, and exit codes
- [ ] Both callable as npx: `npx @kairos/plugin-validator path/to/manifest.json`
- [ ] Invoked in registry CI on every PR

### Plugin-shipped themes
- [ ] `PluginManifest.theme?: ThemeManifest` — optional field
- [ ] Plugin install handler, when manifest has `theme`, also calls `installManifest()` with `source: 'plugin'`
- [ ] `themeInstalls.source = 'plugin'` entries get a "via plugin X" badge (already in theme-marketplace.md spec, just needs UI work)
- [ ] Uninstalling the plugin uninstalls the theme

### Registry population
- [ ] Move the 4 examples in `examples/plugins/` into the registry with proper manifests
- [ ] Author 6 more plugins to hit the "10 plugins" target. Candidates: `gmail`, `gcal-import`, `notion-import`, `linear-import`, `todoist-import`, `pocket`

## Definition of done

- [ ] User installs a plugin from the in-app marketplace without leaving the app (registry → install → shows up in Plugins list → can configure)
- [ ] Plugin authors can submit via PR to `public/plugin-registry/` (or `kairos-plugins-registry` if split out)
- [ ] At least 10 plugins in the registry on launch
- [ ] Plugin authors can ship a theme as part of their plugin manifest
- [ ] CI in the registry validates submitted manifests automatically (via `@kairos/plugin-validator`)
- [ ] `@kairos/plugin-validator` + `@kairos/theme-validator` published to npm
- [ ] At least one plugin ships with Sigstore provenance and verifies on install
- [ ] Update available → click Update → version bumps, config + memory preserved
- [ ] Rollback: install v2, roll back to v1, verify config + memory survive

## Order of work (suggested sessions)

Each session is sized to fit one Claude Code session (~2-3 hours of implementation) without straying past 250 lines per file.

1. **Session 11 — ADR-R15 + registry scaffolding.** Lock the distribution decision in architecture-decisions.md. Create `public/plugin-registry/` structure mirroring theme registry. Define `PluginManifestSchema` in the SDK. Author manifests for the 4 existing examples. No install flow yet.

2. **Session 12 — Validator CLIs.** Build `packages/validator-core/`, `packages/plugin-validator/`, `packages/theme-validator/`. Wire them into `.github/workflows/validate-plugin-registry.yml` (and the existing theme registry CI). Publish to npm via Changesets.

3. **Session 13 — HTTP adapter + install flow.** `lib/plugins/http-adapter.ts`, `lib/plugins/install.ts`, `lib/plugins/safety.ts`. New API routes. Unit tests for the adapter using msw.

4. **Session 14 — Marketplace UI + update check.** Extend the Plugins tab. Add update check + badge. `lib/plugins/updates.ts`.

5. **Session 15 — Signing + plugin-shipped themes + rollback.** Sigstore verification in safety.ts. Plugin manifest `theme` field + install handler wiring. Rollback flip logic.

6. **Session 16 — Ship 6 more plugins.** Author manifests + (for the HTTP plugins) deploy their endpoints. Hit the 10-plugin target.

7. **Session 17 — Definition-of-done walkthrough.** End-to-end smoke: install a community plugin from the UI on a fresh Vercel preview, verify everything works, tick remaining boxes, tag `v1.1.0`.

## What this does not include

- Paid plugins, revenue split, Stripe — not happening in v1.x
- Plugin sandboxing beyond HTTP isolation — no V8 isolates, no WebAssembly runtime in v1. HTTP plugins run in their author's serverless function; bundled plugins run in Kairos's trusted process.
- Plugin-to-plugin communication or dependencies — every plugin is standalone
- Multi-version installs for the same plugin — one install per (user, pluginName)
- Private plugin registries / enterprise plugin stores — post-v1

## Files in this phase

Document set (this folder):
- `12-phase-4b-completion.md` — this file
- `13-plugin-marketplace.md` — full spec (registry, install, HTTP runtime, signing, versioning)
- `14-plugin-validator-cli.md` — `@kairos/plugin-validator` + `@kairos/theme-validator`

Repo additions:
- `public/plugin-registry/index.json`, `public/plugin-registry/manifests/*.json`
- `packages/validator-core/`, `packages/plugin-validator/`, `packages/theme-validator/`
- `lib/plugins/install.ts`, `lib/plugins/safety.ts`, `lib/plugins/http-adapter.ts`, `lib/plugins/updates.ts`
- `app/api/plugins/install/route.ts`, `app/api/plugins/[installId]/route.ts`, `app/api/plugins/registry/route.ts`, `app/api/plugins/updates/route.ts`
- `.github/workflows/validate-plugin-registry.yml`
- New entry in `references/architecture-decisions.md` for ADR-R15
