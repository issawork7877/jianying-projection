#!/usr/bin/env node
/**
 * 简影投屏 - 数据包构建脚本
 * 将圣经/诗歌数据库导出为 .jydata 格式，供用户一键导入
 *
 * 用法:
 *   node scripts/build-data-pack.js bible kjv       # 导出 KJV 圣经
 *   node scripts/build-data-pack.js bible cuv       # 导出和合本圣经
 *   node scripts/build-data-pack.js songs full      # 导出完整诗歌库
 *   node scripts/build-data-pack.js all             # 导出全部数据包
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(__dirname, '../datapacks');
const DATA_PACK_VERSION = 1;

/**
 * 从 ES module 文件中提取导出的数据
 * 通过读取原始 JS 文本并执行来避免 ESM/CJS 兼容问题
 */
function loadESModule(filePath) {
  const absPath = path.resolve(__dirname, filePath);
  const source = fs.readFileSync(absPath, 'utf-8');

  // 创建一个模块作用域来执行代码
  const module = { exports: {} };
  const exports = module.exports;

  // 将 "export const name = ..." 和 "export function name" 转换为赋值
  let transformed = source
    .replace(/export\s+const\s+(\w+)\s*=\s*/g, 'exports.$1 = ')
    .replace(/export\s+function\s+(\w+)/g, 'exports.$1 = function')
    .replace(/export\s+{([^}]+)}/g, '// re-export: $1')
    .replace(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"];?/g, '// import removed')
    .replace(/import\s+\w+\s+from\s+['"][^'"]+['"];?/g, '// import removed');

  // 对函数导出做特殊处理（去掉 function 关键字前的赋值）
  transformed = transformed.replace(/exports\.(\w+)\s*=\s*function\s+(\w+)/g, 'exports.$1 = function');

  try {
    new Function('exports', transformed)(exports);
  } catch (e) {
    console.error(`  解析文件失败: ${absPath}`);
    console.error(`  错误: ${e.message}`);
    throw e;
  }

  return exports;
}

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
}

function writePack(filename, pack) {
  ensureOutDir();
  const filePath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(pack, null, 2), 'utf-8');
  const stats = fs.statSync(filePath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`  ✅ ${filename} (${sizeMB} MB)`);
}

async function buildBiblePack(versionId, name, description, modulePath, exportName) {
  console.log(`\n📖 Building Bible pack: ${name}`);
  const data = loadESModule(modulePath);
  const verses = data[exportName];

  const pack = {
    format: 'jydata',
    version: DATA_PACK_VERSION,
    type: 'bible',
    id: `bible-${versionId}`,
    name,
    description,
    generatedAt: new Date().toISOString(),
    dataType: 'verses',
    data: verses,
  };

  writePack(`jianying-bible-${versionId}.jydata`, pack);
}

async function buildSongsPack(id, name, description, modulePath) {
  console.log(`\n🎵 Building Songs pack: ${name}`);
  const data = loadESModule(modulePath);
  let songs = data.allSongs || data.defaultSongs || [];

  const pack = {
    format: 'jydata',
    version: DATA_PACK_VERSION,
    type: 'songs',
    id: `songs-${id}`,
    name,
    description,
    generatedAt: new Date().toISOString(),
    dataType: 'songs',
    data: songs,
  };

  writePack(`jianying-songs-${id}.jydata`, pack);
}

// ─── Main ────────────────────────────────────────────────

async function main() {
  const [,, category, target] = process.argv;

  if (!category || category === 'help') {
    console.log('🔨 简影投屏 数据包构建工具\n');
    console.log('用法: node scripts/build-data-pack.js <category> <target>\n');
    console.log('类别:');
    console.log('  bible <version>  - 导出圣经数据包 (kjv, cuv, niv, cuv-t)');
    console.log('  songs <type>     - 导出诗歌数据包 (full, public)');
    console.log('  all              - 导出全部数据包\n');
    process.exit(0);
  }

  if (category === 'all') {
    console.log('🔨 构建全部数据包...\n');
    await buildBiblePack('kjv', 'King James Version',
      'Public domain English Bible (KJV) - 31,102 verses',
      '../src/data/full_bible_kjv.js', 'kjv');
    await buildBiblePack('cuv-s', '和合本 (简体)',
      'Chinese Union Version (Simplified) - 31,033 verses',
      '../src/data/full_bible.js', 'fullBibleVerses');
    await buildBiblePack('niv', 'New International Version',
      'NIV Bible - 31,102 verses',
      '../src/data/full_bible_niv.js', 'niv');
    await buildBiblePack('cuv-t', '和合本 (繁体)',
      'Chinese Union Version (Traditional) - 31,033 verses',
      '../src/data/full_bible_cuv_traditional.js', 'cuvTraditional');
    await buildSongsPack('full', '完整诗歌库',
      '包含 61,344 首赞美诗',
      '../src/data/all_songs.js');
    console.log('\n✨ 全部数据包构建完成！');
    console.log(`   输出目录: ${OUT_DIR}`);
    return;
  }

  if (category === 'bible') {
    if (!target || target === 'kjv' || target === 'all-bible') {
      await buildBiblePack('kjv', 'King James Version',
        'Public domain English Bible (KJV) - 31,102 verses',
        '../src/data/full_bible_kjv.js', 'kjv');
    }
    if (!target || target === 'cuv' || target === 'all-bible') {
      await buildBiblePack('cuv-s', '和合本 (简体)',
        'Chinese Union Version (Simplified) - 31,033 verses',
        '../src/data/full_bible.js', 'fullBibleVerses');
    }
    if (!target || target === 'niv' || target === 'all-bible') {
      await buildBiblePack('niv', 'New International Version',
        'NIV Bible - 31,102 verses',
        '../src/data/full_bible_niv.js', 'niv');
    }
    if (!target || target === 'cuv-t' || target === 'all-bible') {
      await buildBiblePack('cuv-t', '和合本 (繁体)',
        'Chinese Union Version (Traditional) - 31,033 verses',
        '../src/data/full_bible_cuv_traditional.js', 'cuvTraditional');
    }
  }

  if (category === 'songs') {
    if (!target || target === 'full' || target === 'all-songs') {
      await buildSongsPack('full', '完整诗歌库',
        '包含 61,344 首赞美诗',
        '../src/data/all_songs.js');
    }
    if (!target || target === 'public' || target === 'all-songs') {
      await buildSongsPack('public', '公版诗歌精选',
        '精选公版赞美诗（无版权限制）',
        '../src/data/songs.js');
    }
  }

  console.log('\n✨ 数据包构建完成！');
  console.log(`   输出目录: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('构建失败:', err);
  process.exit(1);
});
