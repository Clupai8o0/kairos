// eslint-rules/no-project-entity.js
// Bans the identifier names Project, projectId, and projects as domain concepts.
// String literals and comments are intentionally not checked.
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow Project entity — there is no Project concept in Kairos. Use tags.',
    },
  },
  create(context) {
    const FORBIDDEN = /^(Project|projectId|projects)$/;

    return {
      Identifier(node) {
        if (FORBIDDEN.test(node.name)) {
          context.report({
            node,
            message: `"${node.name}" is forbidden. Kairos has no Project entity — use tags instead (ADR-R7).`,
          });
        }
      },
    };
  },
};
