import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  external: [
    'better-sqlite3',
    'node-imap',
    'nodemailer',
    'mailparser',
    'node-notifier'
  ],
  outExtension() {
    return {
      js: '.mjs'
    };
  }
});
