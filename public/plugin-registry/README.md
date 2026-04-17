# Kairos Plugin Registry

Community plugins are submitted as JSON manifests to this directory.

## Submitting a plugin

1. Create a manifest JSON file following the `PluginManifestSchema` (see `@kairos/plugin-sdk`)
2. Validate it locally: `npx @kairos/plugin-validator path/to/manifest.json`
3. Add it to `manifests/` in a PR to the main Kairos repo
4. CI will validate automatically — fix any issues before requesting review
5. On merge, `index.json` is regenerated and your plugin appears in the marketplace

## Manifest format

See the existing manifests in `manifests/` for examples, or read the [plugin SDK docs](https://kairos.app/docs/plugins).