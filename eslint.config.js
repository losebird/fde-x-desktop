import eslint from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const files = [
  'src/components/surface/**/*.{ts,tsx}',
  'tests/visual/**/*.ts',
  'playwright.config.ts',
]

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'runtime/**', 'apps/**', 'resources/**'],
  },
  {
    files,
    extends: [eslint.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
)
