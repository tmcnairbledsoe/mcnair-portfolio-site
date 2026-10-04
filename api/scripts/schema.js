// The browser source is authoritative; package the same validator in standalone API artifacts.
const fs = require('node:fs');
const path = require('node:path');
const source = path.resolve(__dirname, '../../src/content/schema.js');
const target = path.resolve(__dirname, '../src/schema.js');
if (process.argv.includes('--check')) {
  const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (read(source) !== read(target)) throw new Error('Shared schema out of sync: run npm run build --prefix api');
} else if (fs.existsSync(source)) fs.copyFileSync(source, target);
else if (!fs.existsSync(target)) throw new Error('Packaged schema missing');
