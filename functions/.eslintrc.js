module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'google',
  ],
  rules: {
    'quotes': ['error', 'single'],
    'max-len': ['error', {'code': 120}],
    'linebreak-style': ['error', 'windows'],
    'object-curly-spacing': 'off',
    'comma-dangle': 'off',
    'arrow-parens': 'off',
    'valid-jsdoc': 'off',
    'require-jsdoc': 'off',
    'no-trailing-spaces': 'off',
    'padded-blocks': 'off',
    'no-unused-vars': 'warn',
    'indent': 'off',
  },
  parserOptions: {
    ecmaVersion: 2020,
  },
};
