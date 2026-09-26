import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default defineConfig({
  files: ['**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}'],

  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    tseslint.configs.stylistic,
    prettierConfig,
  ],

  ignores: ['node_modules/**', 'dist/**', 'build/**'],
});
