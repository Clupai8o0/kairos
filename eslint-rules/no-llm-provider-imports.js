// eslint-rules/no-llm-provider-imports.js
// Bans direct LLM provider SDK imports outside lib/llm/ and lib/plugins/builtin/.
const FORBIDDEN = [
  'openai',
  '@anthropic-ai/sdk',
  '@anthropic-ai/bedrock-sdk',
  'cohere-ai',
  '@google/generative-ai',
  'groq-sdk',
  'mistralai',
  '@mistralai/mistralai',
];

const ALLOWED_PATH_FRAGMENTS = [
  '/lib/llm/',
  '/lib/plugins/builtin/',
];

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow direct LLM provider SDK imports outside lib/llm/ and lib/plugins/builtin/ (ADR-R10).',
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (ALLOWED_PATH_FRAGMENTS.some((f) => filename.includes(f))) return {};

    return {
      ImportDeclaration(node) {
        const source = /** @type {string} */ (node.source.value);
        const forbidden = FORBIDDEN.find(
          (pkg) => source === pkg || source.startsWith(pkg + '/'),
        );
        if (forbidden) {
          context.report({
            node,
            message: `Direct import of "${source}" is forbidden outside lib/llm/ and lib/plugins/builtin/ (ADR-R10). Use PluginContext.complete() instead.`,
          });
        }
      },
    };
  },
};
