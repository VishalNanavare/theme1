import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'src/*.html', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message: 'Use textContent, or a sanitised template helper. innerHTML with dynamic data is banned.',
        },
        { property: 'outerHTML', message: 'Use DOM construction instead of outerHTML assignment.' },
        {
          property: 'insertAdjacentHTML',
          message: 'Use DOM construction (insertAdjacentText, createElement) instead. Raw HTML injection is banned.',
        },
        {
          object: 'document',
          property: 'write',
          message: 'document.write is banned. Use DOM construction instead.',
        },
        {
          property: 'setHTMLUnsafe',
          message: 'setHTMLUnsafe is banned — it is unsanitised HTML injection. Use DOM construction instead.',
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: '$', message: 'jQuery is banned in theme1.' },
        { name: 'jQuery', message: 'jQuery is banned in theme1.' },
      ],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: { 'no-console': 'off' },
  },
];
