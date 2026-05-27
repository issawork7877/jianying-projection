import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import electronAPI from '../utils/electronAPI';
import { defaultSongs } from '../data/defaultSongs';
import { themes } from '../data/themes';
import { defaultBackgrounds } from '../data/backgrounds';
import { fullBibleVerses } from '../data/full_bible';
import './MainPage.css';

function ProLayout() {
  // ===== 状态管理 =====
  const [songs, setSongs] = useState([]);
  const [selectedSong, setSelectedSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isProjectionActive, setIsProjectionActive] = useState(false);
  const [displays, setDisplays] = useState([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState(null);
  const [currentThemeId, setCurrentThemeId] = useState('classic-black');
  const [currentBackgroundId, setCurrentBackgroundId] = useState('none');
  const [favorites, setFavorites] = useState([]);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);

  // 圣经搜索状态
  const [bibleSearchText, setBibleSearchText] = useState('');
  const [selectedBibleVerse, setSelectedBibleVerse] = useState(null);

  // 第四栏展示页状态
  const [displayTab, setDisplayTab] = useState('live'); // live | next | share
  const [isProjectionLocked, setIsProjectionLocked] = useState(false);
  const [lockedSlideIndex, setLockedSlideIndex] = useState(0);

  // 投屏分享状态
  const [availableSources, setAvailableSources] = useState([]);
  const [currentSharingId, setCurrentSharingId] = useState(null);
  const [loadingSources, setLoadingSources] = useState(false);

  const isInitializedRef = useRef(false);

  // ===== 当前主题/背景 =====
  const currentTheme = useMemo(
    () => themes.find(t => t.id === currentThemeId) || themes[0],
    [currentThemeId]
  );

  const allBackgrounds = [...defaultBackgrounds, ...customBackgrounds];
  const currentBackground = useMemo(
    () => allBackgrounds.find(b => b.id === currentBackgroundId) || allBackgrounds[0],
    [currentBackgroundId, allBackgrounds]
  );

  // ===== 搜索 =====
  const [songSearchText, setSongSearchText] = useState('');
  const fuse = useMemo(
    () => new Fuse(songs, {
      keys: ['title', 'author', 'searchKey'],
      threshold: 0.3,
      includeScore: true
    }),
    [songs]
  );

  const filteredSongs = useMemo(() => {
    if (!songSearchText.trim()) return songs;
    const results = fuse.search(songSearchText);
    return results.map(r => r.item);
  }, [songSearchText, songs, fuse]);

  // 圣经过滤
  const filteredBible = useMemo(() => {
    if (!bibleSearchText.trim()) return fullBibleVerses.slice(0, 50);

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

  // ===== 投影更新 =====
  const updateProjection = () => {
    if (!selectedSong) return;
    const slideToShow = isProjectionLocked ? lockedSlideIndex : currentSlideIndex;
    electronAPI.updateLyrics({
      song: selectedSong,
      slideIndex: slideToShow,
      theme: currentTheme,
      background: currentBackground
    });
  };

  // ===== 实时同步 =====
  const syncToProjection = () => {
    if (!selectedSong && !currentSharingId) {
      alert('请先选择内容或投屏源');
      return;
    }

    if (!isProjectionActive) {
      electronAPI.startProjection(selectedDisplayId);
      setIsProjectionActive(true);
      setTimeout(() => {
        if (currentSharingId) {
          electronAPI.shareSource(currentSharingId);
        } else if (selectedSong) {
          setLockedSlideIndex(currentSlideIndex);
          updateProjection();
        }
      }, 500);
    } else {
      if (currentSharingId) {
        electronAPI.shareSource(currentSharingId);
      } else if (selectedSong) {
        setLockedSlideIndex(currentSlideIndex);
        updateProjection();
      }
    }
  };

  // ===== 选择歌曲 =====
  const selectSong = (song) => {
    setSelectedSong(song);
    setCurrentSlideIndex(0);
    setSelectedBibleVerse(null);
    setCurrentSharingId(null);
    if (!isProjectionLocked && isProjectionActive) {
      setLockedSlideIndex(0);
      updateProjection();
    }
  };

  // ===== 选择幻灯片 =====
  const selectSlide = (index) => {
    setCurrentSlideIndex(index);
    if (!isProjectionLocked && isProjectionActive) {
      setLockedSlideIndex(index);
      updateProjection();
    }
  };

  // ===== 编辑幻灯片 =====
  const editSlide = (index, newContent) => {
    if (!selectedSong) return;
    const newSlides = [...selectedSong.slides];
    newSlides[index] = newContent;
    setSelectedSong({ ...selectedSong, slides: newSlides });
    if (!isProjectionLocked && isProjectionActive && currentSlideIndex === index) {
      updateProjection();
    }
  };

  // ===== 选择圣经 =====
  const selectBible = (verse) => {
    setSelectedBibleVerse(verse);
    setCurrentSharingId(null);
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
    if (!isProjectionLocked && isProjectionActive) {
      setLockedSlideIndex(0);
      updateProjection();
    }
  };

  // ===== 投屏相关 =====
  const refreshSources = async () => {
    setLoadingSources(true);
    try {
      const sources = await electronAPI.getSources();
      setAvailableSources(sources);
    } catch (err) {
      console.error('Failed to get sources:', err);
    } finally {
      setLoadingSources(false);
    }
  };

  const selectShareSource = (sourceId) => {
    setCurrentSharingId(sourceId);
    setSelectedSong(null);
    setSelectedBibleVerse(null);
  };

  // ===== 锁定/解锁 =====
  const toggleLock = () => {
    if (isProjectionLocked) {
      setIsProjectionLocked(false);
    } else {
      setLockedSlideIndex(currentSlideIndex);
      setIsProjectionLocked(true);
    }
  };

  // ===== 初始化 =====
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

    const bgStored = localStorage.getItem('jianying_custom_backgrounds');
    if (bgStored) {
      try {
        setCustomBackgrounds(JSON.parse(bgStored));
      } catch (e) {}
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

  useEffect(() => {
    localStorage.setItem('jianying_songs', JSON.stringify(songs));
  }, [songs]);

  useEffect(() => {
    localStorage.setItem('jianying_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('jianying_custom_backgrounds', JSON.stringify(customBackgrounds));
  }, [customBackgrounds]);

  const toggleFavorite = (songId, e) => {
    e?.stopPropagation();
    if (favorites.includes(songId)) {
      setFavorites(favorites.filter(id => id !== songId));
    } else {
      setFavorites([...favorites, songId]);
    }
  };

  const isFavorite = (songId) => favorites.includes(songId);

  // 获取实际显示的幻灯片索引
  const getDisplaySlideIndex = () => {
    return isProjectionLocked ? lockedSlideIndex : currentSlideIndex;
  };

  // ===== 渲染 =====
  return (
    <div className="pro-layout">
      {/* 第一栏：项目列表 */}
      <div className="panel panel-1">
        <div className="panel-header">
          <h3>🎵 项目列表</h3>
          <input
            type="text"
            placeholder="搜索诗歌..."
            value={songSearchText}
            onChange={(e) => setSongSearchText(e.target.value)}
            className="panel-search"
          />
        </div>
        <div className="panel-content">
          <div className="song-grid">
            {filteredSongs.map(song => (
              <div
                key={song.id}
                className={`song-card ${selectedSong?.id === song.id ? 'selected' : ''}`}
                onClick={() => selectSong(song)}
              >
                <div className="song-card-preview" style={{
                  background: currentTheme.backgroundColor.startsWith('linear-gradient')
                    ? currentTheme.backgroundColor
                    : currentTheme.backgroundColor,
                  color: currentTheme.textColor,
                }}>
                  <span className="preview-text">
                    {song.slides[0]?.substring(0, 50) || '无预览'}
                  </span>
                </div>
                <div className="song-card-info">
                  <span className="song-card-title">{song.title}</span>
                  <span className="song-card-count">{song.slides.length}页</span>
                </div>
                <button
                  className={`fav-btn ${isFavorite(song.id) ? 'active' : ''}`}
                  onClick={(e) => toggleFavorite(song.id, e)}
                >
                  {isFavorite(song.id) ? '★' : '☆'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 第二栏：圣经搜索 */}
      <div className="panel panel-2">
        <div className="panel-header">
          <h3>📖 圣经</h3>
        </div>
        <div className="panel-content">
          <input
            type="text"
            placeholder="搜索经文（如：约翰福音3:16）..."
            value={bibleSearchText}
            onChange={(e) => setBibleSearchText(e.target.value)}
            className="bible-search"
          />
          <div className="bible-list">
            {filteredBible.map(verse => (
              <div
                key={`${verse.book}-${verse.chapter}-${verse.verse}`}
                className={`bible-item ${selectedBibleVerse?.ref === verse.ref ? 'selected' : ''}`}
                onClick={() => selectBible(verse)}
              >
                <span className="bible-ref">{verse.ref}</span>
                <span className="bible-preview">{verse.content.substring(0, 40)}...</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 第三栏：详情编辑 */}
      <div className="panel panel-3">
        <div className="panel-header">
          <h3>✏️ 详情编辑</h3>
          <div className="display-select">
            <select
              value={selectedDisplayId || ''}
              onChange={(e) => setSelectedDisplayId(Number(e.target.value))}
            >
              {displays.map(display => (
                <option key={display.id} value={display.id}>
                  {display.label} {display.isPrimary ? '(主屏)' : '(投影)'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="panel-content">
          {selectedSong ? (
            <>
              <div className="song-detail-header">
                <h2>{selectedSong.title}</h2>
              </div>
              <div className="slides-editor">
                {selectedSong.slides.map((slide, index) => (
                  <div
                    key={index}
                    className={`slide-editor-item ${currentSlideIndex === index ? 'active' : ''}`}
                    onClick={() => selectSlide(index)}
                  >
                    <div className="slide-number">
                      {index + 1}
                      {isProjectionLocked && lockedSlideIndex === index && (
                        <span className="lock-indicator">🔒</span>
                      )}
                    </div>
                    <textarea
                      value={slide}
                      onChange={(e) => editSlide(index, e.target.value)}
                      placeholder="幻灯片内容..."
                      className="slide-textarea"
                    />
                  </div>
                ))}
              </div>
              <div className="theme-selector">
                <h4>主题</h4>
                <div className="theme-row">
                  {themes.map(theme => (
                    <div
                      key={theme.id}
                      className={`theme-chip ${currentThemeId === theme.id ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentThemeId(theme.id);
                        if (isProjectionActive) updateProjection();
                      }}
                      style={{
                        background: theme.backgroundColor.startsWith('linear-gradient')
                          ? theme.backgroundColor
                          : theme.backgroundColor,
                        color: theme.textColor,
                      }}
                    >
                      {theme.name}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : currentSharingId ? (
            <div className="share-selected">
              <h3>已选择投屏源</h3>
              <p>{availableSources.find(s => s.id === currentSharingId)?.name}</p>
            </div>
          ) : (
            <div className="empty-state">
              <p>👈 请从左侧选择诗歌、经文或投屏源</p>
            </div>
          )}
        </div>
      </div>

      {/* 第四栏：展示预览 */}
      <div className="panel panel-4">
        <div className="panel-header">
          <h3>👁️ 展示预览</h3>
          <div className="display-tabs">
            <button
              className={displayTab === 'live' ? 'active' : ''}
              onClick={() => setDisplayTab('live')}
            >
              播放页
            </button>
            <button
              className={displayTab === 'next' ? 'active' : ''}
              onClick={() => setDisplayTab('next')}
            >
              预览页
            </button>
            <button
              className={displayTab === 'share' ? 'active' : ''}
              onClick={() => {
                setDisplayTab('share');
                if (availableSources.length === 0) refreshSources();
              }}
            >
              应用分享
            </button>
          </div>
        </div>
        <div className="panel-content">
          {/* 播放页 */}
          {displayTab === 'live' && (
            <div className="display-live">
              <div className="live-preview" style={{
                background: currentTheme.backgroundColor.startsWith('linear-gradient')
                  ? currentTheme.backgroundColor
                  : currentTheme.backgroundColor,
                color: currentTheme.textColor,
              }}>
                {currentSharingId ? (
                  <div className="sharing-placeholder">
                    <span>📺 投屏中...</span>
                    <span className="sharing-name">
                      {availableSources.find(s => s.id === currentSharingId)?.name}
                    </span>
                  </div>
                ) : selectedSong ? (
                  <>
                    {currentBackground && currentBackground.type === 'image' && currentBackground.url ? (
                      <div className="live-bg" style={{
                        backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${currentBackground.url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                      }} />
                    ) : null}
                    <div className="live-text" style={{
                      fontFamily: currentTheme.fontFamily,
                      lineHeight: currentTheme.lineHeight,
                      textAlign: currentTheme.textAlign,
                      whiteSpace: 'pre-wrap',
                      position: 'relative',
                      zIndex: 10,
                    }}>
                      {selectedSong.slides[getDisplaySlideIndex()]}
                    </div>
                    <div className="live-page-num">
                      {getDisplaySlideIndex() + 1} / {selectedSong.slides.length}
                      {isProjectionLocked && ' 🔒'}
                    </div>
                  </>
                ) : (
                  <div className="live-empty">等待内容...</div>
                )}
              </div>

              <div className="live-controls">
                <button
                  className={`control-btn lock-btn ${isProjectionLocked ? 'locked' : ''}`}
                  onClick={toggleLock}
                >
                  {isProjectionLocked ? '🔒 已锁定' : '🔓 未锁定'}
                </button>
                <button
                  className="control-btn sync-btn"
                  onClick={syncToProjection}
                >
                  ⚡ 实时同步
                </button>
                {!isProjectionActive ? (
                  <button
                    className="control-btn primary"
                    onClick={syncToProjection}
                  >
                    ▶ 开始投影
                  </button>
                ) : (
                  <button
                    className="control-btn danger"
                    onClick={() => {
                      electronAPI.stopProjection();
                      setIsProjectionActive(false);
                    }}
                  >
                    ■ 停止投影
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 预览页 */}
          {displayTab === 'next' && (
            <div className="display-next">
              {selectedSong ? (
                <>
                  <div className="next-preview" style={{
                    background: currentTheme.backgroundColor.startsWith('linear-gradient')
                      ? currentTheme.backgroundColor
                      : currentTheme.backgroundColor,
                    color: currentTheme.textColor,
                  }}>
                    <div className="next-text">
                      {selectedSong.slides[Math.min(currentSlideIndex + 1, selectedSong.slides.length - 1)]}
                    </div>
                  </div>
                  <div className="next-info">
                    下一页：第 {Math.min(currentSlideIndex + 2, selectedSong.slides.length)} 页
                  </div>
                </>
              ) : (
                <div className="empty-state">请先选择内容</div>
              )}
            </div>
          )}

          {/* 应用分享 */}
          {displayTab === 'share' && (
            <div className="display-share">
              <button
                className="refresh-btn"
                onClick={refreshSources}
                disabled={loadingSources}
              >
                {loadingSources ? '刷新中...' : '🔄 刷新投屏来源'}
              </button>
              <div className="source-list">
                {availableSources.length === 0 ? (
                  <div className="empty">点击刷新获取窗口/屏幕列表</div>
                ) : (
                  availableSources.map(source => (
                    <div
                      key={source.id}
                      className={`source-item ${currentSharingId === source.id ? 'selected' : ''}`}
                      onClick={() => selectShareSource(source.id)}
                    >
                      <div className="source-name">{source.name}</div>
                      {source.thumbnail && (
                        <img
                          className="source-thumb"
                          src={source.thumbnail}
                          alt={source.name}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .pro-layout {
          display: flex;
          height: 100vh;
          background: #f0f2f5;
        }

        .panel {
          display: flex;
          flex-direction: column;
          border-right: 1px solid #e0e0e0;
        }

        .panel:last-child {
          border-right: none;
        }

        .panel-1 { width: 280px; }
        .panel-2 { width: 320px; }
        .panel-3 { width: 400px; }
        .panel-4 { flex: 1; min-width: 400px; }

        .panel-header {
          padding: 12px 16px;
          background: white;
          border-bottom: 1px solid #e0e0e0;
        }

        .panel-header h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
        }

        .panel-search, .bible-search {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 14px;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        /* 第一栏：项目列表 */
        .song-grid {
          display: grid;
          gap: 10px;
        }

        .song-card {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          cursor: pointer;
          position: relative;
          border: 2px solid transparent;
        }

        .song-card:hover {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .song-card.selected {
          border-color: #667eea;
        }

        .song-card-preview {
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px;
          overflow: hidden;
        }

        .preview-text {
          font-size: 12px;
          text-align: center;
          opacity: 0.9;
        }

        .song-card-info {
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .song-card-title {
          font-weight: 500;
          font-size: 14px;
        }

        .song-card-count {
          font-size: 12px;
          color: #666;
        }

        .fav-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          background: rgba(255,255,255,0.9);
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          cursor: pointer;
          font-size: 16px;
        }

        .fav-btn.active {
          color: #ffc107;
        }

        /* 第二栏：圣经 */
        .bible-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 10px;
        }

        .bible-item {
          background: white;
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          border: 1px solid transparent;
        }

        .bible-item:hover {
          background: #f8f9fa;
        }

        .bible-item.selected {
          border-color: #667eea;
          background: #f0f4ff;
        }

        .bible-ref {
          font-weight: 600;
          font-size: 13px;
          display: block;
          color: #667eea;
        }

        .bible-preview {
          font-size: 12px;
          color: #666;
        }

        /* 第三栏：详情编辑 */
        .display-select select {
          padding: 6px 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .song-detail-header h2 {
          margin: 0 0 12px 0;
          font-size: 18px;
        }

        .slides-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slide-editor-item {
          background: white;
          border-radius: 8px;
          padding: 10px;
          border: 2px solid transparent;
          cursor: pointer;
        }

        .slide-editor-item.active {
          border-color: #667eea;
        }

        .slide-number {
          font-weight: 600;
          font-size: 12px;
          color: #667eea;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .lock-indicator {
          font-size: 14px;
        }

        .slide-textarea {
          width: 100%;
          min-height: 80px;
          padding: 8px;
          border: 1px solid #eee;
          border-radius: 4px;
          font-size: 13px;
          resize: vertical;
        }

        .theme-selector {
          margin-top: 16px;
        }

        .theme-selector h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
        }

        .theme-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .theme-chip {
          padding: 6px 12px;
          border-radius: 20px;
          cursor: pointer;
          font-size: 12px;
          border: 2px solid transparent;
        }

        .theme-chip.active {
          border-color: #333;
        }

        .share-selected, .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }

        /* 第四栏：展示预览 */
        .display-tabs {
          display: flex;
          gap: 4px;
        }

        .display-tabs button {
          padding: 6px 14px;
          border: none;
          background: #f0f0f0;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
        }

        .display-tabs button.active {
          background: #667eea;
          color: white;
        }

        .live-preview {
          aspect-ratio: 16/9;
          width: 100%;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .live-bg {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        .live-text {
          font-size: 32px;
          padding: 40px;
          text-align: center;
          max-width: 90%;
        }

        .live-page-num {
          position: absolute;
          bottom: 16px;
          right: 24px;
          font-size: 18px;
          opacity: 0.6;
        }

        .live-empty, .sharing-placeholder {
          font-size: 24px;
          opacity: 0.5;
          text-align: center;
        }

        .sharing-name {
          display: block;
          font-size: 14px;
          margin-top: 8px;
        }

        .live-controls {
          display: flex;
          gap: 10px;
        }

        .control-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          background: #e9ecef;
        }

        .control-btn.primary {
          background: #28a745;
          color: white;
        }

        .control-btn.danger {
          background: #dc3545;
          color: white;
        }

        .control-btn.sync-btn {
          background: #667eea;
          color: white;
        }

        .control-btn.lock-btn {
          background: #ffc107;
        }

        .control-btn.lock-btn.locked {
          background: #fd7e14;
          color: white;
        }

        .display-next, .display-share {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .next-preview {
          aspect-ratio: 16/9;
          width: 100%;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px;
          margin-bottom: 12px;
        }

        .next-text {
          font-size: 24px;
          text-align: center;
          opacity: 0.7;
        }

        .next-info {
          text-align: center;
          color: #666;
          font-size: 14px;
        }

        .refresh-btn {
          width: 100%;
          padding: 10px;
          border: none;
          background: #667eea;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          margin-bottom: 12px;
        }

        .refresh-btn:disabled {
          opacity: 0.6;
        }

        .source-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .source-item {
          background: white;
          border-radius: 8px;
          padding: 10px;
          cursor: pointer;
          border: 2px solid transparent;
        }

        .source-item:hover {
          background: #f8f9fa;
        }

        .source-item.selected {
          border-color: #667eea;
        }

        .source-name {
          font-weight: 500;
          margin-bottom: 6px;
        }

        .source-thumb {
          width: 100%;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

export default ProLayout;
