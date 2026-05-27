import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import electronAPI from '../utils/electronAPI';
import { defaultSongs } from '../data/defaultSongs';
import { themes } from '../data/themes';
import { defaultBackgrounds } from '../data/backgrounds';
import { fullBibleVerses } from '../data/full_bible';
import PlaylistEditor from './PlaylistEditor';
import PlaylistPlayer from './PlaylistPlayer';
import { defaultPlaylists, PLAYLIST_ITEM_TYPES } from '../data/playlists';
import './MainPage.css';

function NewMainPage() {
  // 导航状态
  const [currentPage, setCurrentPage] = useState('home'); // home | playlists | import | media | settings

  // 状态管理
  const [songs, setSongs] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isProjectionActive, setIsProjectionActive] = useState(false);
  const [displays, setDisplays] = useState([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState(null);
  const [currentThemeId, setCurrentThemeId] = useState('classic-black');
  const [currentBackgroundId, setCurrentBackgroundId] = useState('none');
  const [favorites, setFavorites] = useState([]);
  const [recentSongs, setRecentSongs] = useState([]);
  const [contentTab, setContentTab] = useState('songs'); // songs | bible
  const [availableSources, setAvailableSources] = useState([]);
  const [currentSharingId, setCurrentSharingId] = useState(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [isProjectionLocked, setIsProjectionLocked] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [bibleSearchText, setBibleSearchText] = useState('');
  const [selectedBibleVerse, setSelectedBibleVerse] = useState(null);
  const [quickEditContent, setQuickEditContent] = useState('');
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);

  // 歌单状态
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [playlistEditorOpen, setPlaylistEditorOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [currentPlaylistItemIndex, setCurrentPlaylistItemIndex] = useState(0);
  const [isPlaylistPlaying, setIsPlaylistPlaying] = useState(false);

  const searchInputRef = useRef(null);
  const isInitializedRef = useRef(false);

  // 当前主题
  const currentTheme = useMemo(
    () => themes.find(t => t.id === currentThemeId) || themes[0],
    [currentThemeId]
  );

  // 当前背景
  const allBackgrounds = [...defaultBackgrounds, ...customBackgrounds];
  const currentBackground = useMemo(
    () => allBackgrounds.find(b => b.id === currentBackgroundId) || allBackgrounds[0],
    [currentBackgroundId, allBackgrounds]
  );

  // 初始化模糊搜索
  const fuse = useMemo(
    () => new Fuse(songs, {
      keys: ['title', 'author', 'searchKey'],
      threshold: 0.3,
      includeScore: true
    }),
    [songs]
  );

  // 过滤后的歌曲列表
  const filteredSongs = useMemo(() => {
    if (!searchText.trim()) {
      return songs.slice(0, 100);
    }
    const results = fuse.search(searchText);
    return results.map(r => r.item).slice(0, 100);
  }, [searchText, songs, fuse]);

  // 过滤圣经经文
  const filteredBible = useMemo(() => {
    if (!bibleSearchText.trim()) return fullBibleVerses.slice(0, 20);

    const searchLower = bibleSearchText.toLowerCase().trim();
    const chapterVerseMatch = searchLower.match(/^(.+?)\s*(\d+)\s*[:：]\s*(\d+)$/);
    const chapterMatch = searchLower.match(/^(.+?)\s*(\d+)$/);

    if (chapterVerseMatch) {
      const book = chapterVerseMatch[1].trim();
      const chapter = parseInt(chapterVerseMatch[2]);
      const verse = parseInt(chapterVerseMatch[3]);
      const exactMatch = fullBibleVerses.filter(v =>
        v.book.toLowerCase().includes(book) &&
        v.chapter === chapter &&
        v.verse === verse
      );
      if (exactMatch.length > 0) return exactMatch;
    } else if (chapterMatch) {
      const book = chapterMatch[1].trim();
      const chapter = parseInt(chapterMatch[2]);
      const exactMatch = fullBibleVerses.filter(v =>
        v.book.toLowerCase().includes(book) &&
        v.chapter === chapter
      );
      if (exactMatch.length > 0) return exactMatch;
    }

    return fullBibleVerses.filter(v =>
      v.ref.toLowerCase().includes(searchLower) ||
      v.book.toLowerCase().includes(searchLower) ||
      v.content.toLowerCase().includes(searchLower)
    ).slice(0, 100);
  }, [bibleSearchText]);

  // 更新投影内容
  const updateProjection = () => {
    if (!selectedSong) return;
    electronAPI.updateLyrics({
      song: selectedSong,
      slideIndex: currentSlideIndex,
      theme: currentTheme,
      background: currentBackground
    });
  };

  // 快速编辑保存
  const saveQuickEdit = () => {
    if (!selectedSong) return;
    const newSlides = [...selectedSong.slides];
    newSlides[currentSlideIndex] = quickEditContent;
    const editedSong = { ...selectedSong, slides: newSlides };
    setSelectedSong(editedSong);
    if (isProjectionActive) {
      updateProjection();
    }
  };

  // 监听当前内容变化，更新快速编辑
  useEffect(() => {
    if (selectedSong && selectedSong.slides[currentSlideIndex]) {
      setQuickEditContent(selectedSong.slides[currentSlideIndex]);
    }
  }, [selectedSong, currentSlideIndex]);

  // 选择歌曲
  const handleSelectSong = (song) => {
    setSelectedSong(song);
    setCurrentSlideIndex(0);
    setSelectedBibleVerse(null);
    addToRecent(song.id);
    if (isProjectionActive && !isProjectionLocked) {
      updateProjection();
    }
  };

  // 选择圣经经文
  const selectBibleVerse = (verse) => {
    setSelectedBibleVerse(verse);
    setQuickEditContent(verse.content);
    const lines = verse.content.split(/\n/).filter(l => l.trim());
    const slides = lines.length <= 4 ? [lines.join('\n')] : lines;
    const tempSong = {
      id: `bible_${verse.book}_${verse.chapter}_${verse.verse}`,
      title: `${verse.ref}`,
      author: '',
      searchKey: verse.ref.toLowerCase(),
      slides: slides
    };
    setSelectedSong(tempSong);
    setCurrentSlideIndex(0);
    if (isProjectionActive && !isProjectionLocked) {
      updateProjection();
    }
  };

  // 添加到最近使用
  const addToRecent = (songId) => {
    setRecentSongs(prev => {
      const filtered = prev.filter(id => id !== songId);
      return [songId, ...filtered].slice(0, 20);
    });
  };

  // 开始投影
  const startProjection = () => {
    electronAPI.startProjection(selectedDisplayId);
    setIsProjectionActive(true);
    setTimeout(() => {
      if (currentSharingId) {
        electronAPI.shareSource(currentSharingId);
      } else if (selectedSong) {
        updateProjection();
      }
    }, 500);
  };

  // 停止投影
  const stopProjection = () => {
    electronAPI.stopProjection();
    setIsProjectionActive(false);
    setCurrentSharingId(null);
  };

  // 翻页
  const nextSlide = () => {
    if (!selectedSong || currentSlideIndex >= selectedSong.slides.length - 1) return;
    const newIndex = currentSlideIndex + 1;
    setCurrentSlideIndex(newIndex);
    updateProjection();
  };

  const prevSlide = () => {
    if (currentSlideIndex <= 0) return;
    const newIndex = currentSlideIndex - 1;
    setCurrentSlideIndex(newIndex);
    updateProjection();
  };

  // 切换收藏
  const toggleFavorite = (songId, e) => {
    e?.stopPropagation();
    if (favorites.includes(songId)) {
      setFavorites(favorites.filter(id => id !== songId));
    } else {
      setFavorites([...favorites, songId]);
    }
  };

  const isFavorite = (songId) => favorites.includes(songId);

  // 初始化
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const stored = localStorage.getItem('jianying_songs');
    if (stored) {
      try {
        setSongs(JSON.parse(stored));
      } catch (e) {
        setSongs(defaultSongs);
      }
    } else {
      setSongs(defaultSongs);
    }

    const favStored = localStorage.getItem('jianying_favorites');
    if (favStored) {
      try {
        setFavorites(JSON.parse(favStored));
      } catch (e) {}
    }

    const recentStored = localStorage.getItem('jianying_recent');
    if (recentStored) {
      try {
        setRecentSongs(JSON.parse(recentStored));
      } catch (e) {}
    }

    const bgStored = localStorage.getItem('jianying_custom_backgrounds');
    if (bgStored) {
      try {
        setCustomBackgrounds(JSON.parse(bgStored));
      } catch (e) {}
    }

    const playlistStored = localStorage.getItem('jianying_playlists');
    if (playlistStored) {
      try {
        setPlaylists(JSON.parse(playlistStored));
      } catch (e) {
        setPlaylists(defaultPlaylists);
      }
    } else {
      setPlaylists(defaultPlaylists);
    }

    electronAPI.getDisplays().then(displays => {
      setDisplays(displays);
      const secondary = displays.find(d => !d.isPrimary);
      if (secondary) {
        setSelectedDisplayId(secondary.id);
      } else {
        setSelectedDisplayId(displays[0]?.id);
      }
    });

    electronAPI.isProjectionActive().then(setIsProjectionActive);

    const offClosed = electronAPI.onProjectionClosed(() => {
      setIsProjectionActive(false);
    });

    return () => {
      offClosed();
    };
  }, []);

  // 保存数据
  useEffect(() => {
    localStorage.setItem('jianying_songs', JSON.stringify(songs));
  }, [songs]);

  useEffect(() => {
    localStorage.setItem('jianying_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('jianying_recent', JSON.stringify(recentSongs));
  }, [recentSongs]);

  useEffect(() => {
    localStorage.setItem('jianying_custom_backgrounds', JSON.stringify(customBackgrounds));
  }, [customBackgrounds]);

  useEffect(() => {
    localStorage.setItem('jianying_playlists', JSON.stringify(playlists));
  }, [playlists]);

  // 歌单操作
  const savePlaylist = (playlist) => {
    const existingIndex = playlists.findIndex(p => p.id === playlist.id);
    if (existingIndex >= 0) {
      const newPlaylists = [...playlists];
      newPlaylists[existingIndex] = playlist;
      setPlaylists(newPlaylists);
    } else {
      setPlaylists([...playlists, playlist]);
    }
  };

  const deletePlaylist = (playlistId) => {
    if (!confirm('确定要删除这个歌单吗？')) return;
    setPlaylists(playlists.filter(p => p.id !== playlistId));
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(null);
    }
  };

  // 歌单播放
  const handlePlaylistItemSelect = (index) => {
    setCurrentPlaylistItemIndex(index);
    const item = selectedPlaylist?.items[index];
    if (!item) return;

    if (item.type === PLAYLIST_ITEM_TYPES.SONG) {
      const song = songs.find(s => s.id === item.id);
      if (song) handleSelectSong(song);
    } else if (item.type === PLAYLIST_ITEM_TYPES.BIBLE) {
      const verse = fullBibleVerses.find(v =>
        `${v.book}_${v.chapter}_${v.verse}` === item.id
      );
      if (verse) selectBibleVerse(verse);
    }
  };

  const playlistNext = () => {
    if (!selectedPlaylist || currentPlaylistItemIndex >= selectedPlaylist.items.length - 1) return;
    handlePlaylistItemSelect(currentPlaylistItemIndex + 1);
  };

  const playlistPrev = () => {
    if (currentPlaylistItemIndex <= 0) return;
    handlePlaylistItemSelect(currentPlaylistItemIndex - 1);
  };

  // 渲染不同页面
  const renderHomePage = () => (
    <div className="content">
      {/* 左侧：搜索和内容列表 */}
      <div className="sidebar">
        <div className="search-box">
          <input
            ref={searchInputRef}
            type="text"
            placeholder={contentTab === 'bible' ? '搜索圣经经文...' : '搜索圣诗...'}
            value={contentTab === 'bible' ? bibleSearchText : searchText}
            onChange={(e) => contentTab === 'bible' ? setBibleSearchText(e.target.value) : setSearchText(e.target.value)}
          />
        </div>

        <div className="tabs">
          <button
            className={contentTab === 'songs' ? 'active' : ''}
            onClick={() => setContentTab('songs')}
          >
            🎵 诗歌
          </button>
          <button
            className={contentTab === 'bible' ? 'active' : ''}
            onClick={() => setContentTab('bible')}
          >
            📖 圣经
          </button>
        </div>

        <div className="song-list">
          {contentTab === 'songs' ? (
            filteredSongs.length === 0 ? (
              <div className="empty">未找到诗歌</div>
            ) : (
              filteredSongs.map(song => (
                <div
                  key={song.id}
                  className={`song-item ${selectedSong?.id === song.id ? 'selected' : ''}`}
                  onClick={() => handleSelectSong(song)}
                >
                  <span className="song-title">{song.title}</span>
                  <button
                    className={`favorite-btn ${isFavorite(song.id) ? 'active' : ''}`}
                    onClick={(e) => toggleFavorite(song.id, e)}
                  >
                    {isFavorite(song.id) ? '★' : '☆'}
                  </button>
                </div>
              ))
            )
          ) : (
            filteredBible.length === 0 ? (
              <div className="empty">未找到经文</div>
            ) : (
              filteredBible.map(verse => (
                <div
                  key={verse.ref}
                  className={`song-item ${selectedBibleVerse?.ref === verse.ref ? 'selected' : ''}`}
                  onClick={() => selectBibleVerse(verse)}
                >
                  <span className="song-title">{verse.ref}</span>
                  <span className="verse-preview">{verse.content.slice(0, 30)}...</span>
                </div>
              ))
            )
          )}
        </div>
      </div>

      {/* 中间：快速编辑和控制 */}
      <div className="main-area">
        <div className="settings-section">
          <div className="setting-group">
            <label>选择投影屏幕：</label>
            <select
              value={selectedDisplayId || ''}
              onChange={(e) => setSelectedDisplayId(Number(e.target.value))}
            >
              {displays.map(display => (
                <option key={display.id} value={display.id}>
                  {display.label} {display.isPrimary ? '(主屏)' : '(投影)'} {display.width}×{display.height}
                </option>
              ))}
            </select>
          </div>

          <div className="setting-group">
            <label>快速编辑当前内容：</label>
            <textarea
              className="quick-edit-area"
              value={quickEditContent}
              onChange={(e) => setQuickEditContent(e.target.value)}
              placeholder="选择内容后可在这里快速编辑..."
            />
            <button className="btn small primary" onClick={saveQuickEdit}>
              ✓ 应用到投影
            </button>
          </div>

          <div className="setting-group">
            <label>选择主题样式：</label>
            <div className="theme-grid">
              {themes.map(theme => (
                <div
                  key={theme.id}
                  className={`theme-card ${currentThemeId === theme.id ? 'selected' : ''}`}
                  onClick={() => {
                    setCurrentThemeId(theme.id);
                    if (isProjectionActive) updateProjection();
                  }}
                  style={{
                    background: theme.backgroundColor.startsWith('linear-gradient')
                      ? theme.backgroundColor
                      : theme.backgroundColor
                  }}
                >
                  <span style={{ color: theme.textColor }}>{theme.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {selectedSong && (
          <div className="current-song">
            <div className="current-song-header">
              <h2>{selectedSong.title}</h2>
              <div className="slide-info">
                第 {currentSlideIndex + 1} / {selectedSong.slides.length} 页
              </div>
            </div>

            <div className="small-preview" style={{
              background: currentTheme.backgroundColor.startsWith('linear-gradient')
                ? currentTheme.backgroundColor
                : currentTheme.backgroundColor,
              color: currentTheme.textColor,
            }}>
              {currentBackground && currentBackground.type === 'image' && currentBackground.url ? (
                <div className="preview-bg" style={{
                  backgroundImage: `url(${currentBackground.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  opacity: 0.5
                }} />
              ) : null}
              <div style={{
                fontFamily: currentTheme.fontFamily,
                fontSize: '20px',
                lineHeight: currentTheme.lineHeight,
                textAlign: currentTheme.textAlign,
                whiteSpace: 'pre-wrap',
                position: 'relative',
                zIndex: 10,
                padding: '10px'
              }}>
                {selectedSong.slides[currentSlideIndex]}
              </div>
            </div>

            <div className="controls">
              {!isProjectionActive ? (
                <button className="btn primary" onClick={startProjection}>
                  ▶ 开始投影
                </button>
              ) : (
                <button className="btn danger" onClick={stopProjection}>
                  ■ 停止投影
                </button>
              )}
              <button
                className="btn secondary"
                onClick={prevSlide}
                disabled={!selectedSong || currentSlideIndex <= 0 || !isProjectionActive}
              >
                ← 上一页
              </button>
              <button
                className="btn secondary"
                onClick={nextSlide}
                disabled={!selectedSong || currentSlideIndex >= selectedSong.slides.length - 1 || !isProjectionActive}
              >
                下一页 →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 右侧：投影预览 */}
      <div className="projection-preview">
        {selectedSong ? (
          <div className="projection-preview-inner">
            <div className="projection-content" style={
              currentBackground && currentBackground.type === 'image' && currentBackground.url
                ? {
                  width: '100%',
                  height: '100%',
                  color: currentTheme.textColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  position: 'relative',
                  backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${currentBackground.url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }
                : {
                  width: '100%',
                  height: '100%',
                  color: currentTheme.textColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  position: 'relative',
                  background: currentTheme.backgroundColor.startsWith('linear-gradient')
                    ? currentTheme.backgroundColor
                    : currentTheme.backgroundColor
                }
            }>
              <div style={{
                fontFamily: currentTheme.fontFamily,
                fontSize: '60px',
                lineHeight: currentTheme.lineHeight,
                textAlign: currentTheme.textAlign,
                whiteSpace: 'pre-wrap',
                maxWidth: '90%',
                position: 'relative',
                zIndex: 10
              }}>
                {selectedSong.slides[currentSlideIndex]}
              </div>
              <div style={{
                position: 'absolute',
                bottom: '20px',
                right: '30px',
                fontSize: '24px',
                opacity: 0.5,
                color: currentTheme.textColor,
                zIndex: 10
              }}>
                {currentSlideIndex + 1} / {selectedSong.slides.length}
              </div>
            </div>
            <div className="projection-preview-label">实时投影预览</div>
          </div>
        ) : (
          <div className="projection-preview-inner">
            <div className="empty-state-dark">
              📺<br />
              选择内容后开始投影
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPlaylistsPage = () => (
    <div className="playlists-page">
      <div className="playlists-sidebar">
        <div className="playlists-header">
          <h2>📋 歌单管理</h2>
          <button
            className="btn primary"
            onClick={() => {
              setEditingPlaylist(null);
              setPlaylistEditorOpen(true);
            }}
          >
            + 新建歌单
          </button>
        </div>
        <div className="playlists-list">
          {playlists.length === 0 ? (
            <div className="empty">还没有歌单</div>
          ) : (
            playlists.map(pl => (
              <div
                key={pl.id}
                className={`playlist-item ${selectedPlaylist?.id === pl.id ? 'selected' : ''}`}
                onClick={() => setSelectedPlaylist(pl)}
              >
                <div className="playlist-info">
                  <div className="playlist-name">{pl.name}</div>
                  <div className="playlist-count">{pl.items?.length || 0} 项</div>
                </div>
                <button
                  className="btn small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPlaylist(pl);
                    setPlaylistEditorOpen(true);
                  }}
                >
                  编辑
                </button>
                <button
                  className="btn small danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    deletePlaylist(pl.id);
                  }}
                >
                  删除
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="playlist-detail">
        {selectedPlaylist ? (
          <PlaylistPlayer
            playlist={selectedPlaylist}
            songs={songs}
            onSelectItem={handlePlaylistItemSelect}
            currentItemIndex={currentPlaylistItemIndex}
            isPlaying={isPlaylistPlaying}
            onPlayPause={() => setIsPlaylistPlaying(!isPlaylistPlaying)}
            onNext={playlistNext}
            onPrev={playlistPrev}
          />
        ) : (
          <div className="empty-state">
            👈 请从左侧选择一个歌单
          </div>
        )}
      </div>

      <style>{`
        .playlists-page {
          display: flex;
          height: calc(100vh - 60px);
        }
        .playlists-sidebar {
          width: 300px;
          border-right: 1px solid #eee;
          padding: 20px;
          overflow-y: auto;
        }
        .playlists-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .playlists-header h2 {
          margin: 0;
          font-size: 18px;
        }
        .playlists-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .playlist-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 8px;
          cursor: pointer;
        }
        .playlist-item:hover {
          background: #e9ecef;
        }
        .playlist-item.selected {
          background: #667eea;
          color: white;
        }
        .playlist-info {
          flex: 1;
        }
        .playlist-name {
          font-weight: bold;
        }
        .playlist-count {
          font-size: 12px;
          opacity: 0.7;
        }
        .playlist-detail {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
        }
        .quick-edit-area {
          width: 100%;
          min-height: 120px;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          resize: vertical;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  );

  const renderImportPage = () => (
    <div className="import-page">
      <div className="import-content">
        <h2>📁 批量导入</h2>
        <p className="import-hint">
          粘贴纯文本，格式如下：<br />
          第一行为诗歌标题，然后每行一句歌词，空行分隔下一首诗歌
        </p>
        <textarea
          className="import-textarea-large"
          placeholder="请在这里粘贴要导入的歌词..."
        />
        <div className="import-actions">
          <button className="btn secondary">取消</button>
          <button className="btn primary">✓ 确认导入</button>
        </div>
      </div>
      <style>{`
        .import-page {
          padding: 40px;
          height: calc(100vh - 60px);
          overflow-y: auto;
        }
        .import-content {
          max-width: 800px;
          margin: 0 auto;
        }
        .import-hint {
          background: #f8f9fa;
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .import-textarea-large {
          width: 100%;
          min-height: 400px;
          padding: 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .import-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );

  const renderMediaPage = () => (
    <div className="media-page">
      <div className="media-content">
        <h2>🎬 媒体库</h2>
        <div className="empty-state">
          媒体库功能开发中...
        </div>
      </div>
    </div>
  );

  const renderSettingsPage = () => (
    <div className="settings-page">
      <div className="settings-content">
        <h2>⚙️ 设置</h2>
        <div className="empty-state">
          设置功能开发中...
        </div>
      </div>
    </div>
  );

  return (
    <div className="main-page">
      {/* 顶部导航栏 */}
      <nav className="top-nav">
        <div className="nav-brand">
          <h1>简影投屏</h1>
        </div>
        <div className="nav-items">
          <button
            className={currentPage === 'home' ? 'active' : ''}
            onClick={() => setCurrentPage('home')}
          >
            🏠 首页
          </button>
          <button
            className={currentPage === 'playlists' ? 'active' : ''}
            onClick={() => setCurrentPage('playlists')}
          >
            📋 歌单
          </button>
          <button
            className={currentPage === 'import' ? 'active' : ''}
            onClick={() => setCurrentPage('import')}
          >
            📁 导入
          </button>
          <button
            className={currentPage === 'media' ? 'active' : ''}
            onClick={() => setCurrentPage('media')}
          >
            🎬 媒体
          </button>
          <button
            className={currentPage === 'settings' ? 'active' : ''}
            onClick={() => setCurrentPage('settings')}
          >
            ⚙️ 设置
          </button>
        </div>
        <div className="nav-status">
          {isProjectionActive ? (
            <span className="status active">投影中</span>
          ) : (
            <span className="status inactive">未投影</span>
          )}
        </div>
      </nav>

      {/* 页面内容 */}
      {currentPage === 'home' && renderHomePage()}
      {currentPage === 'playlists' && renderPlaylistsPage()}
      {currentPage === 'import' && renderImportPage()}
      {currentPage === 'media' && renderMediaPage()}
      {currentPage === 'settings' && renderSettingsPage()}

      {/* 歌单编辑模态框 */}
      {playlistEditorOpen && (
        <PlaylistEditor
          isOpen={playlistEditorOpen}
          onClose={() => setPlaylistEditorOpen(false)}
          playlist={editingPlaylist}
          onSave={savePlaylist}
          songs={songs}
          fullBibleVerses={fullBibleVerses}
        />
      )}

      <style>{`
        .top-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 60px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 0 24px;
          color: white;
        }
        .nav-brand h1 {
          margin: 0;
          font-size: 20px;
        }
        .nav-items {
          display: flex;
          gap: 4px;
        }
        .nav-items button {
          padding: 10px 16px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .nav-items button:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .nav-items button.active {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          font-weight: bold;
        }
        .nav-status .status {
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 14px;
        }
        .nav-status .status.active {
          background: #28a745;
        }
        .nav-status .status.inactive {
          background: rgba(255, 255, 255, 0.2);
        }
        .media-page, .settings-page {
          padding: 40px;
          height: calc(100vh - 60px);
        }
        .empty-state {
          text-align: center;
          padding: 60px;
          color: #666;
        }
      `}</style>
    </div>
  );
}

export default NewMainPage;
