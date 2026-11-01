import {fixupConfigRules, fixupPluginRules} from '@eslint/compat';
// eslint-disable-next-line import/no-unresolved
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import jest from 'eslint-plugin-jest';
import globals from 'globals';
// eslint-disable-next-line import/no-unresolved
import tsParser from '@typescript-eslint/parser';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import js from '@eslint/js';

// Use the CommonJS entry point until eslintrc supports minimatch 11 ESM exports.
const {FlatCompat} = createRequire(import.meta.url)('@eslint/eslintrc');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [
  ...fixupConfigRules(
    compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:import-x/errors',
      'plugin:import-x/warnings',
      'plugin:import-x/typescript',
      'plugin:prettier/recommended',
      'prettier'
    )
  ),
  {
    plugins: {
      '@typescript-eslint': fixupPluginRules(typescriptEslint),
      jest
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest
      },

      parser: tsParser,
      ecmaVersion: 2021,
      sourceType: 'module'
    }
  }
];
