// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    languageOptions: {
      parserOptions: {
        project: true,
        // @ts-expect-error 2339
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettierConfig,
  {
    ignores: ['lib/*', 'dist/*', 'localized/*'],
  },
);
