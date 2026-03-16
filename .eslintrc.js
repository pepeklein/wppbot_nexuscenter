module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:jsdoc/recommended',
    'plugin:prettier/recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['jsdoc', 'prettier'],
  rules: {
    'prettier/prettier': 'error',
    'jsdoc/require-returns-description': 'off',
    'jsdoc/require-param-description': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
