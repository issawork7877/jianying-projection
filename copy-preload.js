#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const src = path.resolve(process.cwd(), 'preload.js');
const dest = path.resolve(process.cwd(), 'dist/preload.js');
if (!fs.existsSync(path.dirname(dest))) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
}
fs.copyFileSync(src, dest);
console.log('✅ Copied preload.js to dist/');
