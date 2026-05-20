#!/usr/bin/env node
/**
 * 国际版预构建脚本
 * 将数据文件切换为国际版（仅含公版内容）
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../src/data');

const FILES_TO_SWAP = [
  { original: 'bibleVersions.js', intl: 'bibleVersions.intl.js' },
  { original: 'defaultSongs.js', intl: 'defaultSongs.intl.js' },
];

console.log('🌍 切换到国际版数据文件...\n');

for (const { original, intl } of FILES_TO_SWAP) {
  const origPath = path.join(DATA_DIR, original);
  const intlPath = path.join(DATA_DIR, intl);
  const backupPath = path.join(DATA_DIR, original + '.domestic.bak');

  if (!fs.existsSync(intlPath)) {
    console.error(`  ❌ 国际版文件不存在: ${intl}`);
    process.exit(1);
  }

  // 备份国内版
  fs.copyFileSync(origPath, backupPath);
  // 替换为国际版
  fs.copyFileSync(intlPath, origPath);

  console.log(`  ✅ ${original} → ${intl}`);
}

console.log('\n✨ 国际版数据切换完成');
