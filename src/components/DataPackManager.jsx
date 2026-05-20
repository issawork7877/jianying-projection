import React, { useState, useEffect } from 'react';
import {
  importDataPack,
  getImportedPacks,
  removeImportedPack,
  clearAllImported,
  getImportedSongs,
  readFileAsText,
} from '../data/loader';

function DataPackManager({ isOpen, onClose, onSongsImported }) {
  const [importedPacks, setImportedPacks] = useState([]);
  const [importStatus, setImportStatus] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setImportedPacks(getImportedPacks());
      setImportStatus(null);
    }
  }, [isOpen]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.jydata')) {
      setImportStatus({ type: 'error', message: '请选择 .jydata 格式的数据包文件' });
      return;
    }

    setImporting(true);
    setImportStatus(null);

    try {
      const text = await readFileAsText(file);
      const result = importDataPack(text);

      if (result.success) {
        setImportStatus({
          type: 'success',
          message: `导入成功！${result.name} - 共 ${result.count} 条数据`,
        });
        setImportedPacks(getImportedPacks());

        // 如果是诗歌数据包，通知父组件更新
        if (result.type === 'songs' && onSongsImported) {
          const newSongs = getImportedSongs();
          onSongsImported(newSongs);
        }
      } else {
        setImportStatus({ type: 'error', message: result.error });
      }
    } catch (err) {
      setImportStatus({ type: 'error', message: `文件读取失败: ${err.message}` });
    } finally {
      setImporting(false);
      // 重置文件输入
      e.target.value = '';
    }
  };

  const handleRemove = (packKey) => {
    removeImportedPack(packKey);
    setImportedPacks(getImportedPacks());
    setImportStatus({ type: 'info', message: '数据包已移除，可能需要重启应用以完全生效' });
  };

  const handleClearAll = () => {
    if (!confirm('确定要移除所有已导入的数据包吗？此操作不可撤销。')) return;
    const count = clearAllImported();
    setImportedPacks([]);
    setImportStatus({ type: 'info', message: `已移除 ${count} 个数据包` });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📦 数据包管理</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="datapack-import-section">
            <h3>导入数据包</h3>
            <p className="datapack-hint">
              选择 .jydata 格式的数据包文件进行导入。支持圣经版本和诗歌数据库。
            </p>
            <label className="datapack-upload-btn">
              {importing ? '⏳ 导入中...' : '📁 选择数据包文件'}
              <input
                type="file"
                accept=".jydata"
                onChange={handleFileSelect}
                disabled={importing}
                style={{ display: 'none' }}
              />
            </label>

            {importStatus && (
              <div className={`datapack-status datapack-status-${importStatus.type}`}>
                {importStatus.type === 'success' && '✅ '}
                {importStatus.type === 'error' && '❌ '}
                {importStatus.type === 'info' && 'ℹ️ '}
                {importStatus.message}
              </div>
            )}
          </div>

          <div className="datapack-list-section">
            <h3>
              已导入的数据包
              {importedPacks.length > 0 && (
                <button className="btn danger small" onClick={handleClearAll} style={{ marginLeft: 12 }}>
                  清空全部
                </button>
              )}
            </h3>

            {importedPacks.length === 0 ? (
              <div className="empty">暂无已导入的数据包</div>
            ) : (
              <div className="datapack-list">
                {importedPacks.map((pack) => (
                  <div key={pack.key} className="datapack-item">
                    <div className="datapack-item-info">
                      <span className="datapack-item-type">
                        {pack.type === 'bible' ? '📖 圣经' : '🎵 诗歌'}
                      </span>
                      <span className="datapack-item-name">{pack.name}</span>
                      <span className="datapack-item-count">{pack.count} 条</span>
                      <span className="datapack-item-date">
                        {new Date(pack.importedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      className="btn danger small"
                      onClick={() => handleRemove(pack.key)}
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn secondary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

export default DataPackManager;
