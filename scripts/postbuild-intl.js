#!/usr/bin/env node
/**
 * 国际版后构建脚本
 * 恢复国内版数据文件
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../src/data');

const FILES_TO_RESTORE = [
  'bibleVersions.js',
  'defaultSongs.js',
];

console.log('🔙 恢复国内版数据文件...\n');

for (const filename of FILES_TO_RESTORE) {
  const origPath = path.join(DATA_DIR, filename);
  const backupPath = path.join(DATA_DIR, filename + '.domestic.bak');

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, origPath);
    fs.unlinkSync(backupPath);
    console.log(`  ✅ 已恢复 ${filename}`);
  } else {
    console.log(`  ⚠️ 备份文件不存在: ${backupPath}`);
  }
}

console.log('\n✨ 国内版数据已恢复');
