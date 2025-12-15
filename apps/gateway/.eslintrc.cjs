module.exports = {
  root: true,
  extends: ['@temporium/eslint-config'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  env: {
    browser: true,
    es2020: true,
  },
  ignorePatterns: ['dist/', 'node_modules/', 'vite.config.ts', '*.gen.ts'],
};
