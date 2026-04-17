# 14 — Validator CLIs: Plugin + Theme

Two small npm packages that community contributors run before submitting to the registry, and that CI runs to block bad submissions from merging. They exist because:

1. The TODO's Phase 4 checklist calls out `@kairos/theme-validator` explicitly
2. The same problem shape applies to plugins — "is this manifest actually valid?" — so solve both at once
3. Contributors shouldn't have to open a PR, wait for CI, read the failure, fix, and re-push just to learn their manifest has a typo

## Package layout

```
packages/
├── validator-core/         <- shared I/O, formatting, exit codes
│   ├── package.json        <- name: @kairos/validator-core (private, not published)
│   └── src/
│       ├── index.ts
│       ├── output.ts       <- pretty printer (human) + JSON (CI)
│       ├── fs.ts           <- read file, resolve glob, fetch URL
│       └── types.ts        <- ValidationResult, ValidationIssue
│
├── plugin-validator/       <- @kairos/plugin-validator
│   ├── package.json        <- depends on: @kairos/validator-core, @kairos/plugin-sdk, zod, sigstore
│   ├── bin/
│   │   └── kairos-plugin-validator.mjs
│   └── src/
│       ├── index.ts
│       ├── cli.ts
│       ├── validate.ts     <- schema + safety checks (shared with lib/plugins/safety.ts)
│       └── sigstore.ts     <- optional provenance verification
│
└── theme-validator/        <- @kairos/theme-validator
    ├── package.json        <- depends on: @kairos/validator-core, @kairos/plugin-sdk (for ThemeManifestSchema), zod
    ├── bin/
    │   └── kairos-theme-validator.mjs
    └── src/
        ├── index.ts
        ├── cli.ts
        └── validate.ts     <- schema + safety checks (shared with lib/themes/safety.ts)
```

The schemas live in `@kairos/plugin-sdk` (already exists). The *validators* are thin CLI wrappers around those schemas + the safety-check functions already written for `lib/plugins/safety.ts` and `lib/themes/safety.ts`.

## Why three packages instead of one

Three options were considered:

### Option 1 — One combined `@kairos/validator` package
- **Pro:** single install, single invocation (`npx @kairos/validator plugin.json`)
- **Con:** theme authors have to download Sigstore + npm-related deps they'll never use; plugin authors have to download colour-parsing deps they'll never use. Not fatal, but bloats install size and attack surface.

### Option 2 — Two entirely separate packages
- **Pro:** no shared dependency
- **Con:** 80% of the code (file I/O, CLI arg parsing, output formatting, exit codes) is copy-paste between them. First bug fix forgets to land in one of them.

### Option 3 — Two public packages + one private `validator-core` (recommended)
- **Pro:** DRY via the shared core; each public package only pulls its own domain deps; single source of truth for output format; matches the existing `packages/plugin-sdk/` convention
- **Con:** three `package.json` files instead of one. Negligible for a pnpm workspace.

### Conclusion

**Option 3.** It's how the rest of the repo is organised and the extra file is worth the hygiene. `validator-core` stays private (not published to npm) — it's a workspace-only dep.

## `@kairos/plugin-validator`

### Usage

```bash
# Validate a local manifest
npx @kairos/plugin-validator path/to/manifest.json

# Validate a remote manifest
npx @kairos/plugin-validator https://example.com/manifest.json

# Validate and include provenance verification
npx @kairos/plugin-validator path/to/manifest.json --verify-provenance

# Validate all manifests in a directory (registry CI use case)
npx @kairos/plugin-validator public/plugin-registry/manifests/

# JSON output (for CI tooling)
npx @kairos/plugin-validator path/to/manifest.json --format json
```

### Checks performed

Every check from `lib/plugins/safety.ts`, run in-process with no DB or network unless `--verify-provenance` is passed or the input is a URL:

1. `PluginManifestSchema.parse()` — Zod validation
2. Size limit — warn at 32KB, fail at 64KB
3. URL allowlist — `endpoint` is `https://` and resolves to a public IP (skipped in CI where DNS may be sandboxed; always runs locally)
4. Handler declaration — `handlesInputTypes` non-empty, valid values
5. ID format — matches `/^[a-z0-9][a-z0-9-]*$/`, not a reserved built-in ID
6. Semver — `version` is valid semver
7. Consistency — `distribution === 'http'` implies `endpoint` set; `distribution === 'bundled'` implies `npmPackage` set
8. Shipped theme (if `manifest.theme` present) — delegates to the theme validator's checks
9. Capabilities are declared (not blank) for plugins that access external resources
10. `--verify-provenance` (optional) — fetches the provenance bundle, verifies via the `sigstore` package, checks the GitHub repo matches `manifest.repository`

### Exit codes

- `0` — no errors, no warnings
- `1` — warnings only (CI treats this as pass with `--strict=false`, fail with `--strict`)
- `2` — errors (CI always fails)
- `3` — CLI usage error (bad flags, missing file)

### Output format — human

