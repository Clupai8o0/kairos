# 06 — Design System

> **Status update:** the visual identity is no longer fully deferred. Phase 1 shipped a Linear-inspired pack at the `@theme` level (see `app/globals.css` and `DESIGN.md`). What's locked now is the *theme system* — how packs are defined, packaged, swapped, and (in phase 4) distributed via a marketplace. Visual decisions for additional packs still happen pack-by-pack.

This file owns the design system architecture. The token contract that every pack must satisfy lives in `12-theme-system.md`. The marketplace that distributes community packs lives in `13-theme-marketplace.md`.

---

## What's locked

These constraints hold regardless of any individual pack's visual choices:

1. **Multiple swappable design "packs" exist as first-class artefacts.** The old build had one theme with 6 accent swaps. The rewrite has multiple complete visual identities, switchable at runtime per user.
2. **Components reference semantic tokens only.** `bg-surface`, `fg-default`, `border-subtle`, `accent`, etc. — never raw Tailwind colour utilities (`bg-zinc-900`), never hex values inline. Enforced via ESLint rule (see `12-theme-system.md`).
3. **Tailwind v4 with `@theme` for token definitions.** Each built-in pack lives in `app/styles/packs/<name>.css`. Marketplace packs are JSON manifests compiled to CSS at install time.
4. **shadcn/ui as the component primitive layer.** Components written against semantic tokens via Tailwind utilities; shadcn provides accessibility and headless behaviour.
5. **Marketing pages and app pages share the design system.** No separate "marketing styles" — the landing page and the app use the same pack and the same components.
6. **Hybrid packaging (locked decision):** built-in packs ship as CSS files in the repo for performance and type safety; marketplace packs ship as JSON manifests so they install without a redeploy. Both satisfy the same token contract.
7. **Plugins can declare a pack dependency.** A plugin's manifest can reference a pack; installing the plugin makes the pack available in the user's pack picker. (Plugins do not *override* the active pack — that's a user choice.)

---

## What changed since the original deferral

| Before | Now |
|---|---|
| "Don't decide anything visual until phase 2" | Phase 1 shipped one pack (Linear-inspired). The system supports adding more without redesigning the architecture. |
| "Maybe a token file swap" | Locked: CSS for built-ins, JSON manifests for marketplace. |
| "Marketplace is hand-wavy" | Locked: ships in phase 4, shares registry infrastructure with the plugin marketplace. |
| "Pack switching maybe in settings" | Locked: settings panel + command palette, both backed by `userId -> activeThemeId` in DB. |

What's still deferred: which *additional* packs ship in v1 beyond the current Linear-inspired one, and the full set of optional/extended tokens beyond the required core. Those decisions happen pack-by-pack.

---

## Architecture overview

Three layers, each owned by a different file:

| Layer | What it owns | Where it's specified |
|---|---|---|
| **Token contract** | The semantic tokens every pack must define, the optional tokens packs may extend, validation rules | `12-theme-system.md` |
| **Packaging & runtime** | How CSS packs and JSON manifests are loaded, how active theme is persisted, how switching works | `12-theme-system.md` |
| **Distribution** | Marketplace registry, install flow, submission process, signing | `13-theme-marketplace.md` |

Phase 1-3 only need the first two. Phase 4 adds the third.

---

## How this integrates with the rest of the architecture

- **No new database tables in phase 2.** Active theme lives on `users.activeThemeId` (text column, defaults to `obsidian-linear` or whatever the v1 pack ends up named). Marketplace adds `themeInstalls` later — see `13-theme-marketplace.md`.
- **No new dependencies in phase 2.** Tailwind v4 already supports `@theme` blocks. The pack registry is a static TypeScript object for built-ins; no runtime CSS-in-JS, no theme provider library.
- **Marketplace shares infrastructure with the plugin marketplace.** One registry repo, one submission flow, one in-app browser with a tab for plugins and a tab for themes. ADR-R14 (in `architecture-decisions.md`) locks this.
- **Self-host vs hosted parity.** Marketplace browsing works in both modes. Self-hosters install themes the same way; the only difference is hosted mode tracks install counts for the registry.

---

## Decisions still open

These get resolved pack-by-pack as new packs are added; they don't block the architecture work:

1. The full set of optional semantic tokens beyond the required core (status colours, motion timings, type scale extensions). See `12-theme-system.md` "Optional tokens".
2. Which additional built-in packs ship before phase 4 (candidates: a light pack, a higher-contrast pack). At least one light pack should land before the marketplace opens, so contributors have a non-dark reference.
3. Whether accent swaps remain a sub-feature within a pack, or are removed entirely in favour of just shipping more packs. Leaning toward removal — accent swaps were a workaround for not having multiple packs.
4. Whether the command-palette pack switcher previews live as you arrow through, or only commits on enter. Leaning toward live preview.

---

## Until the second pack lands

Components in phase 1-2 use the current Linear-inspired pack via semantic tokens. The semantic-token discipline is enforced from day one even though only one pack exists, so when the second pack lands it's a token-file swap and not a refactor of every component. The ESLint rule banning raw colour utilities is the load-bearing piece — see `12-theme-system.md` for the rule definition.
