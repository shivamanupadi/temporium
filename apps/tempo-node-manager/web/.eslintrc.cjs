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
  ignorePatterns: ['dist/', 'node_modules/', 'vite.config.ts', 'vite.config.d.ts', 'vite.config.js', '*.gen.ts', 'src/components/ui/'],
};
