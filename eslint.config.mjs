import typescriptEslint from '@typescript-eslint/eslint-plugin';
import testingLibrary from 'eslint-plugin-testing-library';
import tanstackEslintPluginQuery from '@tanstack/eslint-plugin-query';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/dev-dist',
      '**/sw.js',
      '**/generated.ts',
      '**/playwright-report/**',
      'packages/components',
      'packages/utils/src/locales/*'
    ]
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:@typescript-eslint/recommended'
  ),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'testing-library': testingLibrary,
      '@tanstack/query': tanstackEslintPluginQuery
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.node,
        cy: true
      },

      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },

    settings: {
      react: {
        version: 'detect'
      }
    },

    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'no-unused-vars': 'off',
      'no-console': 'off',
      'linebreak-style': ['error', 'unix'],
      semi: ['error', 'always'],

      quotes: [
        'error',
        'single',
        {
          avoidEscape: true
        }
      ],

      'react/display-name': 0,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 0,
      'testing-library/await-async-utils': 'error',
      'testing-library/no-debugging-utils': 'off',
      'testing-library/no-node-access': 'off',
      'ui-testing/no-hard-wait': 'off'
    }
  },
  {
    files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
    plugins: {
      'testing-library': testingLibrary
    },
    rules: {
      'testing-library/await-async-utils': 'error',
      'testing-library/no-container': 'error',
      'testing-library/no-debugging-utils': 'off',
      'testing-library/no-node-access': 'off'
    }
  }
];
