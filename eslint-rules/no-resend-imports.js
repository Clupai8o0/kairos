// eslint-rules/no-resend-imports.js
// Bans direct resend imports outside lib/email/ (mirrors ADR-R10 for email provider).
const ALLOWED_PATH_FRAGMENTS = ['/lib/email/'];

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow resend imports outside lib/email/.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWED_PATH_FRAGMENTS.some((f) => filename.includes(f))) return {};
    return {
      ImportDeclaration(node) {
        const source = /** @type {string} */ (node.source.value);
        if (source === 'resend' || source.startsWith('resend/')) {
          context.report({
            node,
            message:
              "Direct 'resend' imports are only allowed inside lib/email/ (ADR-R10 analogue). Use lib/email/send.ts instead.",
          });
        }
      },
    };
  },
};
