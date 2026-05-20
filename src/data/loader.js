/**
 * 简影投屏 - 数据加载器
 * 支持运行时导入 .jydata 数据包，管理 localStorage 中的数据
 */

const STORAGE_KEY_PREFIX = 'jiayan_imported_';

/**
 * 导入数据包（从 JSON 字符串或已解析的对象）
 * @param {Object|string} pack - 数据包内容
 * @returns {{ success: boolean, type: string, count: number, error?: string }}
 */
export function importDataPack(pack) {
  if (typeof pack === 'string') {
    try {
      pack = JSON.parse(pack);
    } catch (e) {
      return { success: false, error: '数据格式无效，无法解析 JSON' };
    }
  }

  if (pack.format !== 'jydata') {
    return { success: false, error: '不是有效的 .jydata 数据包文件' };
  }

  if (!pack.type || !pack.data || !Array.isArray(pack.data)) {
    return { success: false, error: '数据包结构不完整' };
  }

  const key = STORAGE_KEY_PREFIX + pack.type + '_' + (pack.id || 'unknown');
  const storeData = {
    importedAt: new Date().toISOString(),
    packId: pack.id,
    packName: pack.name,
    packVersion: pack.version,
    dataType: pack.dataType || pack.type,
    data: pack.data,
  };

  try {
    localStorage.setItem(key, JSON.stringify(storeData));
    return {
      success: true,
      type: pack.type,
      count: pack.data.length,
      name: pack.name,
    };
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      return { success: false, error: '存储空间不足。请清理浏览器数据后重试。' };
    }
    return { success: false, error: `存储失败: ${e.message}` };
  }
}

/**
 * 获取已导入的数据包列表
 * @returns {Array<{key: string, type: string, id: string, name: string, count: number, importedAt: string}>}
 */
export function getImportedPacks() {
  const packs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      try {
        const stored = JSON.parse(localStorage.getItem(key));
        packs.push({
          key,
          type: stored.dataType === 'verses' ? 'bible' : 'songs',
          id: stored.packId,
          name: stored.packName,
          count: stored.data?.length || 0,
          importedAt: stored.importedAt,
        });
      } catch (e) {
        // skip corrupted entries
      }
    }
  }
  return packs;
}

/**
 * 获取已导入的圣经数据
 * @param {string} packId - 数据包 ID
 * @returns {Array|null}
 */
export function getImportedBibleData(packId) {
  // 遍历所有 storage key 找到匹配的
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX + 'bible_')) {
      try {
        const stored = JSON.parse(localStorage.getItem(key));
        if (stored.packId === packId && stored.dataType === 'verses') {
          return stored.data;
        }
      } catch (e) {
        // skip
      }
    }
  }
  return null;
}

/**
 * 获取已导入的诗歌数据
 * @returns {Array}
 */
export function getImportedSongs() {
  const allSongs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX + 'songs_')) {
      try {
        const stored = JSON.parse(localStorage.getItem(key));
        if (stored.dataType === 'songs' && Array.isArray(stored.data)) {
          allSongs.push(...stored.data);
        }
      } catch (e) {
        // skip
      }
    }
  }
  return allSongs;
}

/**
 * 获取所有已导入的圣经版本
 * @returns {Array<{id: string, name: string, data: Array}>}
 */
export function getImportedBibleVersions() {
  const versions = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX + 'bible_')) {
      try {
        const stored = JSON.parse(localStorage.getItem(key));
        if (stored.dataType === 'verses' && Array.isArray(stored.data)) {
          versions.push({
            id: stored.packId,
            name: stored.packName,
            data: stored.data,
          });
        }
      } catch (e) {
        // skip
      }
    }
  }
  return versions;
}

/**
 * 删除已导入的数据包
 * @param {string} key - localStorage key
 */
export function removeImportedPack(key) {
  localStorage.removeItem(key);
}

/**
 * 清空所有已导入的数据
 */
export function clearAllImported() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  return keysToRemove.length;
}

/**
 * 读取文件内容
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}