```
✓ public/plugin-registry/manifests/instagram.json
  schema          ok
  size            2.1 KB
  url             https://kairos-plugin-instagram.vercel.app — ok
  handlers        [url]
  provenance      skipped (use --verify-provenance)

✗ public/plugin-registry/manifests/broken.json
  schema          FAIL
    · version: Invalid literal. Expected /^\d+\.\d+\.\d+$/, got "v1"
    · handlesInputTypes: Array must contain at least 1 element(s)
  size            ok

2 files checked, 1 error, 0 warnings
```

### Output format — JSON

```json
{
  "files": [
    { "path": "...", "ok": true, "issues": [] },
    {
      "path": "...",
      "ok": false,
      "issues": [
        { "level": "error", "code": "schema", "message": "version: Invalid..." }
      ]
    }
  ],
  "summary": { "total": 2, "errors": 1, "warnings": 0 }
}
```

## `@kairos/theme-validator`

### Usage

Same shape as the plugin validator:

```bash
npx @kairos/theme-validator path/to/theme.json
npx @kairos/theme-validator public/theme-registry/manifests/
npx @kairos/theme-validator theme.json --format json
```

### Checks performed

Every check from `lib/themes/safety.ts`:

1. `ThemeManifestSchema.parse()` — Zod validation
2. Size limit — 64KB
3. CSS injection scan — block `expression()`, `behavior:`, `-moz-binding`, `javascript:` protocol, `@import`/`url()` pointing outside the font allowlist
4. Font allowlist — `fontImports` URLs must be in the allowed set (`fonts.googleapis.com`, `rsms.me`, `cdn.jsdelivr.net`; overridable via `--font-allowlist=...`)
5. Token completeness — warn on missing required tokens, don't fail (the compile function fills defaults)
6. ID uniqueness — `themeId` not in the built-in set (`obsidian`, `parchment`, ...)
7. Preview swatch — `preview.canvas`, `surface`, `fg`, `accent` are valid CSS colour values
8. Colour contrast — warn if computed `fg`-on-`canvas` contrast is below 4.5:1 (AA)

### Exit codes

Same as the plugin validator.

## Shared: `@kairos/validator-core`

Private workspace package. Not published to npm.

Exports:

```typescript
export type ValidationLevel = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  level: ValidationLevel;
  code: string;            // machine-readable identifier
  message: string;         // human-readable
  path?: string;           // JSON path into the manifest, e.g. 'theme.tokens.canvas'
}

export interface FileResult {
  path: string;
  ok: boolean;
  issues: ValidationIssue[];
  timing: { durationMs: number };
}

export interface ValidationSummary {
  files: FileResult[];
  summary: { total: number; errors: number; warnings: number; };
}

export function readInput(pathOrUrl: string): Promise<string>;
export function resolveGlob(pathOrGlob: string): Promise<string[]>;
export function formatHuman(summary: ValidationSummary): string;
export function formatJson(summary: ValidationSummary): string;
export function exitCodeFor(summary: ValidationSummary, strict: boolean): number;
```

The two validator packages wire their domain-specific checks into this shell. No duplication of I/O or formatting code.

## Registry CI wiring

`.github/workflows/validate-plugin-registry.yml`:

```yaml
name: Validate plugin registry
on:
  pull_request:
    paths:
      - 'public/plugin-registry/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @kairos/plugin-validator build
      - name: Validate all manifests
        run: |
          node packages/plugin-validator/bin/kairos-plugin-validator.mjs \
            public/plugin-registry/manifests/ \
            --format json \
            --strict \
            > validation.json
          cat validation.json
      - name: Regenerate and assert index.json is up to date
        run: |
          pnpm --filter @kairos/plugin-validator build-index \
            public/plugin-registry/manifests/ \
            public/plugin-registry/index.json
          git diff --exit-code public/plugin-registry/index.json || (
            echo "::error::index.json is out of date. Run the validator locally and commit the result."
            exit 1
          )
```

A parallel workflow `.github/workflows/validate-theme-registry.yml` does the same thing for themes using `@kairos/theme-validator`.

## Publishing to npm

Both public validators publish via Changesets (already set up for `@kairos/plugin-sdk`). On every release:

```bash
pnpm changeset
pnpm changeset version
pnpm -r build
pnpm -r publish --provenance
```

`--provenance` means the validators themselves ship with Sigstore attestations — dogfooding the thing they help contributors set up.

## Local dev workflow for contributors

A plugin author's iteration loop:

```bash
# 1. Scaffold
npm create @kairos/plugin my-plugin

# 2. Implement

# 3. Validate before commit
npx @kairos/plugin-validator manifest.json

# 4. Validate with provenance if publishing
npx @kairos/plugin-validator manifest.json --verify-provenance

# 5. Submit PR to main kairos repo adding manifest.json to public/plugin-registry/manifests/
```

Step 1 (`npm create @kairos/plugin`) is a future nice-to-have, not in Phase 4b. For now, contributors copy an existing manifest.

## What's NOT in the validator

- Runtime testing of HTTP plugin endpoints — that happens in CI via a separate probe step (`GET /manifest` and compare), not in the validator. The validator is pure static analysis.
- Linting of plugin source code — plugins are opaque to the validator; it only checks manifests.
- Testing that plugins actually produce valid `ParseResult` output — that's the plugin author's responsibility via `@kairos/plugin-sdk/testing` (which already exists).
- Security scanning of npm dependencies (for bundled plugins) — use `npm audit` or Dependabot separately.
