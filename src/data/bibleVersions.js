/**
 * 简影投屏 国际版 - 圣经版本配置
 * 仅内置 KJV（公版），其他版本通过 .jydata 数据包导入
 */
import { kjv } from './full_bible_kjv';
import { bibleBooks } from './bibleBooks';
import { getImportedBibleVersions } from './loader';

const bookIdByName = {};
for (const book of bibleBooks) {
  for (const name of Object.values(book.names)) {
    bookIdByName[name] = book.id;
  }
}

function normalizeVerses(verses) {
  if (!verses || !Array.isArray(verses)) return [];
  return verses.map((verse) => ({
    ...verse,
    bookId: bookIdByName[verse.book],
  }));
}

// 内置版本定义
const BUILTIN_VERSIONS = [
  { id: 'kjv', label: { 'zh-Hans': 'KJV', en: 'KJV', 'zh-Hant': 'KJV' } },
];

// 构建完整版本映射
function buildVersionMap() {
  const map = { kjv: normalizeVerses(kjv) };
  const imported = getImportedBibleVersions();
  for (const v of imported) {
    if (!map[v.id]) {
      map[v.id] = normalizeVerses(v.data);
    }
  }
  return map;
}

// 构建完整版本列表
function buildVersionList() {
  const list = [...BUILTIN_VERSIONS];
  const imported = getImportedBibleVersions();
  for (const v of imported) {
    if (!list.find((x) => x.id === v.id)) {
      list.push({
        id: v.id,
        label: { 'zh-Hans': v.name, en: v.name, 'zh-Hant': v.name },
        imported: true,
      });
    }
  }
  return list;
}

// ===== 对外接口（与 domestic 版本完全一致） =====

// 版本列表（每次 import 时重新计算）
export const bibleVersions = buildVersionList();

// 版本数据映射（每次 import 时重新计算）
export const bibleVersionMap = buildVersionMap();

/**
 * 刷新数据（导入数据包后调用，返回新的 { bibleVersions, bibleVersionMap }）
 * 注意：由于 ES module 的 export 是 live binding，直接重新赋值无法生效。
 * 推荐在 React 组件中调用 getImportedBibleVersions() 自己处理状态更新。
 */
export function refreshBibleData() {
  return {
    bibleVersions: buildVersionList(),
    bibleVersionMap: buildVersionMap(),
  };
}
