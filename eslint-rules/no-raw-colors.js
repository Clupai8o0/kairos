// eslint-rules/no-raw-colors.js
// Bans raw Tailwind color utilities, hex literals, and color functions
// in component files. Pack files under app/styles/packs/ are exempt.

const TAILWIND_COLOR_RE = /\b(bg|text|border|ring|fill|stroke|from|to|via)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const COLOR_FN_RE = /\b(rgb|rgba|hsl|hsla|oklch|oklab)\s*\(/;

const ALLOWED_PATHS = [
  /app[/\\]styles[/\\]packs[/\\]/,
  /lib[/\\]themes[/\\]compiled[/\\]/,
  // Test files may contain literal color values as data (e.g. manifest fixtures)
  /[/\\]tests[/\\]/,
  /\.test\.[jt]sx?$/,
  // Docs pages and theme upload — legitimately show color values as code examples
  /app[/\\]\(marketing\)[/\\]docs[/\\]/,
  /settings[/\\]appearance[/\\]custom[/\\]/,
  // Landing page uses theme-swatch preview colors that are intentionally arbitrary hex
  /app[/\\]\(marketing\)[/\\]page\.[jt]sx?$/,
];

module.exports = {
  meta: {
    type: 'problem',
    docs: { description: 'Ban raw colour literals outside theme pack files' },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWED_PATHS.some((re) => re.test(filename))) return {};
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (
          TAILWIND_COLOR_RE.test(node.value) ||
          HEX_RE.test(node.value) ||
          COLOR_FN_RE.test(node.value)
        ) {
          context.report({
            node,
            message: 'Raw colour literal — use a semantic token from the active theme pack.',
          });
        }
      },
    };
  },
};
