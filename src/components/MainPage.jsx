import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import electronAPI from '../utils/electronAPI';
import { defaultSongs } from '../data/defaultSongs';
import { themes } from '../data/themes';
import { defaultBackgrounds } from '../data/backgrounds';
import { fullBibleVerses } from '../data/full_bible';
import './MainPage.css';

function MainPage() {
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
  const [activeTab, setActiveTab] = useState('songs'); // songs | favorites | recent | bible | share
  const [availableSources, setAvailableSources] = useState([]);
  const [currentSharingId, setCurrentSharingId] = useState(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [isProjectionLocked, setIsProjectionLocked] = useState(false);
  const [previewSlideIndex, setPreviewSlideIndex] = useState(0);
  const [bibleSearchText, setBibleSearchText] = useState('');
  const [selectedBibleVerse, setSelectedBibleVerse] = useState(null);
  const [editedBibleContent, setEditedBibleContent] = useState('');
  const [bibleEditMode, setBibleEditMode] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [backgroundModalOpen, setBackgroundModalOpen] = useState(false);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  const [slidesEditModalOpen, setSlidesEditModalOpen] = useState(false);
  const [editedSlides, setEditedSlides] = useState([]);
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [clearFavoritesConfirm, setClearFavoritesConfirm] = useState(false);

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

  // 更新投影内容
  const updateProjection = () => {
    if (!selectedSong) return;
    // 投影总是显示 currentSlideIndex
    // 锁定功能只是：在锁定时，主屏翻页不改变 currentSlideIndex
    // 用户确认后才把预览的页码同步到 currentSlideIndex 更新投影
    electronAPI.updateLyrics({
      song: selectedSong,
      slideIndex: currentSlideIndex,
      theme: currentTheme,
      background: currentBackground
    });
  };

  // 过滤后的歌曲列表
  const filteredSongs = useMemo(() => {
    if (activeTab === 'share' || activeTab === 'bible') return [];

    if (activeTab === 'recent') {
      // 最近使用 - 按顺序返回最近使用的歌曲
      return recentSongs
        .map(id => songs.find(s => s.id === id))
        .filter(Boolean);
    }

    if (activeTab === 'favorites') {
      if (!searchText.trim()) {
        return songs.filter(s => favorites.includes(s.id));
      }
      const results = fuse.search(searchText);
      const resultSongs = results.map(r => r.item);
      return resultSongs.filter(s => favorites.includes(s.id));
    }

    if (!searchText.trim()) {
      return songs;
    }

    const results = fuse.search(searchText);
    return results.map(r => r.item);
  }, [searchText, activeTab, songs, favorites, recentSongs, fuse]);

  // 过滤圣经经文 - 支持精确格式如 "约翰福音3:16"
  const filteredBible = useMemo(() => {
    if (!bibleSearchText.trim()) return fullBibleVerses.slice(0, 20);
    
    const searchLower = bibleSearchText.toLowerCase().trim();
    // 匹配如 "约翰福音3:16" "约3:16" "诗23" 格式
    const chapterVerseMatch = searchLower.match(/^(.+?)\s*(\d+)\s*[:：]\s*(\d+)$/);
    const chapterMatch = searchLower.match(/^(.+?)\s*(\d+)$/);
    
    if (chapterVerseMatch) {
      // 精确匹配 书 章:节 格式
      const book = chapterVerseMatch[1].trim();
      const chapter = parseInt(chapterVerseMatch[2]);
      const verse = parseInt(chapterVerseMatch[3]);
      // 先尝试精确匹配书卷名+章节+节号
      const exactMatch = fullBibleVerses.filter(v => 
        v.book.toLowerCase().includes(book) &&
        v.chapter === chapter &&
        v.verse === verse
      );
      if (exactMatch.length > 0) {
        return exactMatch;
      }
    } else if (chapterMatch) {
      // 匹配 书 章 格式 - 返回整章所有节
      const book = chapterMatch[1].trim();
      const chapter = parseInt(chapterMatch[2]);
      const exactMatch = fullBibleVerses.filter(v => 
        v.book.toLowerCase().includes(book) &&
        v.chapter === chapter
      );
      if (exactMatch.length > 0) {
        return exactMatch;
      }
    }
    
    // 普通搜索：参考和内容都搜索
    return fullBibleVerses.filter(v => 
      v.ref.toLowerCase().includes(searchLower) || 
      v.book.toLowerCase().includes(searchLower) ||
      v.content.toLowerCase().includes(searchLower)
    ).slice(0, 100);
  }, [bibleSearchText]);

  // 选择圣经经文，自动拼接到歌词幻灯片格式
  const selectBibleVerse = (verse) => {
    setSelectedBibleVerse(verse);
    setEditedBibleContent(verse.content);
    setBibleEditMode(false);
    // 将经文拆分为幻灯片（每行一句），创建临时歌曲
    const lines = verse.content.split(/\n/).filter(l => l.trim());
    const slides = lines.length <= 4 ? [lines.join('\n')] : lines;
    const tempSong = {
      id: `bible_${verse.book}_${verse.chapter}_${verse.verse}`,
      title: `${verse.ref}`,
      author: '',
      searchKey: verse.ref.toLowerCase(),
      slides: slides
    };
    handleSelectSong(tempSong);
  };

  // 应用编辑修改后重新生成幻灯片
  const applyBibleEdit = () => {
    if (!selectedBibleVerse || !selectedSong) return;
    const lines = editedBibleContent.split(/\n/).filter(l => l.trim());
    const slides = lines.length <= 4 ? [lines.join('\n')] : lines;
    // 创建修改后的歌曲
    const editedSong = {
      ...selectedSong,
      slides: slides
    };
    selectSong(editedSong);
    // 如果投影已开启，更新内容
    if (isProjectionActive) {
      updateProjection();
    }
    setBibleEditMode(false);
  };

  // 打开幻灯片编辑
  const openSlidesEdit = () => {
    if (!selectedSong) return;
    setEditedSlides([...selectedSong.slides]);
    setSlidesEditModalOpen(true);
  };

  // 保存幻灯片编辑
  const saveSlidesEdit = () => {
    if (!selectedSong) return;
    // 过滤掉空幻灯片
    const cleaned = editedSlides.filter(s => s.trim());
    const editedSong = {
      ...selectedSong,
      slides: cleaned
    };
    selectSong(editedSong);
    // 更新投影
    if (isProjectionActive) {
      updateProjection();
    }
    setSlidesEditModalOpen(false);
  };

  // 添加/移除幻灯片
  const addSlide = (index) => {
    const newSlides = [...editedSlides];
    newSlides.splice(index + 1, 0, '');
    setEditedSlides(newSlides);
  };

  const removeSlide = (index) => {
    if (editedSlides.length <= 1) {
      alert('至少保留一页幻灯片');
      return;
    }
    const newSlides = [...editedSlides];
    newSlides.splice(index, 1);
    setEditedSlides(newSlides);
  };

  const moveSlideUp = (index) => {
    if (index === 0) return;
    const newSlides = [...editedSlides];
    [newSlides[index], newSlides[index - 1]] = [newSlides[index - 1], newSlides[index]];
    setEditedSlides(newSlides);
  };

  const moveSlideDown = (index) => {
    if (index >= editedSlides.length - 1) return;
    const newSlides = [...editedSlides];
    [newSlides[index], newSlides[index + 1]] = [newSlides[index + 1], newSlides[index]];
    setEditedSlides(newSlides);
  };

  // 一键清空收藏夹
  const clearAllFavorites = () => {
    if (!confirm('确定要清空所有收藏吗？这个操作无法撤销！')) return;
    songs.forEach(song => {
      song.favorite = false;
    });
    favorites.clear();
    setFavorites(new Set());
    setClearFavoritesConfirm(false);
  };

  // 导出收藏（或所有自定义）诗歌数据
  const exportCustomSongs = () => {
    // 导出所有用户添加的诗歌
    const customSongs = songs.filter(s => s.id.startsWith('import_') || s.id.startsWith('bible_'));
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      customSongs: customSongs,
      favorites: Array.from(favorites)
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yinuo-projection-songs-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert(`成功导出 ${customSongs.length} 首自定义诗歌到文件`);
  };

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

  // 开始分享窗口/屏幕
  const startShare = (sourceId) => {
    setCurrentSharingId(sourceId);
    electronAPI.shareSource(sourceId);
  };

  // 停止分享
  const stopShare = () => {
    setCurrentSharingId(null);
    electronAPI.stopShare();
  };

  // 初始化
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // 加载默认歌曲
    const stored = localStorage.getItem('jiayan_songs');
    if (stored) {
      try {
        setSongs(JSON.parse(stored));
      } catch (e) {
        setSongs(defaultSongs);
      }
    } else {
      setSongs(defaultSongs);
    }

    // 加载收藏
    const favStored = localStorage.getItem('jiayan_favorites');
    if (favStored) {
      try {
        setFavorites(JSON.parse(favStored));
      } catch (e) {}
    }

    // 加载最近使用
    const recentStored = localStorage.getItem('jiayan_recent');
    if (recentStored) {
      try {
        setRecentSongs(JSON.parse(recentStored));
      } catch (e) {}
    }

    // 加载自定义背景
    const bgStored = localStorage.getItem('jiayan_custom_backgrounds');
    if (bgStored) {
      try {
        setCustomBackgrounds(JSON.parse(bgStored));
      } catch (e) {}
    }

    // 获取显示器列表
    electronAPI.getDisplays().then(displays => {
      setDisplays(displays);
      // 默认选第二个显示器（投影仪）
      const secondary = displays.find(d => !d.isPrimary);
      if (secondary) {
        setSelectedDisplayId(secondary.id);
      } else {
        setSelectedDisplayId(displays[0]?.id);
      }
    });

    // 检查投影状态
    electronAPI.isProjectionActive().then(setIsProjectionActive);

    // 自动聚焦搜索框
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 200);

    // 监听事件
    const offClosed = electronAPI.onProjectionClosed(() => {
      setIsProjectionActive(false);
    });

    const offNext = electronAPI.onNextSlide(() => {
      if (selectedSong && currentSlideIndex < selectedSong.slides.length - 1) {
        nextSlide();
      }
    });

    const offPrev = electronAPI.onPrevSlide(() => {
      if (currentSlideIndex > 0) {
        prevSlide();
      }
    });

    return () => {
      offClosed();
      offNext();
      offPrev();
    };
  }, []);

  // 保存歌曲到本地存储
  useEffect(() => {
    localStorage.setItem('jiayan_songs', JSON.stringify(songs));
  }, [songs]);

  // 保存收藏
  useEffect(() => {
    localStorage.setItem('jiayan_favorites', JSON.stringify(favorites));
  }, [favorites]);

  // 保存最近使用
  useEffect(() => {
    localStorage.setItem('jiayan_recent', JSON.stringify(recentSongs));
  }, [recentSongs]);

  // 保存自定义背景
  useEffect(() => {
    localStorage.setItem('jiayan_custom_backgrounds', JSON.stringify(customBackgrounds));
  }, [customBackgrounds]);

  // 添加到最近使用
  const addToRecent = (songId) => {
    setRecentSongs(prev => {
      // 移除重复，添加到最前面，最多保留 20 首
      const filtered = prev.filter(id => id !== songId);
      return [songId, ...filtered].slice(0, 20);
    });
  };

  // 批量导入歌词
  const handleImport = () => {
    if (!importText.trim()) {
      alert('请粘贴歌词文本');
      return;
    }

    // 格式: [标题]换行，歌词一行一行，然后空行分隔下一首
    const lines = importText.split('\n').map(l => l.trimEnd());
    const newSongs = [];
    let currentTitle = null;
    let currentLines = [];

    const flushCurrent = () => {
      if (currentTitle && currentLines.length > 0) {
        // 拆分幻灯片：每 4-6 行自动分页，保持行长不太长
        const slides = [];
        let currentSlide = [];
        let currentLineCount = 0;
        
        currentLines.forEach(line => {
          if (line.trim()) {
            currentSlide.push(line.trim());
            currentLineCount++;
            // 每 3-5 行分页
            if (currentLineCount >= 4) {
              slides.push(currentSlide.join('\n'));
              currentSlide = [];
              currentLineCount = 0;
            }
          }
        });
        if (currentSlide.length > 0) {
          slides.push(currentSlide.join('\n'));
        }

        const newId = `imported_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        newSongs.push({
          id: newId,
          title: currentTitle.trim(),
          author: '',
          searchKey: currentTitle.toLowerCase() + ' ' + currentTitle.replace(/\s/g, '').toLowerCase(),
          slides: slides,
          imported: true
        });
      }
      currentTitle = null;
      currentLines = [];
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) {
        // 空行分隔歌曲
        if (currentTitle) {
          flushCurrent();
        }
      } else if (currentTitle === null) {
        // 第一行是标题
        currentTitle = trimmed;
      } else {
        currentLines.push(line);
      }
    });

    // 处理最后一首
    if (currentTitle) {
      flushCurrent();
    }

    if (newSongs.length === 0) {
      alert('没有识别到有效的诗歌，请检查格式：每行一首歌名，然后是歌词，空行分隔下一首');
      return;
    }

    // 我们把导入的歌曲添加到 songs 数组
    // 实际开发中我们需要持久化存储，这里我们直接添加到当前数组
    songs.unshift(...newSongs);

    alert(`成功导入 ${newSongs.length} 首诗歌！`);
    setImportText('');
    setImportModalOpen(false);
  };

  // 上传自定义背景
  const handleBackgroundUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 检查类型
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('只支持 JPG 和 PNG 格式图片');
      return;
    }

    // 检查大小（不超过 5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      const newBg = {
        id: `custom_${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        type: 'image',
        url: dataUrl
      };
      setCustomBackgrounds([...customBackgrounds, newBg]);
      alert(`成功上传背景 "${newBg.name}"！`);
    };
    reader.readAsDataURL(file);
  };

  // 删除自定义背景
  const deleteCustomBackground = (bgId) => {
    if (confirm('确定要删除这个背景吗？')) {
      setCustomBackgrounds(customBackgrounds.filter(bg => bg.id !== bgId));
      // 如果删除的是当前选中，清除选择
      if (currentBackgroundId === bgId) {
        setCurrentBackgroundId('none');
      }
    }
  };

  // 选择歌曲
  const handleSelectSong = (song) => {
    setSelectedSong(song);
    setCurrentSlideIndex(0);
    addToRecent(song.id);

    if (isProjectionActive && !isProjectionLocked) {
      updateProjection();
    }
  };

  // 开始投影
  const startProjection = () => {
    electronAPI.startProjection(selectedDisplayId);
    setIsProjectionActive(true);
    // 等待窗口打开后发送初始内容
    setTimeout(() => {
      if (currentSharingId) {
        // 如果已经选中分享源，开始分享
        electronAPI.shareSource(currentSharingId);
      } else if (selectedSong) {
        // 否则发送歌词
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

  // 上一页/下一页
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
    e.stopPropagation();
    if (favorites.includes(songId)) {
      setFavorites(favorites.filter(id => id !== songId));
    } else {
      setFavorites([...favorites, songId]);
    }
  };

  const isFavorite = (songId) => favorites.includes(songId);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 如果焦点在输入框，不处理快捷键（允许输入空格）
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl/Cmd + F 聚焦搜索
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        searchInputRef.current?.focus();
        e.preventDefault();
      }
      // 右方向键或空格下一页
      if (selectedSong && isProjectionActive && (e.key === ' ' || e.key === 'ArrowRight')) {
        e.preventDefault();
        if (isProjectionLocked) {
          // 锁定时只改变预览
          if (previewSlideIndex < selectedSong.slides.length - 1) {
            setPreviewSlideIndex(previewSlideIndex + 1);
          }
        } else {
          // 未锁定直接改投影
          if (currentSlideIndex < selectedSong.slides.length - 1) {
            setCurrentSlideIndex(currentSlideIndex + 1);
            updateProjection();
          }
        }
      }
      // 左方向键上一页
      if (selectedSong && isProjectionActive && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isProjectionLocked) {
          if (previewSlideIndex > 0) {
            setPreviewSlideIndex(previewSlideIndex - 1);
          }
        } else {
          if (currentSlideIndex > 0) {
            setCurrentSlideIndex(currentSlideIndex - 1);
            updateProjection();
          }
        }
      }
      // ESC 退出投屏分享模式
      if (e.key === 'Escape' && currentSharingId) {
        stopShare();
      }
      // L 键: 锁定/解锁投影
      if (e.key.toLowerCase() === 'l' && selectedSong && isProjectionActive) {
        if (!isProjectionLocked) {
          setPreviewSlideIndex(currentSlideIndex);
          setIsProjectionLocked(true);
        } else {
          applyPreviewToProjection();
        }
      }
      // E 键: 编辑幻灯片
      if (e.key.toLowerCase() === 'e' && selectedSong && !slidesEditModalOpen) {
        openSlidesEdit();
      }
      // F 键: 切换收藏
      if (e.key.toLowerCase() === 'f' && selectedSong) {
        toggleFavorite(selectedSong.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSong, isProjectionLocked, currentSlideIndex, previewSlideIndex, isProjectionActive, currentSharingId, updateProjection]);

  // 应用预览更改到投影（解锁时调用）
  const applyPreviewToProjection = () => {
    setCurrentSlideIndex(previewSlideIndex);
    // 同步预览索引到当前索引，下次锁定时从新位置开始
    setPreviewSlideIndex(previewSlideIndex);
    setIsProjectionLocked(false);
    updateProjection();
  };

  return (
    <div className="main-page">
      {/* 顶部工具栏 */}
      <header className="header">
        <h1>舣诺投屏</h1>
        <div className="status-bar">
          {isProjectionActive ? (
            <span className="status active">投影中</span>
          ) : (
            <span className="status inactive">未投影</span>
          )}
        </div>
      </header>

      <div className="content">
        {/* 左侧：搜索和歌曲列表 */}
        <div className="sidebar">
          {/* 搜索框 */}
          <div className="search-box">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={activeTab === 'bible' ? '搜索圣经经文，例如 约翰福音3:16...' : '搜索圣诗...'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            {activeTab === 'songs' && (
              <button className="import-btn" onClick={() => setImportModalOpen(true)}>
                📥 批量导入
              </button>
            )}
            {activeTab === 'favorites' && favorites.size > 0 && (
              <button className="export-btn" onClick={exportCustomSongs}>
                💾 导出收藏
              </button>
            )}
          </div>

          {/* 标签页 */}
          <div className="tabs">
            <button
              className={activeTab === 'songs' ? 'active' : ''}
              onClick={() => setActiveTab('songs')}
            >
              全部诗歌
            </button>
            <button
              className={activeTab === 'bible' ? 'active' : ''}
              onClick={() => setActiveTab('bible')}
            >
              圣经经文
            </button>
            <button
              className={activeTab === 'recent' ? 'active' : ''}
              onClick={() => setActiveTab('recent')}
            >
              最近 ({recentSongs.length})
            </button>
            <button
              className={activeTab === 'favorites' ? 'active' : ''}
              onClick={() => setActiveTab('favorites')}
            >
              收藏 ({favorites.length})
            </button>
            <button
              className={activeTab === 'share' ? 'active' : ''}
              onClick={() => {
                setActiveTab('share');
                if (availableSources.length === 0) {
                  refreshSources();
                }
              }}
            >
              投屏分享
            </button>
          </div>

          {/* 投屏分享 */}
          {activeTab === 'share' ? (
            <div className="share-panel">
              <button className="refresh-btn" onClick={refreshSources} disabled={loadingSources}>
                {loadingSources ? '刷新中...' : '🔄 刷新投屏来源'}
              </button>
              <div className="source-list">
                {availableSources.length === 0 ? (
                  <div className="empty">点击上面按钮刷新获取窗口/屏幕/摄像头列表</div>
                ) : (
                  availableSources.map(source => (
                    <div
                      key={source.id}
                      className={`source-item ${currentSharingId === source.id ? 'selected' : ''}`}
                      onClick={() => {
                        setCurrentSharingId(source.id);
                        if (isProjectionActive) {
                          startShare(source.id);
                        }
                      }}
                    >
                      <div className="source-info">
                        <div className="source-name">{source.name}</div>
                      </div>
                      {source.thumbnail && (
                        <img
                          className="thumbnail"
                          src={`data:image/png;base64,${source.thumbnail}`}
                          alt={source.name}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
              {currentSharingId && !isProjectionActive && (
                <div className="share-controls">
                  <button className="btn primary full-width" onClick={startProjection}>
                    ▶ 开始投影分享
                  </button>
                </div>
              )}
              {currentSharingId && isProjectionActive && (
                <div className="share-controls">
                  <button className="btn danger full-width" onClick={stopShare}>
                    ■ 停止投屏
                  </button>
                </div>
              )}
            </div>
          ) : activeTab === 'bible' ? (
            <>
              <div className="search-box">
                <input
                  type="text"
                  placeholder="搜索经文（如：约翰福音 3:16）..."
                  value={bibleSearchText}
                  onChange={(e) => setBibleSearchText(e.target.value)}
                />
              </div>
              <div className="song-list">
                {filteredBible.length === 0 ? (
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
                )}
              </div>
            </>
          ) : (
            <div className="song-list">
              {filteredSongs.length === 0 ? (
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
              )}
            </div>
          )}
        </div>

        {/* 中间：设置和小预览 */}
        <div className="main-area">
          {/* 设置区 */}
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
              <label>选择主题样式：</label>
              <div className="theme-grid">
                {themes.map(theme => (
                  <div
                    key={theme.id}
                    className={`theme-card ${currentThemeId === theme.id ? 'selected' : ''}`}
                    onClick={() => setCurrentThemeId(theme.id)}
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

            <div className="setting-group">
              <label>
                选择背景图片：
                <button className="manage-bg-btn" onClick={() => setBackgroundModalOpen(true)}>
                  ⚙️ 管理自定义
                </button>
              </label>
              <div className="background-grid">
                {defaultBackgrounds.slice(1).map(bg => (
                  <div
                    key={bg.id}
                    className={`background-card ${currentBackgroundId === bg.id ? 'selected' : ''}`}
                    onClick={() => setCurrentBackgroundId(bg.id)}
                  >
                    {bg.type === 'image' && bg.url ? (
                      <div className="bg-preview" style={{backgroundImage: `url(${bg.url})`}} />
                    ) : (
                      <div className="bg-preview" style={{background: '#eee'}} />
                    )}
                    <span className="bg-name">{bg.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 当前选中诗歌小预览（右上） */}
          {selectedSong ? (
            <div className="current-song">
              <div className="current-song-header">
                <h2>{selectedSong.title}</h2>
                <div className="slide-info">
                  预览: 第 {isProjectionLocked ? previewSlideIndex + 1 : currentSlideIndex + 1} / {selectedSong.slides.length} 页
                  {isProjectionLocked && (
                    <span className="locked-badge">🔒 投影已锁定</span>
                  )}
                </div>
              </div>

              {/* 锁定状态说明 */}
              {isProjectionLocked && (
                <div className="lock-info">
                  ℹ️ 当前投影已锁定在第 {currentSlideIndex + 1} 页，你可以在左侧翻页预览下一页，确认后点击"应用更改"更新投影
                </div>
              )}

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
                  fontSize: '24px',
                  lineHeight: currentTheme.lineHeight,
                  textAlign: currentTheme.textAlign,
                  whiteSpace: 'pre-wrap',
                  position: 'relative',
                  zIndex: 10,
                  padding: '10px'
                }}>
                  {selectedSong.slides[isProjectionLocked ? previewSlideIndex : currentSlideIndex]}
                </div>
              </div>

              {/* 圣经经文编辑（仅当选中经文时显示） */}
              {selectedBibleVerse && (
                <div className="bible-edit-section">
                  <div className="bible-edit-header">
                    <span>经文编辑：{selectedBibleVerse.ref}</span>
                    {!bibleEditMode ? (
                      <button className="btn small secondary" onClick={() => setBibleEditMode(true)}>
                        ✏️ 编辑内容
                      </button>
                    ) : (
                      <button className="btn small secondary" onClick={() => setBibleEditMode(false)}>
                        ✖️ 取消编辑
                      </button>
                    )}
                  </div>
                  {bibleEditMode && (
                    <>
                      <textarea
                        className="bible-edit-textarea"
                        value={editedBibleContent}
                        onChange={(e) => setEditedBibleContent(e.target.value)}
                        placeholder="在这里编辑经文内容..."
                      />
                      <div className="bible-edit-actions">
                        <button className="btn small primary" onClick={applyBibleEdit}>
                          ✓ 应用修改并更新投影
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* 控制按钮 */}
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
                {isProjectionActive && (
                  <button
                    className={`btn ${isProjectionLocked ? 'warning' : 'secondary'}`}
                    onClick={() => {
                      if (!isProjectionLocked) {
                        // 锁定：保存当前投影页，开始预览编辑
                        setPreviewSlideIndex(currentSlideIndex);
                        setIsProjectionLocked(true);
                      } else {
                        // 解锁：应用预览页到投影
                        applyPreviewToProjection();
                      }
                    }}
                  >
                    {isProjectionLocked ? '🔒 已锁定 - 点击应用更改' : '🔒 锁定投影（编辑下一页）'}
                  </button>
                )}
                <button
                  className="btn secondary"
                  onClick={() => {
                    const targetIndex = isProjectionLocked ? previewSlideIndex : currentSlideIndex;
                    if (targetIndex > 0) {
                      if (isProjectionLocked) {
                        setPreviewSlideIndex(targetIndex - 1);
                      } else {
                        setCurrentSlideIndex(targetIndex - 1);
                        updateProjection();
                      }
                    }
                  }}
                  disabled={!selectedSong || (isProjectionLocked ? previewSlideIndex === 0 : currentSlideIndex === 0) || !isProjectionActive}
                >
                  ← 上一页
                </button>
                <button
                  className="btn secondary"
                  onClick={() => {
                    const targetIndex = isProjectionLocked ? previewSlideIndex : currentSlideIndex;
                    if (targetIndex < selectedSong.slides.length - 1) {
                      if (isProjectionLocked) {
                        setPreviewSlideIndex(targetIndex + 1);
                      } else {
                        setCurrentSlideIndex(targetIndex + 1);
                        updateProjection();
                      }
                    }
                  }}
                  disabled={!selectedSong || (isProjectionLocked ? previewSlideIndex >= selectedSong.slides.length - 1 : currentSlideIndex >= selectedSong.slides.length - 1) || !isProjectionActive}
                >
                  下一页 →
                </button>
              </div>

              {/* 第二行工具栏 */}
              {selectedSong && (
                <div className="toolbar">
                  <button
                    className="btn secondary"
                    onClick={openSlidesEdit}
                  >
                    📝 编辑幻灯片
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => setShortcutsModalOpen(true)}
                  >
                    ⌨️ 快捷键
                  </button>
                  {activeTab === 'favorites' && (
                    <button
                      className="btn danger small"
                      onClick={clearAllFavorites}
                    >
                      🗑 清空收藏
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>👈 请从左侧选择一首诗歌开始投影</p>
            </div>
          )}
        </div>

        {/* 最右侧：完整投影预览，和实际投影仪显示完全一致 */}
        <div className="projection-preview">
          {selectedSong ? (
            <div className="projection-preview-inner" style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
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
                  fontSize: '80px',
                  lineHeight: currentTheme.lineHeight,
                  textAlign: currentTheme.textAlign,
                  whiteSpace: 'pre-wrap',
                  maxWidth: '90%',
                  position: 'relative',
                  zIndex: 10
                }}>
                  {/* 右侧监控始终显示实际投影的内容（currentSlideIndex） */}
                  {selectedSong.slides[currentSlideIndex]}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '25px',
                  right: '35px',
                  fontSize: '28px',
                  opacity: 0.5,
                  color: currentTheme.textColor,
                  zIndex: 10
                }}>
                  {currentSlideIndex + 1} / {selectedSong.slides.length}
                </div>
              </div>
              <div className="projection-preview-label">实时投影预览（与投影仪输出完全一致）</div>
            </div>
          ) : selectedBibleVerse ? (
            <div className="projection-preview-inner">
              <div className="empty-state-dark">
                请选择经文后开始投影
              </div>
            </div>
          ) : (
            <div className="projection-preview-inner">
              <div className="empty-state-dark">
                📺<br/>
                投影预览区域<br/>
                选择诗歌后这里实时显示投影效果
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 批量导入模态框 */}
      {importModalOpen && (
        <div className="modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>批量导入诗歌</h2>
              <button className="close-btn" onClick={() => setImportModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="import-hint">
                粘贴纯文本，格式如下：<br/>
                第一行为诗歌标题，然后每行一句歌词，空行分隔下一首诗歌<br/>
                例如：<br/>
                <pre>
爱我耶稣<br/>
爱我耶稣，原因何在<br/>
因你耶稣曾钉十架<br/><br/>
生命活水<br/>
生命活水，从我心中流出<br/>
洗净我罪，使我洁白
                </pre>
              </p>
              <textarea
                className="import-textarea"
                placeholder="请在这里粘贴要导入的歌词..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setImportModalOpen(false)}>
                取消
              </button>
              <button className="btn primary" onClick={handleImport}>
                ✓ 确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自定义背景管理模态框 */}
      {backgroundModalOpen && (
        <div className="modal-overlay" onClick={() => setBackgroundModalOpen(false)}>
          <div className="modal-content modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>自定义背景管理</h2>
              <button className="close-btn" onClick={() => setBackgroundModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="upload-section">
                <label className="upload-label">
                  <span>📷 上传新背景图片（JPG/PNG，最大 5MB）</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleBackgroundUpload}
                    className="upload-input"
                  />
                </label>
              </div>
              {customBackgrounds.length === 0 ? (
                <div className="empty">还没有自定义背景</div>
              ) : (
                <div className="custom-bg-grid">
                  {customBackgrounds.map(bg => (
                    <div
                      key={bg.id}
                      className={`custom-bg-item ${currentBackgroundId === bg.id ? 'selected' : ''}`}
                      onClick={() => {
                        setCurrentBackgroundId(bg.id);
                      }}
                    >
                      <div className="bg-preview" style={{
                        backgroundImage: `url(${bg.url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }} />
                      <div className="bg-name">{bg.name}</div>
                      <button
                        className="delete-bg-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomBackground(bg.id);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setBackgroundModalOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 幻灯片编辑模态框 */}
      {slidesEditModalOpen && (
        <div className="modal-overlay" onClick={() => setSlidesEditModalOpen(false)}>
          <div className="modal-content modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>编辑幻灯片顺序：{selectedSong.title}</h2>
              <button className="close-btn" onClick={() => setSlidesEditModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-hint">在这里可以添加、删除、移动幻灯片来调整顺序。修改完成后点击保存应用到投影。</p>
              {editedSlides.map((slide, index) => (
                <div key={index} className="slide-edit-item">
                  <div className="slide-number">第 {index + 1} 页</div>
                  <textarea
                    className="slide-edit-textarea"
                    value={slide}
                    onChange={(e) => {
                      const newSlides = [...editedSlides];
                      newSlides[index] = e.target.value;
                      setEditedSlides(newSlides);
                    }}
                    placeholder="请输入幻灯片内容..."
                  />
                  <div className="slide-edit-actions">
                    <button className="btn small" onClick={() => moveSlideUp(index)} disabled={index === 0}>
                      ↑上移
                    </button>
                    <button className="btn small" onClick={() => moveSlideDown(index)} disabled={index >= editedSlides.length - 1}>
                      ↓下移
                    </button>
                    <button className="btn small" onClick={() => addSlide(index)}>
                      +添加
                    </button>
                    <button className="btn small danger" onClick={() => removeSlide(index)}>
                      ✕删除
                    </button>
                  </div>
                </div>
              ))}
              <button className="btn secondary full-width" onClick={() => addSlide(editedSlides.length)}>
                + 添加新幻灯片
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setSlidesEditModalOpen(false)}>
                取消
              </button>
              <button className="btn primary" onClick={saveSlidesEdit}>
                ✓ 保存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 快捷键说明模态框 */}
      {shortcutsModalOpen && (
        <div className="modal-overlay" onClick={() => setShortcutsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>键盘快捷键</h2>
              <button className="close-btn" onClick={() => setShortcutsModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="shortcut-list">
                <div className="shortcut-item">
                  <span className="shortcut-key">空格 / 向下方向键 / PageDown</span>
                  <span className="shortcut-desc">下一页</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-key">Backspace / 向上方向键 / PageUp</span>
                  <span className="shortcut-desc">上一页</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-key">Enter</span>
                  <span className="shortcut-desc">开始投影</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-key">Esc</span>
                  <span className="shortcut-desc">停止投影 / 关闭弹窗</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-key">L</span>
                  <span className="shortcut-desc">锁定/解锁投影</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-key">E</span>
                  <span className="shortcut-desc">编辑幻灯片</span>
                </div>
                <div className="shortcut-item">
                  <span className="shortcut-key">F</span>
                  <span className="shortcut-desc">添加收藏 / 取消收藏</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn secondary" onClick={() => setShortcutsModalOpen(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MainPage;
