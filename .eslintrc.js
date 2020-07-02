module.exports = {
  extends: [
    require.resolve('@darkobits/ts-unified/dist/config/eslint')
  ],
  rules: {
    '@typescript-eslint/naming-convention': 'off',
    'unicorn/no-reduce': 'off'
  }
};
