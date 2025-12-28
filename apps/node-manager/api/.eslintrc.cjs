module.exports = {
  root: true,
  extends: ['@temporium/eslint-config/backend'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
