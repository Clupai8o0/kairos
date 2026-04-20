// eslint.config.mjs
import { createRequire } from 'module';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const require = createRequire(import.meta.url);

const noProjectEntity = require('./eslint-rules/no-project-entity.js');
const noLlmProviderImports = require('./eslint-rules/no-llm-provider-imports.js');
const noRawColors = require('./eslint-rules/no-raw-colors.js');
const noResendImports = require('./eslint-rules/no-resend-imports.js');

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  {
    plugins: {
      kairos: {
        rules: {
          'no-project-entity': noProjectEntity,
          'no-llm-provider-imports': noLlmProviderImports,
          'no-raw-colors': noRawColors,
          'no-resend-imports': noResendImports,
        },
      },
    },
    rules: {
      'kairos/no-project-entity': 'error',
      'kairos/no-llm-provider-imports': 'error',
      'kairos/no-raw-colors': 'error',
      'kairos/no-resend-imports': 'error',
    },
  },
]);

export default eslintConfig;
