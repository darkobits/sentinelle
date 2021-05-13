module.exports = {
  extends: require('@darkobits/ts').eslint,
  rules: {
    '@typescript-eslint/naming-convention': 'off',
    'unicorn/no-nested-ternary': 'off',
    'unicorn/no-reduce': 'off'
  }
};
