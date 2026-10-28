import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  sonarjs.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'react/no-danger': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'd3', message: 'Use modular d3-* packages (scale, shape, array, time, time-format).' },
            { name: 'd3-selection', message: 'D3 must not touch the DOM; React renders SVG, GSAP animates.' },
          ],
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'coverage/**', '.checkpoints/**', 'next-env.d.ts']),
]);
