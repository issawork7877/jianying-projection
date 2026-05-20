import React, { useState, useEffect } from 'react';
import { PLAYLIST_ITEM_TYPES } from '../data/playlists';

function PlaylistEditor({
  isOpen,
  onClose,
  playlist,
  onSave,
  songs,
  fullBibleVerses,
}) {
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDescription, setPlaylistDescription] = useState('');
  const [items, setItems] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [songSearchText, setSongSearchText] = useState('');
  const [bibleSearchText, setBibleSearchText] = useState('');

  useEffect(() => {
    if (playlist) {
      setPlaylistName(playlist.name || '');
      setPlaylistDescription(playlist.description || '');
      setItems(playlist.items ? [...playlist.items] : []);
    } else {
      setPlaylistName('');
      setPlaylistDescription('');
      setItems([]);
    }
  }, [playlist, isOpen]);

  useEffect(() => {
    if (songSearchText.trim()) {
      const filtered = songs.filter(s =>
        s.title.toLowerCase().includes(songSearchText.toLowerCase())
      );
      setAvailableSongs(filtered.slice(0, 50));
    } else {
      setAvailableSongs(songs.slice(0, 50));
    }
  }, [songSearchText, songs]);

  const filteredBible = fullBibleVerses.filter(v =>
    v.ref.toLowerCase().includes(bibleSearchText.toLowerCase()) ||
    v.content.toLowerCase().includes(bibleSearchText.toLowerCase())
  ).slice(0, 50);

  const handleSave = () => {
    if (!playlistName.trim()) {
      alert('请输入歌单名称');
      return;
    }
    onSave({
      id: playlist?.id || `playlist_${Date.now()}`,
      name: playlistName,
      description: playlistDescription,
      items: items,
      createdAt: playlist?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
    onClose();
  };

  const addSong = (song) => {
    setItems([...items, {
      type: PLAYLIST_ITEM_TYPES.SONG,
      id: song.id,
      title: song.title,
      note: '',
    }]);
  };

  const addBible = (verse) => {
    setItems([...items, {
      type: PLAYLIST_ITEM_TYPES.BIBLE,
      id: `${verse.book}_${verse.chapter}_${verse.verse}`,
      ref: verse.ref,
      content: verse.content,
      note: '',
    }]);
  };

  const addNote = () => {
    setItems([...items, {
      type: PLAYLIST_ITEM_TYPES.NOTE,
      id: `note_${Date.now()}`,
      content: '',
      note: '',
    }]);
  };

  const removeItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const moveItemUp = (index) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
    setItems(newItems);
  };

  const moveItemDown = (index) => {
    if (index >= items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setItems(newItems);
  };

  const updateItemNote = (index, note) => {
    const newItems = [...items];
    newItems[index].note = note;
    setItems(newItems);
  };

  const updateNoteContent = (index, content) => {
    const newItems = [...items];
    newItems[index].content = content;
    setItems(newItems);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{playlist ? '编辑歌单' : '创建新歌单'}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="playlist-editor-layout">
            {/* 左侧：添加项目 */}
            <div className="add-items-panel">
              <h3>添加项目</h3>

              <div className="add-section">
                <h4>诗歌</h4>
                <input
                  type="text"
                  placeholder="搜索诗歌..."
                  value={songSearchText}
                  onChange={(e) => setSongSearchText(e.target.value)}
                />
                <div className="item-list-small">
                  {availableSongs.map(song => (
                    <div
                      key={song.id}
                      className="small-item"
                      onClick={() => addSong(song)}
                    >
                      {song.title}
                    </div>
                  ))}
                </div>
              </div>

              <div className="add-section">
                <h4>圣经经文</h4>
                <input
                  type="text"
                  placeholder="搜索经文..."
                  value={bibleSearchText}
                  onChange={(e) => setBibleSearchText(e.target.value)}
                />
                <div className="item-list-small">
                  {filteredBible.map((verse, i) => (
                    <div
                      key={i}
                      className="small-item"
                      onClick={() => addBible(verse)}
                    >
                      {verse.ref}
                    </div>
                  ))}
                </div>
              </div>

              <div className="add-section">
                <h4>备注</h4>
                <button className="btn secondary" onClick={addNote}>
                  + 添加备注
                </button>
              </div>
            </div>

            {/* 右侧：歌单内容 */}
            <div className="playlist-content-panel">
              <div className="playlist-info">
                <input
                  type="text"
                  placeholder="歌单名称"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="playlist-name-input"
                />
                <textarea
                  placeholder="歌单描述（可选）"
                  value={playlistDescription}
                  onChange={(e) => setPlaylistDescription(e.target.value)}
                  className="playlist-desc-input"
                />
              </div>

              <h3>歌单项目 ({items.length})</h3>
              <div className="playlist-items">
                {items.length === 0 ? (
                  <div className="empty">从左侧添加项目到歌单</div>
                ) : (
                  items.map((item, index) => (
                    <div key={index} className="playlist-item">
                      <div className="item-order">{index + 1}</div>
                      <div className="item-content">
                        <div className="item-title">
                          {item.type === PLAYLIST_ITEM_TYPES.SONG && `🎵 ${item.title}`}
                          {item.type === PLAYLIST_ITEM_TYPES.BIBLE && `📖 ${item.ref}`}
                          {item.type === PLAYLIST_ITEM_TYPES.NOTE && '📝 备注'}
                        </div>
                        {item.type === PLAYLIST_ITEM_TYPES.NOTE && (
                          <textarea
                            placeholder="输入备注内容..."
                            value={item.content || ''}
                            onChange={(e) => updateNoteContent(index, e.target.value)}
                            className="note-textarea"
                          />
                        )}
                        <input
                          type="text"
                          placeholder="添加备注..."
                          value={item.note || ''}
                          onChange={(e) => updateItemNote(index, e.target.value)}
                          className="item-note-input"
                        />
                      </div>
                      <div className="item-actions">
                        <button
                          className="btn small"
                          onClick={() => moveItemUp(index)}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          className="btn small"
                          onClick={() => moveItemDown(index)}
                          disabled={index >= items.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          className="btn small danger"
                          onClick={() => removeItem(index)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn primary" onClick={handleSave}>
            ✓ 保存歌单
          </button>
        </div>

        <style jsx>{`
          .playlist-editor-layout {
            display: flex;
            gap: 20px;
            height: 600px;
          }
          .add-items-panel {
            flex: 1;
            overflow-y: auto;
            border-right: 1px solid #eee;
            padding-right: 20px;
          }
          .playlist-content-panel {
            flex: 2;
            overflow-y: auto;
          }
          .add-section {
            margin-bottom: 20px;
          }
          .add-section h4 {
            margin-bottom: 8px;
            font-size: 14px;
            color: #666;
          }
          .add-section input {
            width: 100%;
            padding: 8px;
            margin-bottom: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .item-list-small {
            max-height: 150px;
            overflow-y: auto;
            border: 1px solid #eee;
            border-radius: 4px;
          }
          .small-item {
            padding: 8px 12px;
            cursor: pointer;
            border-bottom: 1px solid #f0f0f0;
          }
          .small-item:hover {
            background: #f5f5f5;
          }
          .playlist-info {
            margin-bottom: 20px;
          }
          .playlist-name-input {
            width: 100%;
            padding: 10px;
            font-size: 18px;
            font-weight: bold;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 8px;
          }
          .playlist-desc-input {
            width: 100%;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 4px;
            min-height: 60px;
            resize: vertical;
          }
          .playlist-items {
            border: 1px solid #eee;
            border-radius: 4px;
            min-height: 300px;
          }
          .playlist-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 12px;
            border-bottom: 1px solid #f0f0f0;
          }
          .item-order {
            width: 30px;
            height: 30px;
            background: #667eea;
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            flex-shrink: 0;
          }
          .item-content {
            flex: 1;
          }
          .item-title {
            font-weight: bold;
            margin-bottom: 4px;
          }
          .item-note-input {
            width: 100%;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            margin-top: 4px;
          }
          .note-textarea {
            width: 100%;
            padding: 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            min-height: 60px;
            margin: 4px 0;
          }
          .item-actions {
            display: flex;
            gap: 4px;
          }
          .item-actions .btn {
            padding: 4px 8px;
            font-size: 12px;
          }
        `}</style>
      </div>
    </div>
  );
}

export default PlaylistEditor;
