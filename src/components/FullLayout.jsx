import React, { useState, useEffect, useMemo, useRef } from 'react';
import Fuse from 'fuse.js';
import electronAPI from '../utils/electronAPI';
import { defaultSongs } from '../data/defaultSongs';
import { themes } from '../data/themes';
import { defaultBackgrounds } from '../data/backgrounds';
import { bibleBooks, getBookLabel, matchBibleBook } from '../data/bibleBooks';
import { bibleVersions, bibleVersionMap } from '../data/bibleVersions';
import { uiCopy } from '../data/i18n';
import { getImportedSongs } from '../data/loader';
import DataPackManager from './DataPackManager';
import './MainPage.css';
import './FullLayout.css';

// 项目类型
const PROJECT_TYPES = {
  SONG: 'song',
  BIBLE: 'bible',
  PPT: 'ppt',
  VIDEO: 'video',
  AUDIO: 'audio',
  IMAGE: 'image',
  CUSTOM: 'custom',
};

const parseVerseList = (text) => {
  if (!text) return [];
  const verses = [];

  text.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const range = trimmed.split('-');
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let verse = start; verse <= end; verse += 1) {
          verses.push(verse);
        }
      }
      return;
    }

    const verse = parseInt(trimmed, 10);
    if (!Number.isNaN(verse)) {
      verses.push(verse);
    }
  });

  return verses;
};

const parseQuickSearch = (text, selectedBookId) => {
  if (!text || text.trim().length < 1) return null;

  const trimmed = text.trim();
  const pattern1 = /^(.+?)\s+(\d+)(?:\s+([\d\-,]+))?$/;
  const match1 = trimmed.match(pattern1);

  if (match1) {
    const matchedBook = matchBibleBook(match1[1]);
    if (matchedBook) {
      return {
        type: 'quick',
        bookId: matchedBook.id,
        chapter: parseInt(match1[2], 10),
        verses: parseVerseList(match1[3]),
      };
    }
  }

  const pattern2 = /^([^\d]+?)(\d+)(?::([\d\-,]+))?$/;
  const match2 = trimmed.match(pattern2);

  if (match2) {
    const matchedBook = matchBibleBook(match2[1]);
    if (matchedBook) {
      return {
        type: 'quick',
        bookId: matchedBook.id,
        chapter: parseInt(match2[2], 10),
        verses: parseVerseList(match2[3]),
      };
    }
  }

  const pattern3 = /^(\d+)(?:\s+([\d\-,]+))?$/;
  const match3 = trimmed.match(pattern3);
  if (match3 && selectedBookId) {
    return {
      type: 'chapter-only',
      chapter: parseInt(match3[1], 10),
      verses: parseVerseList(match3[2]),
    };
  }

  return null;
};

// ===== 去除HTML标签函数 =====
const stripHtmlTags = (text) => {
  if (!text) return text;
  return text.replace(/<[^>]*>/g, '');
};

const createBibleSlides = (book, chapter, verses, bibleVersion) => {
  if (!verses || verses.length === 0) return [];

  const slides = [];

  // 根据圣经版本使用不同限制
  const isEnglish = bibleVersion === 'kjv' || bibleVersion === 'niv';
  const MAX_CHARS_PER_SLIDE = isEnglish ? 300 : 230;
  const MAX_VERSES_PER_SLIDE = isEnglish ? 5 : 4;

  const firstVerse = verses[0];
  const lastVerse = verses[verses.length - 1];
  let refHeader = '';
  if (verses.length === 1) {
    refHeader = firstVerse.ref;
  } else {
    refHeader = `${book}${chapter}:${firstVerse.verse}-${lastVerse.verse}`;
  }

  let currentSlideVerses = [];
  let currentLength = 0;

  currentSlideVerses.push(refHeader);
  currentLength = refHeader.length;

  verses.forEach((verse) => {
    const verseText = `${verse.verse}. ${stripHtmlTags(verse.content)}`;
    const verseLength = verseText.length;
    const additionalLength = currentSlideVerses.length > 0 ? 2 : 0;
    const wouldExceedLength = currentLength + verseLength + additionalLength > MAX_CHARS_PER_SLIDE;
    const wouldExceedVerses = currentSlideVerses.length >= MAX_VERSES_PER_SLIDE + 1;

    if ((wouldExceedLength || wouldExceedVerses) && currentSlideVerses.length > 0) {
      slides.push(currentSlideVerses.join('\n'));
      currentSlideVerses = [refHeader, verseText];
      currentLength = refHeader.length + 2 + verseLength;
    } else {
      currentSlideVerses.push(verseText);
      currentLength += verseLength + additionalLength;
    }
  });

  if (currentSlideVerses.length > 0) {
    slides.push(currentSlideVerses.join('\n'));
  }

  return slides;
};

const hasMixedSlides = (project) => {
  if (!project?.slides?.length) return false;
  if (!project.fileType || !project.filePath) return false;
  const projectName = project.name || project.title;
  return project.slides.length > 1 || project.slides[0] !== projectName;
};

const isMediaOnlyProject = (project) => {
  if (!project?.fileType || !project?.filePath) return false;
  return !hasMixedSlides(project);
};

const isMediaSlide = (project, slide, index) => {
  if (!project?.fileType || !project?.filePath) return false;
  // First slide is always the media slide if media exists
  if (index === 0) return true;
  // Also check if slide content matches the project name/title (original filename)
  const projectName = project.name || project.title;
  return slide === projectName;
};

const buildSelectedSong = (project) => ({
  id: project.id,
  title: project.name || project.title,
  slides: project.slides || [],
  filePath: project.filePath,
  fileType: project.fileType,
  type: project.type,
  backgroundId: project.backgroundId,
  verses: project.verses,
  createdAt: project.createdAt,
});

function FullLayout() {
  // ===== 倒计时/工具状态 (放在最前面避免初始化错误) =====
  const [countdownMinutes, setCountdownMinutes] = useState(5);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [countdownDisplay, setCountdownDisplay] = useState('05:00');
  const [isCountdownRunning, setIsCountdownRunning] = useState(false);
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [countdownInterval, setCountdownInterval] = useState(null);
  const [isCountdownShowing, setIsCountdownShowing] = useState(false);
  const [isClockShowing, setIsClockShowing] = useState(false);
  const [isNotificationShowing, setIsNotificationShowing] = useState(false);
  const [activeTool, setActiveTool] = useState('notification'); // 'notification' | 'countdown' | 'clock'

  // ===== 导航状态 =====
  const [currentNav, setCurrentNav] = useState('project'); // project | songs | files | backgrounds | notifications

  // ===== 全局状态 =====
  const [songs, setSongs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isProjectionActive, setIsProjectionActive] = useState(false);
  const [displays, setDisplays] = useState([]);
  const [selectedDisplayId, setSelectedDisplayId] = useState(null);
  const [currentThemeId, setCurrentThemeId] = useState('classic-black');
  const [currentBackgroundId, setCurrentBackgroundId] = useState('none');
  const [showCustomTheme, setShowCustomTheme] = useState(false);
  const [customTextColor, setCustomTextColor] = useState('#ffffff');
  const [customBgColor, setCustomBgColor] = useState('#000000');
  const [customFontSize, setCustomFontSize] = useState(72);
  const [customLineHeight, setCustomLineHeight] = useState(1.4);
  const [customTextAlign, setCustomTextAlign] = useState('left');
  const [customFontFamily, setCustomFontFamily] = useState('Noto Sans SC, sans-serif');
  const [customLetterSpacing, setCustomLetterSpacing] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  const [deletedDefaultBackgroundIds, setDeletedDefaultBackgroundIds] = useState([]);
  const [datapackModalOpen, setDatapackModalOpen] = useState(false);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);

  // ===== 圣经状态 =====
  const [bibleSearchText, setBibleSearchText] = useState('');
  const [bibleView, setBibleView] = useState('books'); // books | chapters | verses | keyword
  const [uiLanguage, setUiLanguage] = useState(() => localStorage.getItem('uiLanguage') || 'zh-Hans');
  const [bibleVersion, setBibleVersion] = useState(() => {
    const stored = localStorage.getItem('bibleVersion');
    if (stored && bibleVersionMap[stored]) return stored;
    // 默认第一个可用版本
    const available = Object.keys(bibleVersionMap);
    return available.length > 0 ? available[0] : 'cuv-s';
  });
  const [selectedBookId, setSelectedBookId] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedVerses, setSelectedVerses] = useState([]);
  const [selectMode, setSelectMode] = useState('single'); // single | range | multi
  const [lastClickedVerse, setLastClickedVerse] = useState(null);
  const [hasNavigatedToVerses, setHasNavigatedToVerses] = useState(false);
  const [keywordSearchResults, setKeywordSearchResults] = useState([]);

  const t = uiCopy[uiLanguage] || uiCopy['zh-Hans'];
  const currentBibleVerses = useMemo(() => bibleVersionMap[bibleVersion] || Object.values(bibleVersionMap)[0] || [], [bibleVersion]);
  const selectedBook = selectedBookId ? getBookLabel(selectedBookId, uiLanguage) : null;
  const isMediaOnlySelectedSong = useMemo(() => isMediaOnlyProject(selectedSong), [selectedSong]);
  const isCurrentSlideMedia = useMemo(() => {
    if (!selectedSong) return false;
    return isMediaSlide(selectedSong, selectedSong.slides[currentSlideIndex], currentSlideIndex);
  }, [selectedSong, currentSlideIndex]);

  // 分享对话框翻译
  const shareDialogCopy = {
    refresh: uiLanguage === 'en' ? '🔄 Refresh window / screen list' : uiLanguage === 'zh-Hant' ? '🔄 刷新視窗／螢幕列表' : '🔄 刷新获取窗口/屏幕列表',
    stop: uiLanguage === 'en' ? 'Stop sharing' : uiLanguage === 'zh-Hant' ? '停止分享' : '停止分享',
    close: uiLanguage === 'en' ? 'Close' : uiLanguage === 'zh-Hant' ? '關閉' : '关闭',
  };

  // ===== 第四栏展示状态 =====
  const [displayTab, setDisplayTab] = useState('live'); // live | next | share
  const [isProjectionLocked, setIsProjectionLocked] = useState(false);
  const [lockedSlideIndex, setLockedSlideIndex] = useState(0);

  // ===== 投屏分享状态 =====
  const [availableSources, setAvailableSources] = useState([]);
  const [currentSharingId, setCurrentSharingId] = useState(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [inputDialogConfig, setInputDialogConfig] = useState({ title: '', message: '', defaultValue: '', onConfirm: null });
  const [inputDialogValue, setInputDialogValue] = useState('');
  const [favoriteSourceIds, setFavoriteSourceIds] = useState(() => {
    const saved = localStorage.getItem('favoriteSourceIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedSourceId, setSelectedSourceId] = useState(null); // 选中的投屏源

  const isInitializedRef = useRef(false);

  // ===== 当前主题/背景 =====
  const currentTheme = useMemo(() => {
    if (currentThemeId === 'custom') {
      return {
        id: 'custom',
        name: '自定义',
        backgroundColor: customBgColor,
        textColor: customTextColor,
        fontFamily: customFontFamily,
        fontSize: customFontSize,
        lineHeight: customLineHeight,
        textAlign: customTextAlign,
        letterSpacing: customLetterSpacing,
      };
    }
    return themes.find(t => t.id === currentThemeId) || themes[0];
  }, [currentThemeId, customBgColor, customTextColor, customFontFamily, customFontSize, customLineHeight, customTextAlign, customLetterSpacing]);

  const allBackgrounds = [
    ...defaultBackgrounds.filter(bg => !deletedDefaultBackgroundIds.includes(bg.id)),
    ...customBackgrounds
  ];
  const currentBackground = useMemo(
    () => allBackgrounds.find(b => b.id === currentBackgroundId) || allBackgrounds[0],
    [currentBackgroundId, allBackgrounds]
  );

  // ===== 项目搜索 =====
  const [projectSearchText, setProjectSearchText] = useState('');

  // ===== 快捷搜索结果 =====
  const quickSearchResult = useMemo(() => {
    return parseQuickSearch(bibleSearchText, selectedBookId);
  }, [bibleSearchText, selectedBookId]);

  // ===== 圣经过滤 =====
  const filteredBibleBooks = useMemo(() => {
    if (!bibleSearchText.trim()) return bibleBooks;
    if (quickSearchResult && quickSearchResult.type === 'quick') return bibleBooks;

    const searchLower = bibleSearchText.toLowerCase();
    return bibleBooks.filter(book => {
      const fullName = getBookLabel(book.id, uiLanguage).toLowerCase();
      const shortName = getBookLabel(book.id, uiLanguage, true).toLowerCase();
      if (fullName.includes(searchLower) || shortName.includes(searchLower)) return true;
      return (book.aliases || []).some(alias => alias.toLowerCase().includes(searchLower) || alias.toLowerCase().startsWith(searchLower));
    });
  }, [bibleSearchText, quickSearchResult, uiLanguage]);

  // ===== 创建圣经项目（从指定数据） =====
  const createBibleProjectFromData = (bookId, chapter, verses) => {
    const book = getBookLabel(bookId, uiLanguage);
    if (!verses || verses.length === 0) return;

    const slides = createBibleSlides(book, chapter, verses, bibleVersion);

    const newProject = {
      id: `project_bible_${Date.now()}`,
      type: PROJECT_TYPES.BIBLE,
      name: `${book} ${chapter}${t.verseSuffix || ''}`.trim(),
      slides: slides,
      verses: verses,
      createdAt: Date.now(),
    };

    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
    setSelectedSong(buildSelectedSong(newProject));
    setCurrentSlideIndex(0);
    setSelectedVerses([]);
    setBibleView('books');
    setSelectedBookId(null);
    setSelectedChapter(null);
    setCurrentNav('project');
    setHasNavigatedToVerses(false);
    setKeywordSearchResults([]);
  };

  // ===== 处理快捷搜索跳转 =====
  const handleQuickSearch = () => {
    if (!quickSearchResult) {
      // 没有快捷搜索结果，检查是否是关键词搜索
      if (bibleSearchText.trim().length >= 2) {
        // 关键词搜索
        const results = currentBibleVerses.filter(v =>
          v.content && v.content.includes(bibleSearchText.trim())
        ).slice(0, 50); // 最多显示50条结果
        setKeywordSearchResults(results);
        setBibleView('keyword');
      }
      return;
    }

    // 如果已经导航到经文且有选中的经文，第二次回车直接加入编辑栏
    if (hasNavigatedToVerses && selectedVerses.length > 0) {
      const bookToUse = quickSearchResult.type === 'quick' ? quickSearchResult.bookId : selectedBookId;
      const chapterToUse = quickSearchResult.chapter;
      createBibleProjectFromData(bookToUse, chapterToUse, selectedVerses);
      return;
    }

    if (quickSearchResult.type === 'chapter-only' && selectedBookId) {
      // 已选书卷后的章节+节搜索
      const { chapter, verses } = quickSearchResult;
      setSelectedChapter(chapter);
      setBibleView('verses');
      setHasNavigatedToVerses(true);

      // 如果指定了节，自动选择这些节
      if (verses.length > 0) {
        setTimeout(() => {
          const bookVerses = currentBibleVerses.filter(v =>
            v.bookId === selectedBookId && v.chapter === chapter
          );
          const selected = bookVerses.filter(v => verses.includes(v.verse));
          if (selected.length > 0) {
            setSelectedVerses(selected);
            setSelectMode('multi');
          }
        }, 100);
      }
    } else if (quickSearchResult.type === 'quick') {
      // 完整快捷搜索（书卷+章节+节）
      const { bookId, chapter, verses } = quickSearchResult;
      setSelectedBookId(bookId);
      setSelectedChapter(chapter);
      setBibleView('verses');
      setHasNavigatedToVerses(true);

      // 如果指定了节，自动选择这些节
      if (verses.length > 0) {
        setTimeout(() => {
          const bookVerses = currentBibleVerses.filter(v =>
            v.bookId === bookId && v.chapter === chapter
          );
          const selected = bookVerses.filter(v => verses.includes(v.verse));
          if (selected.length > 0) {
            setSelectedVerses(selected);
            setSelectMode('multi');
          }
        }, 100);
      }
    }
  };

  // ===== 获取当前书卷的章节 =====
  const currentBookChapters = useMemo(() => {
    if (!selectedBook) return [];
    const book = bibleBooks.find(b => b.id === selectedBookId);
    if (!book) return [];
    return Array.from({ length: book.chapters }, (_, i) => i + 1);
  }, [selectedBookId]);

  // ===== 获取当前章节的经文 =====
  const currentChapterVerses = useMemo(() => {
    if (!selectedBookId || !selectedChapter) return [];
    return currentBibleVerses.filter(v =>
      v.bookId === selectedBookId && v.chapter === selectedChapter
    );
  }, [selectedBookId, selectedChapter, currentBibleVerses]);

  // ===== 投影更新 =====
  const updateProjection = () => {
    if (!selectedProject && !selectedSong) return;
    const songToUse = selectedSong || (selectedProject?.type === PROJECT_TYPES.SONG ? selectedProject : null);
    if (!songToUse) return;

    const slideToShow = isProjectionLocked ? lockedSlideIndex : currentSlideIndex;

    electronAPI.updateLyrics({
      song: songToUse,
      slideIndex: slideToShow,
      theme: currentTheme,
      background: currentBackground
    });
  };

  // ===== 实时同步 =====
  const syncToProjection = () => {
    if (!selectedProject && !selectedSong) {
      alert(uiLanguage === 'en' ? 'Please select content first' : uiLanguage === 'zh-Hant' ? '請先選擇內容' : '请先选择内容');
      return;
    }

    if (!isProjectionActive) {
      electronAPI.startProjection(selectedDisplayId);
      setIsProjectionActive(true);
      setLockedSlideIndex(currentSlideIndex);
      // 立即投影当前内容
      const songToUse = selectedSong || (selectedProject?.type === PROJECT_TYPES.SONG ? selectedProject : null);
      if (songToUse) {
        setTimeout(() => {
          electronAPI.updateLyrics({
            song: songToUse,
            slideIndex: currentSlideIndex,
            theme: currentTheme,
            background: currentBackground
          });
        }, 300);
      }
      // 让主窗口重新获得焦点，确保键盘快捷键可以立即使用
      setTimeout(() => {
        window.focus();
      }, 400);
    } else {
      // 锁定或未锁定状态都可以点击实时同步来切换内容
      setLockedSlideIndex(currentSlideIndex);
      updateProjection();
    }
  };

  // ===== 创建圣经项目 =====
  const createBibleProject = () => {
    if (selectedVerses.length === 0) {
      alert(uiLanguage === 'en' ? 'Please select verses first' : uiLanguage === 'zh-Hant' ? '請先選擇經文' : '请先选择经文');
      return;
    }

    const slides = createBibleSlides(getBookLabel(selectedBookId, uiLanguage), selectedChapter, selectedVerses);

    const newProject = {
      id: `project_bible_${Date.now()}`,
      type: PROJECT_TYPES.BIBLE,
      name: `${getBookLabel(selectedBookId, uiLanguage)} ${selectedChapter}${t.verseSuffix || ''}`.trim(),
      slides: slides,
      verses: selectedVerses,
      createdAt: Date.now(),
    };

    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
    setSelectedSong(buildSelectedSong(newProject));
    setCurrentSlideIndex(0);
    setSelectedVerses([]);
    setBibleView('books');
    setSelectedBookId(null);
    setSelectedChapter(null);
    setCurrentNav('project');
  };

  // ===== 新建项目 =====
  const createNewProject = () => {
    const newProject = {
      id: `project_custom_${Date.now()}`,
      type: PROJECT_TYPES.CUSTOM,
      name: '新项目',
      slides: [''],
      createdAt: Date.now(),
    };
    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
    setSelectedSong(buildSelectedSong(newProject));
    setCurrentSlideIndex(0);
  };

  // ===== 选择项目 =====
  const selectProject = (project) => {
    setSelectedProject(project);
    setSelectedSong(buildSelectedSong(project));
    setCurrentSlideIndex(0);
    setCurrentSharingId(null);
    if (project.backgroundId) {
      setCurrentBackgroundId(project.backgroundId);
    }
  };

  // ===== 选择幻灯片 =====
  const selectSlide = (index) => {
    if (currentSlideIndex === index) return;

    setCurrentSlideIndex(index);
    if (isProjectionActive && !isProjectionLocked && !currentSharingId) {
      // 未锁定且不在分享状态，立即更新投影
      setLockedSlideIndex(index);
      const songToUse = selectedSong || (selectedProject?.type === PROJECT_TYPES.SONG ? selectedProject : null);
      if (songToUse) {
        electronAPI.updateLyrics({
          song: songToUse,
          slideIndex: index,
          theme: currentTheme,
          background: currentBackground
        });
      }
    }
  };

  // ===== 编辑幻灯片 =====
  const editSlide = (index, newContent) => {
    if (!selectedSong) return;
    const newSlides = [...selectedSong.slides];
    newSlides[index] = stripHtmlTags(newContent);
    setSelectedSong({ ...selectedSong, slides: newSlides });
    if (selectedProject) {
      setSelectedProject({ ...selectedProject, slides: newSlides });
    }
    if (!isProjectionLocked && isProjectionActive && currentSlideIndex === index) {
      updateProjection();
    }
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

    const projectsStored = localStorage.getItem('jiayan_projects');
    if (projectsStored) {
      try {
        setProjects(JSON.parse(projectsStored));
      } catch (e) {}
    }

    // 加载自定义背景
    const backgroundsStored = localStorage.getItem('jiayan_custom_backgrounds');
    if (backgroundsStored) {
      try {
        setCustomBackgrounds(JSON.parse(backgroundsStored));
      } catch (e) {}
    }

    // 加载已删除的默认背景ID
    const deletedBgStored = localStorage.getItem('jiayan_deleted_default_backgrounds');
    if (deletedBgStored) {
      try {
        setDeletedDefaultBackgroundIds(JSON.parse(deletedBgStored));
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

    // 全局点击监听：点击任何地方关闭所有右键菜单
    const handleGlobalClick = () => {
      closeRightClickMenu();
    };
    document.addEventListener('click', handleGlobalClick);

    return () => {
      offClosed();
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('jiayan_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('jiayan_custom_backgrounds', JSON.stringify(customBackgrounds));
  }, [customBackgrounds]);

  useEffect(() => {
    localStorage.setItem('jiayan_deleted_default_backgrounds', JSON.stringify(deletedDefaultBackgroundIds));
  }, [deletedDefaultBackgroundIds]);

  const getDisplaySlideIndex = () => {
    return isProjectionLocked ? lockedSlideIndex : currentSlideIndex;
  };

  // ===== 圣经节范围选择（支持Shift键多选和点击1和7选择1-7）
  const toggleVerseSelection = (verse, e) => {
    if (e && e.shiftKey && lastClickedVerse && selectedVerses.length > 0) {
      // Shift+点击：范围选择
      const allVerses = currentChapterVerses;
      const firstIndex = allVerses.findIndex(v => v.verse === lastClickedVerse.verse);
      const secondIndex = allVerses.findIndex(v => v.verse === verse.verse);

      const startIndex = Math.min(firstIndex, secondIndex);
      const endIndex = Math.max(firstIndex, secondIndex);

      const rangeVerses = allVerses.slice(startIndex, endIndex + 1);
      setSelectedVerses(rangeVerses);
      setSelectMode('range');
    } else if (selectedVerses.length === 1 && !e.shiftKey) {
      // 已有一个选择，再点击另一个，选择范围（点击1和7选择1-7）
      const firstVerse = selectedVerses[0];
      const allVerses = currentChapterVerses;
      const firstIndex = allVerses.findIndex(v => v.verse === firstVerse.verse);
      const secondIndex = allVerses.findIndex(v => v.verse === verse.verse);

      const startIndex = Math.min(firstIndex, secondIndex);
      const endIndex = Math.max(firstIndex, secondIndex);

      const rangeVerses = allVerses.slice(startIndex, endIndex + 1);
      setSelectedVerses(rangeVerses);
      setSelectMode('range');
    } else {
      // 没有选择或已有范围选择后，重新开始
      setSelectedVerses([verse]);
      setLastClickedVerse(verse);
      setSelectMode('single');
    }
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

  // 切换投屏源选择（最多3个）
  const toggleSourceSelection = (sourceId) => {
    if (sourceId === 'permission-needed' || sourceId === 'error') {
      return;
    }

    if (selectedSourceId === sourceId) {
      // 取消选择
      setSelectedSourceId(null);
    } else {
      // 选择新的源
      setSelectedSourceId(sourceId);
    }
  };

  // 开始应用分享
  const startAppSharing = () => {
    if (!isProjectionActive) {
      alert(uiLanguage === 'en' ? 'Please start projection first' : uiLanguage === 'zh-Hant' ? '請先點擊「開始投屏」' : '请先点击“开始投影”');
      return;
    }
    if (!selectedSourceId) {
      alert(uiLanguage === 'en' ? 'Please choose a share source first' : uiLanguage === 'zh-Hant' ? '請先選擇投屏源' : '请先选择投屏源');
      return;
    }
    // 使用选中的源开始分享
    setCurrentSharingId(selectedSourceId);
    electronAPI.shareSource(selectedSourceId);
  };

  // 停止应用分享
  const stopShareAndRestore = async () => {
    electronAPI.stopShare();
    setCurrentSharingId(null);

    // 停止分享后，如果有选中的内容就显示内容，否则显示默认背景
    if (selectedSong) {
      // 有选中内容，显示该内容
      const songToUse = selectedSong || (selectedProject?.type === PROJECT_TYPES.SONG ? selectedProject : null);
      if (songToUse) {
        electronAPI.updateLyrics({
          song: songToUse,
          slideIndex: isProjectionLocked ? lockedSlideIndex : currentSlideIndex,
          theme: currentTheme,
          background: currentBackground
        });
      }
    } else {
      // 没有选中内容，显示默认背景（黑色背景）
      electronAPI.updateLyrics({
        song: { title: '默认背景', slides: [''] },
        slideIndex: 0,
        theme: { ...currentTheme, backgroundColor: '#323341' },
        background: null
      });
    }
  };

  // ===== 渲染导航栏 =====
  const renderNav = () => (
    <nav className="top-nav-full">
      <div className="nav-brand-full" style={{ display: 'flex', gap: '8px' }}><button
          className="status help-status-btn"
          onClick={() => setUiLanguage((current) => current === 'zh-Hans' ? 'en' : current === 'en' ? 'zh-Hant' : 'zh-Hans')}
          title={uiLanguage === 'zh-Hans' ? 'Switch to English' : uiLanguage === 'en' ? '切換到繁體中文' : '切换到简体中文'}
        >
          {t.languageLabel}
        </button>
        <button
          className="status help-status-btn"
          onClick={() => setShowHelpDialog(true)}
          title={t.help}
        >
          {t.help}
        </button>
        <button
          className="status help-status-btn"
          onClick={() => setDatapackModalOpen(true)}
          title="📦 数据包"
          style={{ marginLeft: 4 }}
        >
          📦
        </button></div>
      <div className="nav-items-full">
        <button
          className={currentNav === 'project' ? 'active' : ''}
          onClick={() => setCurrentNav('project')}
        >
          {t.nav.project}
        </button>
        <button
          className={currentNav === 'songs' ? 'active' : ''}
          onClick={() => setCurrentNav('songs')}
        >
          {t.nav.songs}
        </button>
        <button
          className={currentNav === 'files' ? 'active' : ''}
          onClick={() => setCurrentNav('files')}
        >
          {t.nav.files}
        </button>
        <button
          className={currentNav === 'backgrounds' ? 'active' : ''}
          onClick={() => setCurrentNav('backgrounds')}
        >
          {t.nav.backgrounds}
        </button>
        <button
          className={currentNav === 'notifications' ? 'active' : ''}
          onClick={() => setCurrentNav('notifications')}
        >
          {t.nav.notifications}
        </button>
      </div>
      <div className="nav-status-full">
        {isProjectionActive ? (
          <span className="status active">{uiLanguage === 'en' ? 'LIVE' : uiLanguage === 'zh-Hant' ? '投影中' : '投影中'}</span>
        ) : (
          <span className="status inactive">{uiLanguage === 'en' ? 'OFF' : uiLanguage === 'zh-Hant' ? '未投影' : '未投影'}</span>
        )}
      </div>
    </nav>
  );

  // ===== 右键菜单处理 =====
  const handleProjectRightClick = (e, project) => {
    e.preventDefault();
    e.stopPropagation();
    setRightClickMenu({
      x: e.clientX,
      y: e.clientY,
      projectId: project.id
    });
  };

  const closeRightClickMenu = () => {
    setRightClickMenu(null);
    setBgRightClickMenu(null);
    setSongRightClickMenu(null);
    setFileRightClickMenu(null);
    setSlideRightClickMenu(null);
  };

  const deleteProject = (projectId) => {
    if (confirm(uiLanguage === 'en' ? 'Delete this project?' : uiLanguage === 'zh-Hant' ? '確定要刪除這個項目嗎？' : '确定要删除这个项目吗？')) {
      setProjects(projects.filter(p => p.id !== projectId));
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setSelectedSong(null);
      }
    }
    closeRightClickMenu();
  };

  const showInputPrompt = (title, message, defaultValue, onConfirm) => {
    setInputDialogConfig({ title, message, defaultValue, onConfirm });
    setInputDialogValue(defaultValue);
    setShowInputDialog(true);
  };

  const editProjectNote = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    showInputPrompt(uiLanguage === 'en' ? 'Rename' : uiLanguage === 'zh-Hant' ? '重新命名' : '重命名', uiLanguage === 'en' ? 'Enter a new project name:' : uiLanguage === 'zh-Hant' ? '請輸入新的項目名稱：' : '请输入新的项目名称：', project.name, (newName) => {
      if (newName !== null && newName.trim()) {
        const updatedProjects = projects.map(p =>
          p.id === projectId
            ? { ...p, name: newName.trim() }
            : p
        );
        setProjects(updatedProjects);
        if (selectedProject?.id === projectId) {
          setSelectedProject({ ...selectedProject, name: newName.trim() });
          setSelectedSong({ ...selectedSong, title: newName.trim() });
        }
      }
    });
    closeRightClickMenu();
  };

  const clearAllProjects = () => {
    if (confirm(uiLanguage === 'en' ? 'Clear all projects? This cannot be undone.' : uiLanguage === 'zh-Hant' ? '確定要清空所有項目嗎？此操作不可恢復！' : '确定要清空所有项目吗？此操作不可恢复！')) {
      setProjects([]);
      setSelectedProject(null);
      setSelectedSong(null);
    }
  };

  const clearEditPanelWithConfirm = () => {
    if (confirm(uiLanguage === 'en' ? 'Clear the editor?' : uiLanguage === 'zh-Hant' ? '確定要清空編輯欄嗎？' : '确定要清空编辑栏吗？')) {
      setSelectedProject(null);
      setSelectedSong(null);
      setCurrentSharingId(null);
      setCurrentSlideIndex(0);
    }
  };

  // ===== 拖拽处理 =====
  const handleDragStart = (e, data, type) => {
    if (!e?.dataTransfer) return;
    const payload = JSON.stringify({ data, type });
    e.dataTransfer.clearData();
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const getDroppedPayload = (e) => {
    const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
    if (!raw) return null;
    return JSON.parse(raw);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDragOverPanel1 = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOverPanel1(true);
  };

  const handleDragLeavePanel1 = () => {
    setIsDragOverPanel1(false);
  };

  const handleDropPanel1 = (e) => {
    e.preventDefault();
    setIsDragOverPanel1(false);
    try {
      const dropped = getDroppedPayload(e);
      if (!dropped) return;
      if (dropped.type === 'bible') {
        const { book, chapter, verses } = dropped.data;
        if (!verses || verses.length === 0) return;

        const slides = createBibleSlides(book, chapter, verses, bibleVersion);

        const newProject = {
          id: `project_bible_${Date.now()}`,
          type: PROJECT_TYPES.BIBLE,
          name: `${book} ${chapter}${t.verseSuffix || ''}`.trim(),
          slides: slides,
          verses: verses,
          createdAt: Date.now(),
        };

        setProjects([newProject, ...projects]);
        setSelectedProject(newProject);
        setSelectedSong(buildSelectedSong(newProject));
        setCurrentSlideIndex(0);
        setSelectedVerses([]);
        setCurrentNav('project');
      } else if (dropped.type === 'song') {
        const song = dropped.data;
        const newProject = {
          id: `project_song_${Date.now()}`,
          type: PROJECT_TYPES.SONG,
          name: song.title,
          slides: song.slides,
          createdAt: Date.now(),
        };

        setProjects([newProject, ...projects]);
        setSelectedProject(newProject);
        setSelectedSong(buildSelectedSong(newProject));
        setCurrentSlideIndex(0);
        setCurrentNav('project');
      } else if (dropped.type === 'file') {
        const file = dropped.data;
        const newProject = {
          id: `project_file_${Date.now()}`,
          type: file.type === FILE_TYPES.VIDEO ? PROJECT_TYPES.VIDEO :
                file.type === FILE_TYPES.AUDIO ? PROJECT_TYPES.AUDIO :
                file.type === FILE_TYPES.IMAGE ? PROJECT_TYPES.IMAGE :
                file.type === FILE_TYPES.PPT ? PROJECT_TYPES.PPT :
                PROJECT_TYPES.CUSTOM,
          name: file.name,
          filePath: file.path,
          fileType: file.type,
          slides: [file.name],
          createdAt: Date.now(),
        };

        setProjects([newProject, ...projects]);
        setSelectedProject(newProject);
        setSelectedSong(buildSelectedSong(newProject));
        setCurrentSlideIndex(0);
        setCurrentNav('project');
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const dropped = getDroppedPayload(e);
      if (!dropped) return;
      if (dropped.type === 'project') {
        if (selectedProject && selectedSong) {
          const updatedSlides = [...selectedSong.slides, ...dropped.data.slides];
          const updatedProject = {
            ...selectedProject,
            slides: updatedSlides,
            // Keep filePath/fileType if they exist (for mixed content)
          };
          setSelectedSong(buildSelectedSong(updatedProject));
          setSelectedProject(updatedProject);
          setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
        } else {
          selectProject(dropped.data);
        }
      } else if (dropped.type === 'bible') {
        const { book, chapter, verses } = dropped.data;
        if (!verses || verses.length === 0) return;

        const newSlides = createBibleSlides(book, chapter, verses);

        if (selectedProject && selectedSong) {
          const updatedSlides = [...selectedSong.slides, ...newSlides];
          const updatedProject = {
            ...selectedProject,
            slides: updatedSlides,
            // Keep filePath/fileType if they exist (for mixed content)
          };
          setSelectedSong(buildSelectedSong(updatedProject));
          setSelectedProject(updatedProject);
          setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
        } else {
          const newProject = {
            id: `project_bible_${Date.now()}`,
            type: PROJECT_TYPES.BIBLE,
            name: `${book} ${chapter}${t.verseSuffix || ''}`.trim(),
            slides: newSlides,
            verses: verses,
            createdAt: Date.now(),
          };
          setProjects([newProject, ...projects]);
          setSelectedProject(newProject);
          setSelectedSong(buildSelectedSong(newProject));
          setCurrentSlideIndex(0);
          setSelectedVerses([]);
        }
      } else if (dropped.type === 'song') {
        const song = dropped.data;
        if (selectedProject && selectedSong) {
          const updatedSlides = [...selectedSong.slides, ...song.slides];
          const updatedProject = {
            ...selectedProject,
            slides: updatedSlides,
            // Keep filePath/fileType if they exist (for mixed content)
          };
          setSelectedSong(buildSelectedSong(updatedProject));
          setSelectedProject(updatedProject);
          setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
        } else {
          const newProject = {
            id: `project_song_${Date.now()}`,
            type: PROJECT_TYPES.SONG,
            name: song.title,
            slides: song.slides,
            createdAt: Date.now(),
          };
          setProjects([newProject, ...projects]);
          setSelectedProject(newProject);
          setSelectedSong(buildSelectedSong(newProject));
          setCurrentSlideIndex(0);
        }
      } else if (dropped.type === 'file') {
        const file = dropped.data;
        const newProject = {
          id: `project_file_${Date.now()}`,
          type: file.type === FILE_TYPES.VIDEO ? PROJECT_TYPES.VIDEO :
                file.type === FILE_TYPES.AUDIO ? PROJECT_TYPES.AUDIO :
                file.type === FILE_TYPES.IMAGE ? PROJECT_TYPES.IMAGE :
                file.type === FILE_TYPES.PPT ? PROJECT_TYPES.PPT :
                PROJECT_TYPES.CUSTOM,
          name: file.name,
          filePath: file.path,
          fileType: file.type,
          slides: [file.name],
          createdAt: Date.now(),
        };
        setProjects([newProject, ...projects]);
        setSelectedProject(newProject);
        setSelectedSong(buildSelectedSong(newProject));
        setCurrentSlideIndex(0);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const createBibleProjectFromDrop = (data) => {
    const { book, chapter, verses } = data;
    if (!verses || verses.length === 0) return;

    const slides = createBibleSlides(book, chapter, verses, bibleVersion);

    const newProject = {
      id: `project_bible_${Date.now()}`,
      type: PROJECT_TYPES.BIBLE,
      name: `${book} ${chapter}${t.verseSuffix || ''}`.trim(),
      slides: slides,
      verses: verses,
      createdAt: Date.now(),
    };

    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
    setSelectedSong(buildSelectedSong(newProject));
    setCurrentSlideIndex(0);
    setSelectedVerses([]);
    setBibleView('books');
    setSelectedBookId(null);
    setSelectedChapter(null);
  };

  // ===== 渲染第一栏：项目栏 =====
  const renderProjectPanel = () => (
    <div className="panel panel-1">
      <div className="panel-header">
        <h3>{t.projectTitle}</h3>
        <input
          type="text"
          placeholder={t.projectSearchPlaceholder}
          value={projectSearchText}
          onChange={(e) => setProjectSearchText(e.target.value)}
          className="panel-search"
        />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn primary new-project-btn" onClick={createNewProject} style={{ flex: 1, minHeight: '32px' }}>
            {t.newProject}
          </button>
          {projects.length > 0 && (
            <button className="btn danger" onClick={clearAllProjects} style={{ flex: 1, minHeight: '32px' }} title={t.clearProjects}>
              {t.clearProjects}
            </button>
          )}
        </div>
      </div>
      <div
        className={`panel-content drop-zone-panel1 ${isDragOverPanel1 ? 'drag-over' : ''}`}
        onDragOver={handleDragOverPanel1}
        onDragLeave={handleDragLeavePanel1}
        onDrop={handleDropPanel1}
        onClick={closeRightClickMenu}
      >
        <div className="project-list">
          {projects.length === 0 ? (
            <div className="empty">{t.noProjects}<br/><span style={{fontSize:'12px',color:'#666666'}}>{t.dropHint}</span></div>
          ) : (
            projects.map(project => (
              <div
                key={project.id}
                className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
                onClick={() => selectProject(project)}
                onContextMenu={(e) => handleProjectRightClick(e, project)}
                draggable
                onDragStart={(e) => handleDragStart(e, project, 'project')}
              >
                <span className="project-type-icon" style={{ fontSize: '12px', color: '#666666' }}>
                  {project.type === PROJECT_TYPES.SONG && '「乐」'}
                  {project.type === PROJECT_TYPES.BIBLE && '「经」'}
                  {project.type === PROJECT_TYPES.PPT && '「表」'}
                  {project.type === PROJECT_TYPES.VIDEO && '「影」'}
                  {project.type === PROJECT_TYPES.AUDIO && '「音」'}
                  {project.type === PROJECT_TYPES.IMAGE && '「图」'}
                  {project.type === PROJECT_TYPES.CUSTOM && '「记」'}
                </span>
                <span className="project-name">
                  {project.name}
                  {projectNotes[project.id] && (
                    <span style={{ fontSize: '10px', color: '#999', marginLeft: '4px' }}>[记]</span>
                  )}
                </span>
                <span className="project-count">{project.slides?.length || 0}页</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // ===== 渲染第二栏：圣经 =====
  const renderBiblePanel = () => (
    <div className="panel panel-2">
      <div className="panel-header">
        <h3>{t.bibleTitle}</h3>
        <div className="bible-controls">
          <select
            className="panel-search bible-select"
            value={bibleVersion}
            onChange={(e) => setBibleVersion(e.target.value)}
          >
            {bibleVersions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.label[uiLanguage] || version.label['zh-Hans']}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          placeholder={selectedBookId ? t.chapterPlaceholder : t.keywordPlaceholder}
          value={bibleSearchText}
          onChange={(e) => setBibleSearchText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleQuickSearch();
            }
          }}
          className="panel-search"
        />
        {quickSearchResult && (
          <button
            className="btn primary quick-search-btn"
            onClick={handleQuickSearch}
          >
            → {quickSearchResult.type === 'chapter-only' ? `${quickSearchResult.chapter}${t.verseSuffix}` : `${getBookLabel(quickSearchResult.bookId, uiLanguage)} ${quickSearchResult.chapter}${t.verseSuffix}`}
            {quickSearchResult.verses.length > 0 && ` :${quickSearchResult.verses.join(',')}`}
          </button>
        )}
      </div>
      <div className="panel-content">
        {bibleView === 'books' && !quickSearchResult && (
          <div className="bible-books-grid">
            <div className="testament-section">
              <h4>{t.oldTestament}</h4>
              <div className="book-grid">
                {filteredBibleBooks.filter(b => b.testament === 'old').map(book => (
                  <div
                    key={book.id}
                    className={`book-card ${selectedBookId === book.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setBibleView('chapters');
                      setBibleSearchText('');
                    }}
                    title={getBookLabel(book.id, uiLanguage)}
                  >
                    {getBookLabel(book.id, uiLanguage, true)}
                  </div>
                ))}
              </div>
            </div>
            <div className="testament-section">
              <h4>{t.newTestament}</h4>
              <div className="book-grid">
                {filteredBibleBooks.filter(b => b.testament === 'new').map(book => (
                  <div
                    key={book.id}
                    className={`book-card ${selectedBookId === book.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedBookId(book.id);
                      setBibleView('chapters');
                      setBibleSearchText('');
                    }}
                    title={getBookLabel(book.id, uiLanguage)}
                  >
                    {getBookLabel(book.id, uiLanguage, true)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {bibleView === 'books' && quickSearchResult && quickSearchResult.type === 'quick' && (
          <div className="quick-search-result">
            <div className="quick-search-hint">
              <p>{t.quickRecognized}</p>
              <p className="quick-search-preview">
                {getBookLabel(quickSearchResult.bookId, uiLanguage)} {quickSearchResult.chapter}{t.verseSuffix}
                {quickSearchResult.verses.length > 0 && ` 第${quickSearchResult.verses.join(',')}节`}
              </p>
              <button
                className="btn primary"
                onClick={handleQuickSearch}
              >
                {t.jumpTo}
              </button>
            </div>
            <div className="search-tips">
              <h5>{t.quickExamples}</h5>
              <ul>
                <li><code>m</code> - 拼音首字母筛选（m过滤出马太福音等）</li>
                <li><code>太1:1</code> - 马太福音1章1节</li>
                <li><code>诗23</code> - 诗篇23章</li>
                <li><code>罗3:23-24</code> - 罗马书3章23-24节</li>
              </ul>
            </div>
          </div>
        )}
        {(bibleView === 'books' || bibleView === 'chapters') && quickSearchResult && quickSearchResult.type === 'chapter-only' && selectedBook && (
          <div className="quick-search-result">
            <div className="quick-search-hint">
              <p>{t.chapterRecognized}</p>
              <p className="quick-search-preview">
                {getBookLabel(selectedBookId, uiLanguage)} {quickSearchResult.chapter}{t.verseSuffix}
                {quickSearchResult.verses.length > 0 && ` 第${quickSearchResult.verses.join(',')}节`}
              </p>
              <button
                className="btn primary"
                onClick={handleQuickSearch}
              >
                {t.jumpTo}
              </button>
            </div>
            <div className="search-tips">
              <h5>{t.chapterExamples}</h5>
              <ul>
                <li><code>1</code> - 第1章</li>
                <li><code>1 1</code> - 第1章第1节</li>
                <li><code>1 2-5</code> - 第1章第2-5节</li>
              </ul>
            </div>
          </div>
        )}

        {bibleView === 'chapters' && (
          <div className="chapters-view">
            <div className="verses-header">
              <div className="panel-actions">
                <button className="btn btn-primary" onClick={() => setBibleView('books')}>
                  {t.backBooks}
                </button>
              </div>
              <h4>{getBookLabel(selectedBookId, uiLanguage)}</h4>
            </div>
            <div className="chapter-grid">
              {currentBookChapters.map(chapter => (
                <div
                  key={chapter}
                  className={`chapter-card ${selectedChapter === chapter ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedChapter(chapter);
                    setBibleView('verses');
                    setSelectedVerses([]);
                  }}
                >
                  {chapter}
                </div>
              ))}
            </div>
          </div>
        )}

        {bibleView === 'verses' && (
          <div className="verses-view">
            <div className="verses-header">
              <div className="panel-actions">
                <button className="btn btn-primary" onClick={() => setBibleView('books')}>
                  {t.backBooks}
                </button>
                <button className="btn btn-primary" onClick={() => setBibleView('chapters')}>
                  {t.backChapters}
                </button>
              </div>
              <h4>{getBookLabel(selectedBookId, uiLanguage)} {selectedChapter}{t.verseSuffix}</h4>
            </div>
            <div className="verses-grid">
              {currentChapterVerses.map(verse => (
              <div
                key={verse.ref}
                className={`verse-num-item ${selectedVerses.find(v => v.ref === verse.ref) ? 'selected' : ''}`}
                onClick={(e) => {
                  toggleVerseSelection(verse, e);
                }}
                draggable
                onDragStart={(e) => {
                  const isVerseSelected = selectedVerses.some(v => v.ref === verse.ref);
                  if (!isVerseSelected) {
                    setSelectedVerses([verse]);
                    setLastClickedVerse(verse);
                  }
                  const versesToDrag = isVerseSelected ? selectedVerses : [verse];
                  handleDragStart(e, {
                    bookId: selectedBookId,
                    book: getBookLabel(selectedBookId, uiLanguage),
                    chapter: selectedChapter,
                    verses: versesToDrag
                  }, 'bible');
                }}
              >
                {verse.verse}
              </div>
            ))}
            </div>
            <div className="verse-select-hint">
              {t.selectHint}
            </div>
          </div>
        )}

        {bibleView === 'keyword' && (
          <div className="keyword-search-view">
            <div className="keyword-search-header">
              <button className="btn back-btn" onClick={() => {
                setBibleView('books');
                setKeywordSearchResults([]);
                setHasNavigatedToVerses(false);
              }}>
                ← 返回
              </button>
              <h4>关键词搜索："{bibleSearchText}"</h4>
            </div>
            {keywordSearchResults.length === 0 ? (
              <div className="empty">未找到相关经文</div>
            ) : (
              <div className="keyword-results-list">
                {keywordSearchResults.map((verse, idx) => (
                  <div
                    key={`${verse.ref}-${idx}`}
                    className="keyword-result-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, {
                      bookId: verse.bookId,
                      book: verse.book,
                      chapter: verse.chapter,
                      verses: [verse]
                    }, 'bible')}
                  >
                    <div className="keyword-result-ref">{verse.ref}</div>
                    <div className="keyword-result-content">{stripHtmlTags(verse.content)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ===== 清空编辑栏 =====
  const clearEditPanel = () => {
    clearEditPanelWithConfirm();
  };

  // ===== 保存当前编辑到项目 =====
  const saveCurrentEdit = () => {
    if (!selectedSong || !selectedProject) return;

    const updatedProject = {
      ...selectedProject,
      name: selectedSong.title,
      slides: selectedSong.slides,
      filePath: selectedSong.filePath,
      fileType: selectedSong.fileType,
    };
    setSelectedProject(updatedProject);
    setSelectedSong(buildSelectedSong(updatedProject));
    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));

    alert(uiLanguage === 'en' ? 'Saved!' : uiLanguage === 'zh-Hant' ? '已保存！' : '已保存！');
  };

  // ===== 另存为新项目 =====
  const saveAsNewProject = () => {
    if (!selectedSong) return;

    showInputPrompt(uiLanguage === 'en' ? 'Save as new project' : uiLanguage === 'zh-Hant' ? '另存為新項目' : '另存为新项目', uiLanguage === 'en' ? 'Enter the new project name:' : uiLanguage === 'zh-Hant' ? '請輸入新項目名稱：' : '请输入新项目名称：', selectedSong.title, (name) => {
      if (!name || !name.trim()) return;

      const newProject = {
        id: `project_${Date.now()}`,
        type: selectedProject?.type || PROJECT_TYPES.CUSTOM,
        name: name.trim(),
        slides: [...selectedSong.slides],
        filePath: selectedSong.filePath,
        fileType: selectedSong.fileType,
        backgroundId: selectedProject?.backgroundId,
        verses: selectedProject?.verses,
        createdAt: Date.now(),
      };

      setProjects([newProject, ...projects]);
      setSelectedProject(newProject);
      setSelectedSong(buildSelectedSong(newProject));
      setCurrentSlideIndex(0);
    });
  };

  // ===== 渲染第三栏：编辑栏 =====
  const renderEditPanel = () => {
    const editPanelCopy = {
      convertPdfHint: uiLanguage === 'en' ? 'Convert to PDF before projecting' : uiLanguage === 'zh-Hant' ? '請先轉換為 PDF 再投影' : '请先转换为PDF再投影',
      editorPlaceholder: uiLanguage === 'en' ? 'Slide content...' : uiLanguage === 'zh-Hant' ? '幻燈片內容...' : '幻灯片内容...',
      sourceSelected: uiLanguage === 'en' ? 'Source selected' : uiLanguage === 'zh-Hant' ? '已選擇投屏源' : '已选择投屏源',
      dragHint: uiLanguage === 'en' ? 'Drag content here to edit' : uiLanguage === 'zh-Hant' ? '拖到這裡進行編輯' : '拖到这里进行编辑',
      customThemeTitle: uiLanguage === 'en' ? 'Custom theme' : uiLanguage === 'zh-Hant' ? '自訂主題' : '自定义主题',
      textColor: uiLanguage === 'en' ? 'Text' : uiLanguage === 'zh-Hant' ? '字' : '字',
      backgroundColor: uiLanguage === 'en' ? 'Bg' : uiLanguage === 'zh-Hant' ? '背' : '背',
      fontSize: uiLanguage === 'en' ? 'Size' : uiLanguage === 'zh-Hant' ? '字號' : '字号',
      lineHeight: uiLanguage === 'en' ? 'Line' : uiLanguage === 'zh-Hant' ? '行高' : '行高',
      letterSpacing: uiLanguage === 'en' ? 'Spacing' : uiLanguage === 'zh-Hant' ? '字距' : '字间距',
      alignLeft: uiLanguage === 'en' ? 'Left' : uiLanguage === 'zh-Hant' ? '左對齊' : '左对齐',
      alignCenter: uiLanguage === 'en' ? 'Center' : uiLanguage === 'zh-Hant' ? '置中' : '居中',
      alignRight: uiLanguage === 'en' ? 'Right' : uiLanguage === 'zh-Hant' ? '右對齊' : '右对齐',
    };

    return (
    <div className="panel panel-3">
      <div className="panel-header edit-panel-header-final-v2">
        <h3>{t.editTitle}</h3>

        {/* 第一行：投影选择栏 - 50%宽度 */}
        <div style={{ width: '50%' }}>
          <select
            value={selectedDisplayId || ''}
            onChange={(e) => setSelectedDisplayId(Number(e.target.value))}
            className="panel-search"
            style={{ width: '100%' }}
          >
            {displays.map(display => (
              <option key={display.id} value={display.id}>
                {display.label} {display.isPrimary ? (uiLanguage === 'en' ? '(Primary)' : uiLanguage === 'zh-Hant' ? '(主螢幕)' : '(主屏)') : (uiLanguage === 'en' ? '(Projector)' : uiLanguage === 'zh-Hant' ? '(投屏)' : '(投影)')}
              </option>
            ))}
          </select>
        </div>

        {/* 第二行：三个按钮：保存、另存为、清空 - 容器的四分之三 */}
        {(selectedSong || selectedProject) && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '75%' }}>
            <button
              className="btn primary"
              onClick={saveCurrentEdit}
              style={{ flex: 1, minHeight: '32px' }}
              disabled={!selectedProject}
            >
              {t.save}
            </button>
            <button
              className="btn"
              onClick={saveAsNewProject}
              style={{ flex: 1, minHeight: '32px' }}
            >
              {t.saveAs}
            </button>
            <button
              className="btn danger"
              onClick={clearEditPanel}
              style={{ flex: 1, minHeight: '32px' }}
            >
              {t.clearEdit}
            </button>
          </div>
        )}

        {/* 第三行：项目重命名栏 - 50%宽度 */}
        {selectedSong && (
          <div style={{ width: '50%' }}>
            <input
              type="text"
              className="panel-search"
              value={selectedSong.title}
              onChange={(e) => {
                const newTitle = e.target.value;
                setSelectedSong({ ...selectedSong, title: newTitle });
                if (selectedProject) {
                  setSelectedProject({ ...selectedProject, name: newTitle });
                  const updatedProjects = projects.map(p =>
                    p.id === selectedProject.id ? { ...p, name: newTitle } : p
                  );
                  setProjects(updatedProjects);
                }
              }}
              placeholder={uiLanguage === 'en' ? 'Project name' : uiLanguage === 'zh-Hant' ? '項目名稱' : '项目名称'}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* 第四行：主题栏 - 整体宽度75% */}
        {selectedSong && (
          <div className="theme-row-single-line" style={{ width: '75%' }}>
            <span className="theme-label-inline">{t.theme}</span>
            <div className="theme-chips-inline" style={{ flex: 1 }}>
              {themes.map(theme => (
                <div
                  key={theme.id}
                  className={`theme-chip-inline ${currentThemeId === theme.id ? 'active' : ''}`}
                  onClick={() => {
                    setCurrentThemeId(theme.id);
                    setShowCustomTheme(false);
                    if (isProjectionActive) updateProjection();
                  }}
                  style={{
                    background: theme.backgroundColor.startsWith('linear-gradient')
                      ? theme.backgroundColor
                      : theme.backgroundColor,
                    color: theme.textColor,
                  }}
                  title={theme.name}
                >
                  {theme.shortName}
                </div>
              ))}
              <div
                className={`theme-chip-inline ${showCustomTheme ? 'active' : ''}`}
                onClick={() => {
                  setCurrentThemeId('custom');
                  setShowCustomTheme(!showCustomTheme);
                  if (isProjectionActive) updateProjection();
                }}
                style={{
                  background: customBgColor,
                  color: customTextColor,
                  border: showCustomTheme ? '2px solid #000000' : '1px dashed #666666',
                }}
                title={editPanelCopy.customThemeTitle}
              >
                自
              </div>
            </div>
          </div>
        )}

        {/* 自定义主题面板 */}
        {selectedSong && showCustomTheme && (
          <div className="custom-theme-panel-inline">
            <div className="custom-theme-grid">
              <div className="theme-section colors">
                <div className="color-picker-row">
                  <div className="color-picker-item">
                    <label>{editPanelCopy.textColor}</label>
                    <input
                      type="color"
                      value={customTextColor}
                      onChange={(e) => {
                        setCustomTextColor(e.target.value);
                        if (isProjectionActive) updateProjection();
                      }}
                    />
                  </div>
                  <div className="color-picker-item">
                    <label>{editPanelCopy.backgroundColor}</label>
                    <input
                      type="color"
                      value={customBgColor}
                      onChange={(e) => {
                        setCustomBgColor(e.target.value);
                        if (isProjectionActive) updateProjection();
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="theme-section sliders">
                <div className="slider-control">
                  <label>{editPanelCopy.fontSize}</label>
                  <input
                    type="range"
                    min="24"
                    max="150"
                    value={customFontSize}
                    onChange={(e) => {
                      setCustomFontSize(Number(e.target.value));
                      if (isProjectionActive) updateProjection();
                    }}
                  />
                  <span className="slider-value">{customFontSize}</span>
                </div>
                <div className="slider-control">
                  <label>{editPanelCopy.lineHeight}</label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={customLineHeight}
                    onChange={(e) => {
                      setCustomLineHeight(Number(e.target.value));
                      if (isProjectionActive) updateProjection();
                    }}
                  />
                  <span className="slider-value">{customLineHeight.toFixed(1)}</span>
                </div>
                <div className="slider-control">
                  <label>{editPanelCopy.letterSpacing}</label>
                  <input
                    type="range"
                    min="-10"
                    max="20"
                    step="1"
                    value={customLetterSpacing}
                    onChange={(e) => {
                      setCustomLetterSpacing(Number(e.target.value));
                      if (isProjectionActive) updateProjection();
                    }}
                  />
                  <span className="slider-value">{customLetterSpacing}</span>
                </div>
              </div>
              <div className="theme-section bottom">
                <div className="alignment-controls">
                  <button
                    className={`alignment-btn ${customTextAlign === 'left' ? 'active' : ''}`}
                    onClick={() => {
                      setCustomTextAlign('left');
                      if (isProjectionActive) updateProjection();
                    }}
                    title={editPanelCopy.alignLeft}
                  >
                    左
                  </button>
                  <button
                    className={`alignment-btn ${customTextAlign === 'center' ? 'active' : ''}`}
                    onClick={() => {
                      setCustomTextAlign('center');
                      if (isProjectionActive) updateProjection();
                    }}
                    title={editPanelCopy.alignCenter}
                  >
                    中
                  </button>
                  <button
                    className={`alignment-btn ${customTextAlign === 'right' ? 'active' : ''}`}
                    onClick={() => {
                      setCustomTextAlign('right');
                      if (isProjectionActive) updateProjection();
                    }}
                    title={editPanelCopy.alignRight}
                  >
                    右
                  </button>
                </div>
                <select
                  className="font-selector"
                  value={customFontFamily}
                  onChange={(e) => {
                    setCustomFontFamily(e.target.value);
                    if (isProjectionActive) updateProjection();
                  }}
                >
                  <option value="Noto Sans SC, sans-serif">思源黑体</option>
                  <option value="Noto Serif SC, serif">思源宋体</option>
                  <option value="SimHei, sans-serif">黑体</option>
                  <option value="SimSun, serif">宋体</option>
                  <option value="KaiTi, serif">楷体</option>
                  <option value="Microsoft YaHei, sans-serif">微软雅黑</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="Times New Roman, serif">Times New Roman</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 编辑卡片在panel-content里 */}
      <div
        className={`panel-content drop-zone edit-panel-content-final-v2 ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {selectedSong ? (
          <>
            <div className="slides-editor">
              {selectedSong.slides.map((slide, index) => {
                const isThisMediaSlide = isMediaSlide(selectedSong, slide, index);
                return (
                  <div
                    key={index}
                    className={`slide-editor-item ${currentSlideIndex === index ? 'active' : ''} ${isThisMediaSlide ? 'media-slide' : ''}`}
                    onClick={() => selectSlide(index)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setSlideRightClickMenu({ x: e.clientX, y: e.clientY, slideIndex: index });
                    }}
                  >
                    <div className="slide-number">
                      {index + 1}
                      {isProjectionLocked && lockedSlideIndex === index && (
                        <span className="lock-indicator">🔒</span>
                      )}
                      {cutSlideIndex === index && <span className="cut-indicator">✂️</span>}
                    </div>
                    {isThisMediaSlide ? (
                      <div className="media-preview" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '8px' }}>
                        {selectedSong.fileType === FILE_TYPES.IMAGE && (
                          <img
                            src={`local-file://${selectedSong.filePath}`}
                            alt={slide}
                            className="slide-image-preview"
                            style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }}
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                          />
                        )}
                        {selectedSong.fileType === FILE_TYPES.VIDEO && (
                          <>
                            <video
                              src={`local-file://${selectedSong.filePath}`}
                              className="slide-video-preview"
                              controls
                              style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }}
                              onError={(e) => {
                                console.error('Video preview error:', e);
                                e.target.style.display = 'none';
                                const fallback = e.target.parentElement.querySelector('.video-fallback');
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="video-fallback" style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px' }}>
                              <span className="media-icon">🎬</span>
                              <span className="media-name">{slide}</span>
                            </div>
                          </>
                        )}
                        {selectedSong.fileType === FILE_TYPES.AUDIO && (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', width: '100%' }}>
                            <span className="media-icon">🎵</span>
                            <span className="media-name" style={{ fontSize: '11px', textAlign: 'center' }}>{slide}</span>
                            <audio
                              src={`local-file://${selectedSong.filePath}`}
                              className="slide-audio-preview"
                              controls
                              style={{ width: '100%', maxWidth: '200px' }}
                              onError={(e) => {
                                console.error('Audio preview error:', e);
                                const fallback = e.target.parentElement.querySelector('.audio-fallback');
                                if (fallback) { fallback.style.display = 'flex'; e.target.style.display = 'none'; }
                              }}
                            />
                          </div>
                        )}
                        {selectedSong.fileType === FILE_TYPES.PDF && (
                          <div style={{ width: '100%', height: '150px' }}>
                            <iframe
                              src={`local-file://${selectedSong.filePath}`}
                              className="slide-pdf-preview"
                              style={{ width: '100%', height: '100%', border: '1px solid #cccccc', borderRadius: '0px' }}
                              title={slide}
                              onError={(e) => {
                                console.error('PDF preview error:', e);
                                e.target.style.display = 'none';
                                const fallback = e.target.parentElement.querySelector('.pdf-fallback');
                                if (fallback) fallback.style.display = 'flex';
                              }}
                            />
                            <div className="pdf-fallback" style={{ display: 'none', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', height: '100%' }}>
                              <span className="media-icon">📄</span>
                              <span className="media-name">{slide}</span>
                            </div>
                          </div>
                        )}
                        {selectedSong.fileType === FILE_TYPES.PPT && (
                          <div className="document-placeholder">
                            <span className="media-icon">📊</span>
                            <span className="media-name">{slide}</span>
                            <span style={{ fontSize: '10px', color: '#999', marginTop: '4px', textAlign: 'center' }}>
                              {editPanelCopy.convertPdfHint}
                            </span>
                          </div>
                        )}
                        <span className="media-fallback" style={{ display: 'none' }}>{slide}</span>
                      </div>
                    ) : (
                      <textarea
                        value={slide}
                        onChange={(e) => editSlide(index, e.target.value)}
                        placeholder={editPanelCopy.editorPlaceholder}
                        className="slide-textarea"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : currentSharingId ? (
          <div className="share-selected">
            <h3>{editPanelCopy.sourceSelected}</h3>
            <p>{availableSources.find(s => s.id === currentSharingId)?.name}</p>
          </div>
        ) : (
          <div className="empty-state">
            <p className="drop-hint">{editPanelCopy.dragHint}</p>
          </div>
        )}
      </div>
    </div>
  );
  };

  // ===== 渲染第四栏：展示栏 =====
  const renderDisplayPanel = () => {
    const displayCopy = {
      editorPlaceholder: uiLanguage === 'en' ? 'Slide content...' : uiLanguage === 'zh-Hant' ? '幻燈片內容...' : '幻灯片内容...',
      sourceSelected: uiLanguage === 'en' ? 'Source selected' : uiLanguage === 'zh-Hant' ? '已選擇投屏源' : '已选择投屏源',
      dragHint: uiLanguage === 'en' ? 'Drag content here to edit' : uiLanguage === 'zh-Hant' ? '拖到這裡進行編輯' : '拖到这里进行编辑',
      livePage: uiLanguage === 'en' ? 'Live' : uiLanguage === 'zh-Hant' ? '播放頁' : '播放页',
      sharing: uiLanguage === 'en' ? 'Sharing...' : uiLanguage === 'zh-Hant' ? '投屏中...' : '投屏中...',
      convertPdfHint: uiLanguage === 'en' ? 'Convert to PDF before projecting' : uiLanguage === 'zh-Hant' ? '請先轉換為 PDF 再投影' : '请先转换为PDF再投影',
      waitingContent: uiLanguage === 'en' ? 'Waiting for content...' : uiLanguage === 'zh-Hant' ? '等待內容...' : '等待内容...',
      locked: uiLanguage === 'en' ? 'Locked' : uiLanguage === 'zh-Hant' ? '已鎖定' : '已锁定',
      unlocked: uiLanguage === 'en' ? 'Unlocked' : uiLanguage === 'zh-Hant' ? '未鎖定' : '未锁定',
      liveSync: uiLanguage === 'en' ? 'Live sync' : uiLanguage === 'zh-Hant' ? '實時同步' : '实时同步',
      startProjection: uiLanguage === 'en' ? '▶ Start projection' : uiLanguage === 'zh-Hant' ? '▶ 開始投屏' : '▶ 开始投影',
      stopProjection: uiLanguage === 'en' ? 'Stop projection' : uiLanguage === 'zh-Hant' ? '停止投屏' : '停止投影',
      chooseShareSourceFirst: uiLanguage === 'en' ? 'Please choose a share source first' : uiLanguage === 'zh-Hant' ? '請先選擇投屏源' : '请先选择投屏源',
      switchToShare: uiLanguage === 'en' ? 'Switch to app sharing' : uiLanguage === 'zh-Hant' ? '切換到應用分享' : '切换到应用分享',
      exitShare: uiLanguage === 'en' ? 'Exit sharing' : uiLanguage === 'zh-Hant' ? '退出分享' : '退出分享',
      nextPage: uiLanguage === 'en' ? 'Next' : uiLanguage === 'zh-Hant' ? '預覽頁' : '预览页',
      selectContentFirst: uiLanguage === 'en' ? 'Please select content first' : uiLanguage === 'zh-Hant' ? '請先選擇內容' : '请先选择内容',
      appShare: uiLanguage === 'en' ? 'App sharing' : uiLanguage === 'zh-Hant' ? '應用分享' : '应用分享',
      refreshing: uiLanguage === 'en' ? 'Refreshing...' : uiLanguage === 'zh-Hant' ? '刷新中...' : '刷新中...',
      chooseShareSource: uiLanguage === 'en' ? 'Choose share source' : uiLanguage === 'zh-Hant' ? '選擇投屏源' : '选择投屏源',
      sharingNow: uiLanguage === 'en' ? '✅ Sharing:' : uiLanguage === 'zh-Hant' ? '✅ 正在投屏:' : '✅ 正在投屏:',
      sourceChosen: uiLanguage === 'en' ? 'Share source selected' : uiLanguage === 'zh-Hant' ? '已選擇投屏源' : '已选择投屏源',
      chooseSource: uiLanguage === 'en' ? 'Please choose a share source' : uiLanguage === 'zh-Hant' ? '請選擇投屏源' : '请选择投屏源',
      favoriteSourceHint: uiLanguage === 'en' ? 'Favorite a source in the picker first (click ⭐).' : uiLanguage === 'zh-Hant' ? '請先在投屏選擇彈窗中收藏投屏源（點擊 ⭐ 收藏）' : '请先在投屏选择弹窗中收藏投屏源（点击⭐收藏）',
    };

    return (
      <div className="panel panel-4 panel-4-vertical">
        <div className="panel-content-vertical" style={{paddingTop: '16px'}}>
          {/* 播放页 */}
          <div className="display-section">
            <div className="section-title">{displayCopy.livePage}</div>
            <div className="live-preview-vertical" style={{
              background: currentSharingId
                ? '#000'
                : currentTheme.backgroundColor.startsWith('linear-gradient')
                  ? currentTheme.backgroundColor
                  : currentTheme.backgroundColor,
              color: currentTheme.textColor,
              position: 'relative',
              overflow: 'hidden'
            }}>
              {currentSharingId ? (
                <div className="sharing-placeholder">
                  <span>📺 {displayCopy.sharing}</span>
                  <span className="sharing-name">
                    {availableSources.find(s => s.id === currentSharingId)?.name}
                  </span>
                </div>
              ) : selectedSong ? (
                <>
                  {isCurrentSlideMedia ? (
                    // 媒体文件展示
                    <div className="media-display" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', position: 'absolute', top: 0, left: 0 }}>
                      {selectedSong.fileType === FILE_TYPES.IMAGE && (
                        <img
                          src={`local-file://${selectedSong.filePath}`}
                          alt={selectedSong.title}
                          className="display-image"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain'
                          }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const fallback = e.target.parentElement.querySelector('.media-fallback-text');
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      )}
                      {selectedSong.fileType === FILE_TYPES.VIDEO && (
                        <video
                          src={`local-file://${selectedSong.filePath}`}
                          className="display-video"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain'
                          }}
                          controls
                          onError={(e) => {
                            console.error('Video preview error:', e);
                            e.target.style.display = 'none';
                            const fallback = e.target.parentElement.querySelector('.media-fallback-text');
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      )}
                      {selectedSong.fileType === FILE_TYPES.AUDIO && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          color: 'white',
                          width: '100%',
                          height: '100%',
                          padding: '12px',
                          boxSizing: 'border-box'
                        }}>
                          <span style={{ fontSize: '32px' }}>🎵</span>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>{selectedSong.title}</span>
                          <audio
                            src={`local-file://${selectedSong.filePath}`}
                            className="display-audio"
                            style={{ width: '100%', maxWidth: '180px' }}
                            controls
                            onError={(e) => {
                              console.error('Audio preview error:', e);
                              const fallback = e.target.parentElement.parentElement.querySelector('.media-fallback-text');
                              if (fallback) {
                                fallback.style.display = 'flex';
                                e.target.parentElement.style.display = 'none';
                              }
                            }}
                          />
                        </div>
                      )}
                      {selectedSong.fileType === FILE_TYPES.PDF && (
                        <iframe
                          src={`local-file://${selectedSong.filePath}`}
                          className="display-pdf"
                          style={{
                            width: '100%',
                            height: '100%',
                            border: '1px solid #cccccc',
                            borderRadius: '0px'
                          }}
                          title={selectedSong.title}
                          onError={(e) => {
                            console.error('PDF preview error:', e);
                            e.target.style.display = 'none';
                            const fallback = e.target.parentElement.querySelector('.media-fallback-text');
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      )}
                      {selectedSong.fileType === FILE_TYPES.PPT && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          color: 'white',
                          width: '100%',
                          height: '100%',
                          textAlign: 'center',
                          padding: '12px'
                        }}>
                          <span style={{ fontSize: '32px' }}>📊</span>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>{selectedSong.title}</span>
                          <span style={{ fontSize: '8px', opacity: 0.6, marginTop: '2px' }}>
                            {displayCopy.convertPdfHint}
                          </span>
                        </div>
                      )}
                      <div className="media-fallback-text" style={{
                        display: 'none',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'white',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0
                      }}>
                        <span style={{ fontSize: '32px', marginBottom: '8px' }}>⚠️</span>
                        <span style={{ fontSize: '10px' }}>{selectedSong.title}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      width: '100%',
                      height: '100%',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '20px',
                      boxSizing: 'border-box',
                      overflow: 'hidden'
                    }}>
                      {currentBackground && currentBackground.type === 'image' && currentBackground.url ? (
                        <div className="live-bg" style={{
                          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${currentBackground.url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                        }} />
                      ) : currentBackground && currentBackground.type === 'video' && currentBackground.url ? (
                        <video
                          src={currentBackground.url}
                          autoPlay
                          muted
                          loop
                          playsInline
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            zIndex: 0
                          }}
                        />
                      ) : null}
                      <div style={{
                        fontFamily: currentTheme.fontFamily,
                        fontSize: Math.round((currentTheme.fontSize || 72) * 0.35) + 'px',
                        lineHeight: currentTheme.lineHeight,
                        textAlign: currentTheme.textAlign,
                        letterSpacing: Math.round((currentTheme.letterSpacing || 0) * 0.35) + 'px',
                        whiteSpace: 'pre-wrap',
                        position: 'relative',
                        zIndex: 10,
                        maxWidth: '90%',
                        padding: '20px',
                        textShadow: currentBackground && currentBackground.type === 'video' ? '2px 2px 8px rgba(0,0,0,0.8)' : 'none'
                      }}>
                        {selectedSong.slides[getDisplaySlideIndex()]}
                      </div>
                    </div>
                  )}
                  <div className="live-page-num" style={{ zIndex: 20 }}>
                    {getDisplaySlideIndex() + 1} / {selectedSong.slides.length}
                    {isProjectionLocked && ' 🔒'}
                  </div>
                </>
              ) : (
                <div className="live-empty">{displayCopy.waitingContent}</div>
              )}
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="live-controls-vertical">
            <button
              className={`control-btn lock-btn ${isProjectionLocked ? 'locked' : ''}`}
              onClick={toggleLock}
            >
              {isProjectionLocked ? displayCopy.locked : displayCopy.unlocked}
            </button>
            <button
              className="control-btn sync-btn"
              onClick={syncToProjection}
            >
              {displayCopy.liveSync}
            </button>
            {!isProjectionActive ? (
              <button
                className="control-btn primary"
                onClick={syncToProjection}
              >
                {displayCopy.startProjection}
              </button>
            ) : (
              <button
                className="control-btn danger"
                onClick={() => {
                  electronAPI.stopProjection();
                  setIsProjectionActive(false);
                  setCurrentSharingId(null);
                }}
              >
                {displayCopy.stopProjection}
              </button>
            )}
          </div>

          {isProjectionActive && !currentSharingId && (
            <div style={{ marginTop: '8px' }}>
              <button
                className="btn"
                onClick={() => {
                  if (!selectedSourceId) {
                    alert(displayCopy.chooseShareSourceFirst);
                    return;
                  }
                  startAppSharing();
                }}
                style={{ width: '100%', height: '40px', padding: '0 16px', background: '#323341', color: '#ffffff', borderRadius: '0px' }}
              >
                {displayCopy.switchToShare}
              </button>
            </div>
          )}

          {currentSharingId && (
            <div style={{ marginTop: '8px' }}>
              <button
                className="btn danger"
                onClick={stopShareAndRestore}
                style={{ width: '100%', height: '40px', padding: '0 16px' }}
              >
                {displayCopy.exitShare}
              </button>
            </div>
          )}

          <div className="display-section">
            <div className="section-title">{displayCopy.nextPage}</div>
            <div className="next-preview-vertical" style={{
              background: currentTheme.backgroundColor.startsWith('linear-gradient')
                ? currentTheme.backgroundColor
                : currentTheme.backgroundColor,
              color: currentTheme.textColor,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '15px',
              boxSizing: 'border-box'
            }}>
              {selectedSong ? (
                (() => {
                  const nextIndex = Math.min(currentSlideIndex + 1, selectedSong.slides.length - 1);
                  const isMedia = isMediaSlide(selectedSong, selectedSong.slides[nextIndex], nextIndex);
                  if (isMedia) {
                    return (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#000',
                        position: 'absolute',
                        top: 0,
                        left: 0
                      }}>
                        {selectedSong.fileType === FILE_TYPES.IMAGE && (
                          <img
                            src={`local-file://${selectedSong.filePath}`}
                            alt={selectedSong.title}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        )}
                        {selectedSong.fileType === FILE_TYPES.VIDEO && (
                          <video
                            src={`local-file://${selectedSong.filePath}`}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain'
                            }}
                          />
                        )}
                        {selectedSong.fileType === FILE_TYPES.AUDIO && (
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            color: 'white'
                          }}>
                            <span style={{ fontSize: '24px' }}>🎵</span>
                            <span style={{ fontSize: '8px' }}>{selectedSong.title}</span>
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div className="next-text" style={{
                        fontFamily: currentTheme.fontFamily,
                        fontSize: Math.round((currentTheme.fontSize || 72) * 0.18) + 'px',
                        lineHeight: currentTheme.lineHeight,
                        textAlign: currentTheme.textAlign,
                        whiteSpace: 'pre-wrap',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        overflow: 'hidden'
                      }}>
                        {selectedSong.slides[nextIndex]}
                      </div>
                    );
                  }
                })()
              ) : (
                <div className="empty-text">{displayCopy.selectContentFirst}</div>
              )}
            </div>
          </div>

          <div className="display-section share-section">
            <div className="section-title">{displayCopy.appShare}</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                className="refresh-btn-vertical"
                onClick={() => {
                  refreshSources();
                  setShowShareDialog(true);
                }}
                disabled={loadingSources}
                style={{ flex: 1 }}
              >
                {loadingSources ? displayCopy.refreshing : displayCopy.chooseShareSource}
              </button>
            </div>
            {isProjectionActive && (
              <>
                {currentSharingId && (
                  <div style={{
                    padding: '12px',
                    background: '#e5e5e5',
                    borderRadius: '0px',
                    marginBottom: '12px',
                    color: '#000000',
                    fontSize: '14px',
                    border: '1px solid #000000'
                  }}>
                    {displayCopy.sharingNow} {availableSources.find(s => s.id === currentSharingId)?.name}
                  </div>
                )}
                <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666' }}>
                  {selectedSourceId ? displayCopy.sourceChosen : displayCopy.chooseSource}
                </div>
                <div className="source-list-vertical">
                  {availableSources.filter(s => favoriteSourceIds.includes(s.id)).length === 0 ? (
                    <div className="empty">{displayCopy.favoriteSourceHint}</div>
                  ) : (
                    availableSources.filter(s => favoriteSourceIds.includes(s.id)).slice(0, 10).map(source => (
                      <div
                        key={source.id}
                        className={`source-item-vertical ${selectedSourceId === source.id ? 'selected' : ''}`}
                        onClick={() => toggleSourceSelection(source.id)}
                        style={{ position: 'relative' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div className="source-name">{source.name}</div>
                          {selectedSourceId === source.id && (
                            <span style={{ color: '#000000', fontWeight: '400' }}>✓</span>
                          )}
                        </div>
                        {source.thumbnail && (
                          <img
                            className="source-thumb-vertical"
                            src={source.thumbnail}
                            alt={source.name}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ===== 诗歌库状态 =====
  const [songSearchText, setSongSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [selectedSongFromLibrary, setSelectedSongFromLibrary] = useState(null);
  const [hoveredSongFromLibrary, setHoveredSongFromLibrary] = useState(null);
  const [favoriteSongIds, setFavoriteSongIds] = useState(() => {
    const saved = localStorage.getItem('favoriteSongIds');
    return saved ? JSON.parse(saved) : [];
  });
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [songListScrollTop, setSongListScrollTop] = useState(0);
  const songListRef = useRef(null);

  // ===== 防抖搜索文本 =====
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(songSearchText);
    }, 150); // 150ms 防抖延迟

    return () => clearTimeout(timer);
  }, [songSearchText]);

  // ===== 诗歌搜索和筛选（优化版）=====
  const filteredSongs = useMemo(() => {
    let result = songs;

    // 如果有搜索文本，自动显示全部结果
    const shouldShowAll = showAllSongs || debouncedSearchText.trim() !== '';

    // 如果不是显示全部，只显示收藏的和已添加到项目的
    if (!shouldShowAll) {
      const projectSongTitles = new Set(
        projects
          .filter(p => p.type === PROJECT_TYPES.SONG)
          .map(p => p.title)
      );

      result = songs.filter(song =>
        favoriteSongIds.includes(song.id) ||
        projectSongTitles.has(song.title)
      );
    }

    // 搜索过滤 - 优化版本
    const searchTrimmed = debouncedSearchText.trim();
    if (searchTrimmed) {
      const searchLower = searchTrimmed.toLowerCase();
      result = result.filter(song =>
        song.title.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [songs, debouncedSearchText, showAllSongs, favoriteSongIds, projects]);

  // ===== 从诗歌库选择诗歌 =====
  const selectSongFromLibrary = (song) => {
    setSelectedSongFromLibrary(song);
  };

  // ===== 将诗歌加入项目栏 =====
  const addSongToProjects = () => {
    if (!selectedSongFromLibrary) {
      alert(uiLanguage === 'en' ? 'Please select a song first' : uiLanguage === 'zh-Hant' ? '請先選擇一首詩歌' : '请先选择一首诗歌');
      return;
    }

    const newProject = {
      id: `project_song_${Date.now()}`,
      type: PROJECT_TYPES.SONG,
      name: selectedSongFromLibrary.title,
      slides: selectedSongFromLibrary.slides,
      createdAt: Date.now(),
    };

    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
    setSelectedSong(buildSelectedSong(newProject));
    setCurrentSlideIndex(0);
    setCurrentNav('project');
  };

  // ===== 删除诗歌 =====
  const deleteSongFromLibrary = (song) => {
    if (!confirm(`${uiLanguage === 'en' ? 'Delete song' : uiLanguage === 'zh-Hant' ? '刪除詩歌' : '删除诗歌'} "${song.title}"${uiLanguage === 'en' ? '?' : '吗？'}`)) return;
    setSongs(songs.filter(s => s.id !== song.id));
    // 如果是收藏的，也从收藏列表中移除
    if (favoriteSongIds.includes(song.id)) {
      const newFavorites = favoriteSongIds.filter(id => id !== song.id);
      setFavoriteSongIds(newFavorites);
      localStorage.setItem('favoriteSongIds', JSON.stringify(newFavorites));
    }
    setSongRightClickMenu(null);
  };

  // ===== 渲染其他导航页 =====
  const renderSongsPage = () => (
    <div className="four-panel-layout">
      {/* 第一栏：项目栏（复用） */}
      {renderProjectPanel()}

      {/* 第二栏：诗歌库 */}
      <div
        className="panel panel-2"
      >
        <div className="panel-header">
          <h3>{t.nav.songs}</h3>
          <input
            type="text"
            placeholder={uiLanguage === 'en' ? 'Search songs...' : uiLanguage === 'zh-Hant' ? '搜尋詩歌...' : '搜索诗歌...'}
            value={songSearchText}
            onChange={(e) => setSongSearchText(e.target.value)}
            className="panel-search"
          />
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
            {songSearchText.trim() ? (
              <button
                className="btn"
                onClick={() => setSongSearchText('')}
                style={{ flex: 1, padding: '8px 16px', fontSize: '12px', minHeight: '32px' }}
              >
                {uiLanguage === 'en' ? '[×] Clear' : uiLanguage === 'zh-Hant' ? '[×] 清除搜尋' : '[×] 清除搜索'}
              </button>
            ) : (
              <button
                className={`btn ${showAllSongs ? 'primary' : ''}`}
                onClick={() => setShowAllSongs(!showAllSongs)}
                style={{ flex: 1, padding: '8px 16px', fontSize: '12px', minHeight: '32px' }}
              >
                {showAllSongs
                  ? (uiLanguage === 'en' ? '[*] Favorites only' : uiLanguage === 'zh-Hant' ? '[*] 只看常用' : '[*] 只看常用')
                  : (uiLanguage === 'en' ? '[Lib] Show all' : uiLanguage === 'zh-Hant' ? '[庫] 顯示全部' : '[库] 显示全部')}
              </button>
            )}
          </div>
          <div className="song-stats">
            {songSearchText.trim()
              ? (uiLanguage === 'en' ? `Results: ${filteredSongs.length}` : uiLanguage === 'zh-Hant' ? `搜尋結果: ${filteredSongs.length} 首` : `搜索结果: ${filteredSongs.length} 首`)
              : (showAllSongs
                  ? (uiLanguage === 'en' ? `${songs.length} songs` : uiLanguage === 'zh-Hant' ? `共 ${songs.length} 首` : `共 ${songs.length} 首`)
                  : (uiLanguage === 'en' ? `Favorites ${filteredSongs.length}` : uiLanguage === 'zh-Hant' ? `常用 ${filteredSongs.length} 首` : `常用 ${filteredSongs.length} 首`))} {uiLanguage === 'en' ? '↕ draggable' : '↕ 可拖拽'}
          </div>
        </div>
        <div className="panel-content">
          <div
            ref={songListRef}
            className="song-list"
            onScroll={(e) => setSongListScrollTop(e.currentTarget.scrollTop)}
          >
            {filteredSongs.length === 0 ? (
              <div className="empty">
                {songSearchText.trim()
                  ? (uiLanguage === 'en' ? 'No songs found' : uiLanguage === 'zh-Hant' ? '未找到詩歌' : '未找到诗歌')
                  : (showAllSongs
                      ? (uiLanguage === 'en' ? 'No songs found' : uiLanguage === 'zh-Hant' ? '未找到詩歌' : '未找到诗歌')
                      : (uiLanguage === 'en' ? 'No favorites yet. Click Show all to add some.' : uiLanguage === 'zh-Hant' ? '暫無常用詩歌，點擊「顯示全部」添加' : '暂无常用诗歌，点击"显示全部"添加'))}
              </div>
            ) : (
              // 使用虚拟滚动优化：只渲染可见区域的歌曲
              (() => {
                const itemHeight = 40; // 预估每个歌曲项的高度
                const visibleCount = 200; // 限制最大渲染数量，保证性能
                const startIndex = 0;
                const endIndex = Math.min(startIndex + visibleCount, filteredSongs.length);
                const visibleSongs = filteredSongs.slice(startIndex, endIndex);

                return (
                  <>
                    {visibleSongs.map((song, idx) => {
                      const actualIndex = startIndex + idx;
                      return (
                        <div
                          key={song.id || actualIndex}
                          className={`song-item ${selectedSongFromLibrary?.id === song.id ? 'selected' : ''}`}
                          onClick={() => {
                            selectSongFromLibrary(song);
                            setHoveredSongFromLibrary(hoveredSongFromLibrary?.id === song.id ? null : song);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setSongRightClickMenu({
                              x: e.clientX,
                              y: e.clientY,
                              song: song
                            });
                          }}
                          draggable
                          onDragStart={(e) => handleDragStart(e, song, 'song')}
                          style={{ position: 'relative' }}
                        >
                          <span className="song-number">{actualIndex + 1}</span>
                          <span className="song-title">{song.title}</span>
                          <span
                            className="song-page-count"
                            style={{
                              position: 'absolute',
                              top: '50%',
                              right: '36px',
                              transform: 'translateY(-50%)',
                              fontSize: '11px',
                              color: '#000000',
                              background: '#e5e5e5',
                              padding: '2px 6px',
                              borderRadius: '0px',
                              fontWeight: '400',
                              border: '1px solid #000000'
                            }}
                          >
                            {song.slides?.length || 0}{uiLanguage === 'en' ? ' pages' : uiLanguage === 'zh-Hant' ? '頁' : '页'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newFavorites = favoriteSongIds.includes(song.id)
                                ? favoriteSongIds.filter(id => id !== song.id)
                                : [...favoriteSongIds, song.id];
                              setFavoriteSongIds(newFavorites);
                              localStorage.setItem('favoriteSongIds', JSON.stringify(newFavorites));
                            }}
                            className="song-favorite"
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              fontSize: '16px',
                              color: '#666666',
                              background: 'none',
                              border: 'none',
                              padding: 0
                            }}
                          >
                            {favoriteSongIds.includes(song.id) ? '⭐' : '☆'}
                          </button>
                        </div>
                      );
                    })}
                    {endIndex < filteredSongs.length && (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#666666', fontSize: '12px' }}>
                        {uiLanguage === 'en' ? `Showing first ${endIndex}. Keep searching to narrow results.` : uiLanguage === 'zh-Hant' ? `僅顯示前 ${endIndex} 首，繼續搜尋篩選更精確的結果` : `仅显示前 ${endIndex} 首，继续搜索筛选更精确的结果`}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </div>
      </div>

      {/* 第三栏：编辑栏（复用） */}
      {renderEditPanel()}

      {/* 第四栏：展示栏（复用） */}
      {renderDisplayPanel()}
    </div>
  );

  // ===== 文件管理状态 =====
  const [files, setFiles] = useState([]);
  const [fileSearchText, setFileSearchText] = useState('');
  const [fileFilterType, setFileFilterType] = useState('all'); // all | video | audio | ppt | pdf | image

  // 文件类型
  const FILE_TYPES = {
    VIDEO: 'video',
    AUDIO: 'audio',
    PPT: 'ppt',
    PDF: 'pdf',
    IMAGE: 'image',
    WORD: 'word',
    LYRIC: 'lyric',
  };

  const getFileTypeIcon = (type) => {
    switch (type) {
      case FILE_TYPES.VIDEO: return '🎬';
      case FILE_TYPES.AUDIO: return '🎵';
      case FILE_TYPES.PPT: return '📊';
      case FILE_TYPES.PDF: return '📄';
      case FILE_TYPES.IMAGE: return '🖼️';
      case FILE_TYPES.WORD: return '📝';
      case FILE_TYPES.LYRIC: return '🎶';
      default: return '📁';
    }
  };

  const getFileTypeName = (type) => {
    switch (type) {
      case FILE_TYPES.VIDEO: return uiLanguage === 'en' ? 'Video' : uiLanguage === 'zh-Hant' ? '影片' : '视频';
      case FILE_TYPES.AUDIO: return uiLanguage === 'en' ? 'Audio' : uiLanguage === 'zh-Hant' ? '音訊' : '音频';
      case FILE_TYPES.PPT: return 'PPT';
      case FILE_TYPES.PDF: return 'PDF';
      case FILE_TYPES.IMAGE: return uiLanguage === 'en' ? 'Image' : uiLanguage === 'zh-Hant' ? '圖片' : '图片';
      case FILE_TYPES.WORD: return 'Word';
      case FILE_TYPES.LYRIC: return uiLanguage === 'en' ? 'Lyrics' : uiLanguage === 'zh-Hant' ? '歌詞' : '歌词';
      default: return uiLanguage === 'en' ? 'File' : uiLanguage === 'zh-Hant' ? '文件' : '文件';
    }
  };

  // 解析歌词文件内容
  const parseLyricFile = (content, fileName) => {
    let slides = [];
    const title = fileName.replace(/\.(txt|lrc|json)$/i, '');

    // 尝试解析 JSON 格式
    try {
      const jsonData = JSON.parse(content);
      if (Array.isArray(jsonData.slides)) {
        slides = jsonData.slides;
      } else if (Array.isArray(jsonData)) {
        slides = jsonData;
      }
      if (slides.length > 0) {
        return { title: jsonData.title || title, slides };
      }
    } catch (e) {
      // 不是 JSON，继续尝试其他格式
    }

    // 尝试解析 LRC 格式
    if (content.includes('[') && content.includes(']')) {
      const lrcLines = content.split('\n').filter(line => line.trim());
      const nonTimeLines = lrcLines.filter(line => !/^\[\d{2}:\d{2}/.test(line));
      if (nonTimeLines.length > 0) {
        slides = nonTimeLines.map(line => line.replace(/^\[[^\]]*\]/, '').trim()).filter(line => line);
      } else {
        slides = lrcLines.map(line => line.replace(/^\[[^\]]*\]/, '').trim()).filter(line => line);
      }
      if (slides.length > 0) {
        return { title, slides };
      }
    }

    // 纯文本格式，按空行分割
    const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(p => p);
    if (paragraphs.length > 1) {
      return { title, slides: paragraphs };
    }

    // 按行分割
    slides = content.split('\n').map(line => line.trim()).filter(line => line);
    return { title, slides };
  };

  // 过滤文件
  const filteredFiles = useMemo(() => {
    let result = files;
    if (fileFilterType !== 'all') {
      result = result.filter(f => f.type === fileFilterType);
    }
    if (fileSearchText.trim()) {
      const searchLower = fileSearchText.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(searchLower));
    }
    return result;
  }, [files, fileFilterType, fileSearchText]);

  // 导入文件
  const handleImportFiles = async () => {
    try {
      const result = await electronAPI.openFileDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Videos', extensions: ['mp4', 'avi', 'mov', 'mkv'] },
          { name: 'Audios', extensions: ['mp3', 'wav', 'aac', 'flac'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'PPT', extensions: ['ppt', 'pptx'] },
          { name: 'Word', extensions: ['doc', 'docx'] },
          { name: 'Lyrics', extensions: ['txt', 'lrc', 'json'] },
        ]
      });

      if (result && result.filePaths && result.filePaths.length > 0) {
        const newFiles = [];
        const newProjects = [];

        for (let idx = 0; idx < result.filePaths.length; idx++) {
          const path = result.filePaths[idx];
          const ext = path.split('.').pop().toLowerCase();
          let type;
          if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) type = FILE_TYPES.VIDEO;
          else if (['mp3', 'wav', 'aac', 'flac'].includes(ext)) type = FILE_TYPES.AUDIO;
          else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) type = FILE_TYPES.IMAGE;
          else if (['pdf'].includes(ext)) type = FILE_TYPES.PDF;
          else if (['ppt', 'pptx'].includes(ext)) type = FILE_TYPES.PPT;
          else if (['doc', 'docx'].includes(ext)) type = FILE_TYPES.WORD;
          else if (['txt', 'lrc', 'json'].includes(ext)) type = FILE_TYPES.LYRIC;
          else type = 'other';

          const name = path.split('/').pop();

          // 处理歌词文件：直接解析并创建歌曲项目
          if (type === FILE_TYPES.LYRIC) {
            const readResult = await electronAPI.readFile(path);
            if (readResult.success) {
              const parsed = parseLyricFile(readResult.content, name);
              if (parsed.slides.length > 0) {
                newProjects.push({
                  id: `project_song_${Date.now()}_${idx}`,
                  type: PROJECT_TYPES.SONG,
                  name: parsed.title,
                  slides: parsed.slides,
                  filePath: path,
                  fileType: type,
                  createdAt: Date.now(),
                });
                continue;
              }
            }
          }

          // 普通文件添加到文件列表
          newFiles.push({
            id: `file_${Date.now()}_${idx}`,
            path,
            name,
            type,
            importedAt: Date.now(),
          });
        }

        // 添加新文件到文件列表
        if (newFiles.length > 0) {
          setFiles([...newFiles, ...files]);
        }

        // 添加解析的歌曲到项目列表并选中第一个
        if (newProjects.length > 0) {
          setProjects([...newProjects, ...projects]);
          const firstProject = newProjects[0];
          setSelectedProject(firstProject);
          setSelectedSong(buildSelectedSong(firstProject));
          setCurrentSlideIndex(0);
          setCurrentNav('project');
        }
      }
    } catch (err) {
      console.error('Failed to import files:', err);
    }
  };

  // 选择文件创建项目
  const selectFile = (file) => {
    const newProject = {
      id: `project_file_${Date.now()}`,
      type: file.type === FILE_TYPES.VIDEO ? PROJECT_TYPES.VIDEO :
            file.type === FILE_TYPES.AUDIO ? PROJECT_TYPES.AUDIO :
            file.type === FILE_TYPES.IMAGE ? PROJECT_TYPES.IMAGE :
            file.type === FILE_TYPES.PPT ? PROJECT_TYPES.PPT :
            PROJECT_TYPES.CUSTOM,
      name: file.name,
      filePath: file.path,
      fileType: file.type,
      slides: [file.name],
      createdAt: Date.now(),
    };
    setProjects([newProject, ...projects]);
    setSelectedProject(newProject);
    setSelectedSong(buildSelectedSong(newProject));
    setCurrentSlideIndex(0);
    setCurrentNav('project');
  };

  // 重命名文件
  const renameFile = (file) => {
    showInputPrompt(uiLanguage === 'en' ? 'Rename file' : uiLanguage === 'zh-Hant' ? '重新命名文件' : '重命名文件', uiLanguage === 'en' ? 'Enter a new file name:' : uiLanguage === 'zh-Hant' ? '請輸入新的文件名稱：' : '请输入新文件名：', file.name, (newName) => {
      if (newName && newName.trim()) {
        setFiles(files.map(f =>
          f.id === file.id ? { ...f, name: newName.trim() } : f
        ));
      }
    });
    setFileRightClickMenu(null);
  };

  // 删除文件
  const deleteFile = (file) => {
    if (confirm(uiLanguage === 'en' ? 'Delete this file?' : uiLanguage === 'zh-Hant' ? '確定要刪除這個文件嗎？' : '确定要删除这个文件吗？')) {
      setFiles(files.filter(f => f.id !== file.id));
    }
    setFileRightClickMenu(null);
  };

  const renderFilesPage = () => (
    <div className="four-panel-layout">
      {/* 第一栏：项目栏（复用） */}
      {renderProjectPanel()}

      {/* 第二栏：文件管理 */}
      <div className="panel panel-2">
        <div className="panel-header">
          <h3>{t.nav.files}</h3>
          <input
            type="text"
            placeholder={uiLanguage === 'en' ? 'Search files...' : uiLanguage === 'zh-Hant' ? '搜尋文件...' : '搜索文件...'}
            value={fileSearchText}
            onChange={(e) => setFileSearchText(e.target.value)}
            className="panel-search"
          />
          <div className="file-filter-tabs">
            {['all', 'video', 'audio', 'image', 'lyric'].map(type => (
              <button
                key={type}
                className={fileFilterType === type ? 'active' : ''}
                onClick={() => setFileFilterType(type)}
              >
                {type === 'all' ? t.bgAll : getFileTypeName(type)}
              </button>
            ))}
          </div>
          <button className="btn primary import-btn" onClick={handleImportFiles}>
            {uiLanguage === 'en' ? '+ Import files' : uiLanguage === 'zh-Hant' ? '+ 導入文件' : '+ 导入文件'}
          </button>
        </div>
        <div className="panel-content">
          <div className="file-list">
            {filteredFiles.length === 0 ? (
              <div className="empty">
                {files.length === 0
                  ? (uiLanguage === 'en' ? 'No files imported yet' : uiLanguage === 'zh-Hant' ? '還沒有導入文件' : '还没有导入文件')
                  : (uiLanguage === 'en' ? 'No matching files' : uiLanguage === 'zh-Hant' ? '未找到匹配的文件' : '未找到匹配的文件')}
              </div>
            ) : (
              filteredFiles.map(file => (
                <div
                  key={file.id}
                  className="file-item"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setFileRightClickMenu({ x: e.clientX, y: e.clientY, file });
                  }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, file, 'file')}
                >
                  <span className="file-icon">{getFileTypeIcon(file.type)}</span>
                  <span className="file-name">{file.name}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 第三栏：编辑栏（复用） */}
      {renderEditPanel()}

      {/* 第四栏：展示栏（复用） */}
      {renderDisplayPanel()}
    </div>
  );

  // ===== 背景管理状态 =====
  const [bgFilterType, setBgFilterType] = useState('all'); // all | static | dynamic

  // 导入自定义背景
  const handleImportBackground = async () => {
    try {
      const result = await electronAPI.openFileDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Images & Videos', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] },
          { name: 'Videos', extensions: ['mp4', 'webm', 'mov'] },
        ]
      });

      if (result && result.filePaths && result.filePaths.length > 0) {
        const newBackgrounds = result.filePaths.map((path, idx) => {
          const name = path.split('/').pop();
          const ext = path.split('.').pop()?.toLowerCase() || '';
          const videoExtensions = ['mp4', 'webm', 'mov', 'mkv', 'avi'];
          const isVideo = videoExtensions.includes(ext);
          return {
            id: `bg_custom_${Date.now()}_${idx}`,
            name,
            type: isVideo ? 'video' : 'image',
            url: `local-file://${path}`,
            filePath: path,
            isCustom: true,
          };
        });
        setCustomBackgrounds([...customBackgrounds, ...newBackgrounds]);
      }
    } catch (err) {
      console.error('Failed to import backgrounds:', err);
    }
  };

  // 过滤背景
  const filteredBackgrounds = useMemo(() => {
    const all = [...defaultBackgrounds, ...customBackgrounds];
    if (bgFilterType === 'all') return all;
    if (bgFilterType === 'static') return all.filter(b => b.type === 'image');
    if (bgFilterType === 'dynamic') return all.filter(b => b.type === 'video' || b.type === 'dynamic');
    return all;
  }, [customBackgrounds, bgFilterType]);

  const renderBackgroundsPage = () => (
    <div className="four-panel-layout">
      {/* 第一栏：项目栏（复用） */}
      {renderProjectPanel()}

      {/* 第二栏：背景管理 */}
      <div className="panel panel-2">
        <div className="panel-header">
          <h3>{t.nav.backgrounds}</h3>
          <div className="bg-filter-tabs">
            {[
              { key: 'all', label: t.bgAll },
              { key: 'static', label: t.bgStatic },
              { key: 'dynamic', label: t.bgDynamic },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={bgFilterType === key ? 'active' : ''}
                onClick={() => setBgFilterType(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="btn primary import-btn" onClick={handleImportBackground}>
            {t.importBackground}
          </button>
        </div>
        <div className="panel-content">
          <div className="background-grid">
            {filteredBackgrounds.map((bg, idx) => (
              <div
                key={bg.id || idx}
                className={`bg-item ${currentBackgroundId === bg.id ? 'selected' : ''}`}
                onClick={() => {
                  setCurrentBackgroundId(bg.id);
                  // 保存背景到当前项目
                  if (selectedProject) {
                    const updatedProject = {
                      ...selectedProject,
                      backgroundId: bg.id
                    };
                    setSelectedProject(updatedProject);
                    setProjects(projects.map(p =>
                      p.id === selectedProject.id ? updatedProject : p
                    ));
                    localStorage.setItem('jiayan_projects', JSON.stringify(
                      projects.map(p => p.id === selectedProject.id ? updatedProject : p)
                    ));
                  }
                  if (isProjectionActive) updateProjection();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setBgRightClickMenu({ x: e.clientX, y: e.clientY, background: bg });
                }}
              >
                {bg.type === 'image' && bg.url ? (
                  <div className="bg-preview" style={{
                    backgroundImage: `url(${bg.url})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }} />
                ) : bg.type === 'video' && bg.url ? (
                  <div className="bg-preview video-preview">
                    <video
                      src={bg.url}
                      muted
                      loop
                      playsInline
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      onMouseEnter={(e) => e.target.play().catch(() => {})}
                      onMouseLeave={(e) => e.target.pause()}
                    />
                    <div className="video-badge">{uiLanguage === 'en' ? '🎬 Video' : uiLanguage === 'zh-Hant' ? '🎬 影片' : '🎬 视频'}</div>
                  </div>
                ) : bg.type === 'dynamic' ? (
                  <div className="bg-preview dynamic-preview" style={{
                    background: bg.backgroundColor || '#333'
                  }}>
                    <span>✨</span>
                  </div>
                ) : (
                  <div className="bg-preview none-preview">
                    <span>{uiLanguage === 'en' ? 'None' : uiLanguage === 'zh-Hant' ? '無' : '无'}</span>
                  </div>
                )}
                <span className="bg-name">{bg.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 第三栏：编辑栏（复用） */}
      {renderEditPanel()}

      {/* 第四栏：展示栏（复用） */}
      {renderDisplayPanel()}
    </div>
  );

  // ===== 通知状态 =====
  const [notifications, setNotifications] = useState([]);
  const [notificationText, setNotificationText] = useState('');
  const [notificationFontSize, setNotificationFontSize] = useState(48);

  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragOverPanel1, setIsDragOverPanel1] = useState(false);
  const [rightClickMenu, setRightClickMenu] = useState(null); // { x, y, projectId }
  const [projectNotes, setProjectNotes] = useState({}); // { projectId: note }

  // ===== 幻灯片编辑右键菜单 =====
  const [slideRightClickMenu, setSlideRightClickMenu] = useState(null); // { x, y, slideIndex }
  const [clipboardSlide, setClipboardSlide] = useState(null); // { content, operation: 'copy'|'cut' }
  const [cutSlideIndex, setCutSlideIndex] = useState(null);
  const [deletedSlidesHistory, setDeletedSlidesHistory] = useState([]); // [{ index, content }]

  // ===== 文件右键菜单 =====
  const [fileRightClickMenu, setFileRightClickMenu] = useState(null); // { x, y, file }
  const [selectedFileForMenu, setSelectedFileForMenu] = useState(null);

  // ===== 诗歌库右键菜单 =====
  const [songRightClickMenu, setSongRightClickMenu] = useState(null); // { x, y, song }

  // ===== 背景右键菜单 =====
  const [bgRightClickMenu, setBgRightClickMenu] = useState(null); // { x, y, background }

  // ===== 幻灯片右键菜单处理 =====
  const copySlide = (slideIndex) => {
    setClipboardSlide({ content: selectedSong.slides[slideIndex], operation: 'copy' });
    setCutSlideIndex(null);
    setSlideRightClickMenu(null);
  };

  const cutSlide = (slideIndex) => {
    setClipboardSlide({ content: selectedSong.slides[slideIndex], operation: 'cut' });
    setCutSlideIndex(slideIndex);
    setSlideRightClickMenu(null);
  };

  const pasteSlide = (targetIndex) => {
    if (!clipboardSlide) return;

    const newSlides = [...selectedSong.slides];

    if (clipboardSlide.operation === 'cut' && cutSlideIndex !== null) {
      const sourceIndex = cutSlideIndex < targetIndex ? cutSlideIndex : cutSlideIndex;
      const adjustedTarget = cutSlideIndex < targetIndex ? targetIndex - 1 : targetIndex;
      newSlides.splice(sourceIndex, 1);
      newSlides.splice(adjustedTarget, 0, clipboardSlide.content);
      setCutSlideIndex(null);
    } else {
      newSlides.splice(targetIndex, 0, clipboardSlide.content);
    }

    setSelectedSong({ ...selectedSong, slides: newSlides });
    if (selectedProject) {
      const updatedProject = { ...selectedProject, slides: newSlides };
      setSelectedProject(updatedProject);
      setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
    }
    setCurrentSlideIndex(targetIndex);
    setSlideRightClickMenu(null);
  };

  const deleteSlideFromMenu = (slideIndex) => {
    if (selectedSong.slides.length <= 1) {
      alert(uiLanguage === 'en' ? 'Keep at least one slide' : uiLanguage === 'zh-Hant' ? '至少保留一頁幻燈片！' : '至少保留一页幻灯片！');
      setSlideRightClickMenu(null);
      return;
    }

    if (confirm(uiLanguage === 'en' ? `Delete slide ${slideIndex + 1}?` : uiLanguage === 'zh-Hant' ? `確定要刪除第 ${slideIndex + 1} 頁嗎？` : `确定要删除第 ${slideIndex + 1} 页吗？`)) {
      const newSlides = selectedSong.slides.filter((_, idx) => idx !== slideIndex);
      const newIndex = Math.min(currentSlideIndex, newSlides.length - 1);
      setSelectedSong({ ...selectedSong, slides: newSlides });
      setCurrentSlideIndex(newIndex);
      if (selectedProject) {
        const updatedProject = { ...selectedProject, slides: newSlides };
        setSelectedProject(updatedProject);
        setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
      }
      setDeletedSlidesHistory([
        ...deletedSlidesHistory,
        { index: slideIndex, content: selectedSong.slides[slideIndex] }
      ]);
    }
    setSlideRightClickMenu(null);
  };

  // ===== 键盘快捷键 =====
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 如果焦点在输入框或文本域中，不处理快捷键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // F5 键：开始/停止投影
      if (e.key === 'F5') {
        e.preventDefault();
        if (!isProjectionActive) {
          syncToProjection();
        } else {
          electronAPI.stopProjection();
          setIsProjectionActive(false);
          if (currentSharingId) {
            stopShareAndRestore();
          }
        }
        return;
      }

      // F6 键：切换到应用分享
      if (e.key === 'F6') {
        e.preventDefault();
        if (!isProjectionActive) {
          alert(uiLanguage === 'en' ? 'Please start projection first' : uiLanguage === 'zh-Hant' ? '請先開始投屏' : '请先开始投影');
          return;
        }
        if (!currentSharingId) {
          if (!selectedSourceId) {
            alert(uiLanguage === 'en' ? 'Please choose a share source first' : uiLanguage === 'zh-Hant' ? '請先選擇投屏源' : '请先选择投屏源');
            return;
          }
          startAppSharing();
        } else {
          stopShareAndRestore();
        }
        return;
      }

      // F7 键：实时同步/取消同步
      if (e.key === 'F7') {
        e.preventDefault();
        if (!isProjectionActive) {
          alert(uiLanguage === 'en' ? 'Please start projection first' : uiLanguage === 'zh-Hant' ? '請先開始投屏' : '请先开始投影');
          return;
        }
        if (isProjectionLocked) {
          setIsProjectionLocked(false);
        } else {
          setIsProjectionLocked(true);
          setLockedSlideIndex(currentSlideIndex);
        }
        return;
      }

      // F8 键：锁定/解锁投影
      if (e.key === 'F8') {
        e.preventDefault();
        if (!isProjectionActive) {
          alert(uiLanguage === 'en' ? 'Please start projection first' : uiLanguage === 'zh-Hant' ? '請先開始投屏' : '请先开始投影');
          return;
        }
        setIsProjectionLocked(!isProjectionLocked);
        if (!isProjectionLocked) {
          setLockedSlideIndex(currentSlideIndex);
        }
        return;
      }

      // ESC 键退出投屏或应用分享
      if (e.key === 'Escape') {
        if (currentSharingId) {
          stopShareAndRestore();
          return;
        }
        if (isProjectionActive) {
          electronAPI.stopProjection();
          setIsProjectionActive(false);
          return;
        }
      }

      if (!selectedSong) return;

      // Ctrl+S / Cmd+S: 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentEdit();
        return;
      }

      // Delete / Backspace: 删除当前幻灯片（需要确认）
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedSong.slides.length > 1) {
          if (confirm(`确定要删除第 ${currentSlideIndex + 1} 页吗？`)) {
            const newSlides = selectedSong.slides.filter((_, idx) => idx !== currentSlideIndex);
            const newIndex = Math.min(currentSlideIndex, newSlides.length - 1);
            setSelectedSong({ ...selectedSong, slides: newSlides });
            setCurrentSlideIndex(newIndex);
            if (selectedProject) {
              const updatedProject = { ...selectedProject, slides: newSlides };
              setSelectedProject(updatedProject);
              setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
            }
            // 保存删除历史用于恢复
            setDeletedSlidesHistory([
              ...deletedSlidesHistory,
              { index: currentSlideIndex, content: selectedSong.slides[currentSlideIndex] }
            ]);
          }
        }
        e.preventDefault();
        return;
      }

      // Ctrl+Z / Cmd+Z: 恢复最近删除的幻灯片
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (deletedSlidesHistory.length > 0) {
          const lastDeleted = deletedSlidesHistory[deletedSlidesHistory.length - 1];
          const newSlides = [...selectedSong.slides];
          newSlides.splice(lastDeleted.index, 0, lastDeleted.content);
          setSelectedSong({ ...selectedSong, slides: newSlides });
          setCurrentSlideIndex(lastDeleted.index);
          if (selectedProject) {
            const updatedProject = { ...selectedProject, slides: newSlides };
            setSelectedProject(updatedProject);
            setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
          }
          setDeletedSlidesHistory(deletedSlidesHistory.slice(0, -1));
        }
        e.preventDefault();
        return;
      }

      // Ctrl+C / Cmd+C: 复制当前幻灯片
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
        setClipboardSlide({ content: selectedSong.slides[currentSlideIndex], operation: 'copy' });
        setCutSlideIndex(null);
        e.preventDefault();
        return;
      }

      // Ctrl+X / Cmd+X: 剪切当前幻灯片
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && !e.shiftKey) {
        setClipboardSlide({ content: selectedSong.slides[currentSlideIndex], operation: 'cut' });
        setCutSlideIndex(currentSlideIndex);
        e.preventDefault();
        return;
      }

      // Ctrl+V / Cmd+V: 粘贴幻灯片
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !e.shiftKey) {
        if (clipboardSlide) {
          const newSlides = [...selectedSong.slides];

          if (clipboardSlide.operation === 'cut' && cutSlideIndex !== null) {
            const sourceIndex = cutSlideIndex < currentSlideIndex ? cutSlideIndex : cutSlideIndex;
            const adjustedTarget = cutSlideIndex < currentSlideIndex ? currentSlideIndex : currentSlideIndex + 1;
            newSlides.splice(sourceIndex, 1);
            newSlides.splice(adjustedTarget, 0, clipboardSlide.content);
            setCutSlideIndex(null);
            setCurrentSlideIndex(adjustedTarget);
          } else {
            newSlides.splice(currentSlideIndex + 1, 0, clipboardSlide.content);
            setCurrentSlideIndex(currentSlideIndex + 1);
          }

          setSelectedSong({ ...selectedSong, slides: newSlides });
          if (selectedProject) {
            const updatedProject = { ...selectedProject, slides: newSlides };
            setSelectedProject(updatedProject);
            setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
          }
        }
        e.preventDefault();
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentSlideIndex > 0) {
          const newIndex = currentSlideIndex - 1;
          setCurrentSlideIndex(newIndex);
          if (isProjectionActive && !isProjectionLocked) {
            setLockedSlideIndex(newIndex);
            // 只在真正需要时才更新投影
            const songToUse = selectedSong || (selectedProject?.type === PROJECT_TYPES.SONG ? selectedProject : null);
            if (songToUse) {
              electronAPI.updateLyrics({
                song: songToUse,
                slideIndex: newIndex,
                theme: currentTheme,
                background: currentBackground
              });
            }
          }
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentSlideIndex < selectedSong.slides.length - 1) {
          const newIndex = currentSlideIndex + 1;
          setCurrentSlideIndex(newIndex);
          if (isProjectionActive && !isProjectionLocked) {
            setLockedSlideIndex(newIndex);
            // 只在真正需要时才更新投影
            const songToUse = selectedSong || (selectedProject?.type === PROJECT_TYPES.SONG ? selectedProject : null);
            if (songToUse) {
              electronAPI.updateLyrics({
                song: songToUse,
                slideIndex: newIndex,
                theme: currentTheme,
                background: currentBackground
              });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex, selectedSong, currentSharingId, isProjectionActive, isProjectionLocked, selectedProject, currentTheme, currentBackground, deletedSlidesHistory, clipboardSlide, cutSlideIndex, projects]);

  // 保存通知历史
  const saveNotification = (text) => {
    if (!text.trim()) return;
    const newNotification = {
      id: `notification_${Date.now()}`,
      text: text.trim(),
      createdAt: Date.now(),
    };
    setNotifications([newNotification, ...notifications.slice(0, 49)]);
  };

  // 数据包导入后更新诗歌
  const handleSongsImported = (importedSongs) => {
    if (!importedSongs || importedSongs.length === 0) return;
    // 合并导入的诗歌到当前列表（去重）
    const existingIds = new Set(songs.map((s) => String(s.id)));
    const newSongs = importedSongs.filter((s) => !existingIds.has(String(s.id)));
    if (newSongs.length > 0) {
      const merged = [...newSongs, ...songs];
      setSongs(merged);
    }
  };

  // 显示通知
  // 旧函数保留但不再使用，使用 toggleNotification 代替

  // ===== 工具显示/隐藏函数 =====
  const toggleNotification = () => {
    if (isNotificationShowing) {
      electronAPI.hideNotification();
      setIsNotificationShowing(false);
    } else {
      if (!notificationText.trim()) {
        alert(uiLanguage === 'en' ? 'Please enter notice text' : uiLanguage === 'zh-Hant' ? '請輸入通知內容' : '请输入通知内容');
        return;
      }
      saveNotification(notificationText);
      electronAPI.showNotification({
        text: notificationText,
        fontSize: notificationFontSize,
        theme: currentTheme,
        show: true
      });
      setIsNotificationShowing(true);
    }
  };

  const toggleCountdown = () => {
    if (isCountdownShowing) {
      electronAPI.hideCountdown();
      setIsCountdownShowing(false);
    } else {
      setIsCountdownShowing(true);
      const totalSeconds = countdownMinutes * 60 + countdownSeconds;
      electronAPI.showCountdown({
        text: formatTime(totalSeconds),
        show: true
      });
    }
  };

  const toggleClock = () => {
    if (isClockShowing) {
      electronAPI.hideClock();
      setIsClockShowing(false);
    } else {
      electronAPI.showClock();
      setIsClockShowing(true);
    }
  };

  // ===== 倒计时函数 =====
  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const updateCountdownDisplay = () => {
    const total = countdownMinutes * 60 + countdownSeconds;
    setCountdownDisplay(formatTime(total));
    // 如果倒计时正在显示，更新显示
    if (isCountdownShowing) {
      electronAPI.showCountdown({
        text: formatTime(total),
        show: true
      });
    }
  };

  const startCountdown = () => {
    const totalSeconds = countdownMinutes * 60 + countdownSeconds;
    if (totalSeconds <= 0) {
      alert(uiLanguage === 'en' ? 'Please set a countdown time' : uiLanguage === 'zh-Hant' ? '請設定倒計時時間' : '请设置倒计时时间');
      return;
    }
    setCountdownRemaining(totalSeconds);
    setIsCountdownRunning(true);

    // 确保倒计时正在显示
    if (!isCountdownShowing) {
      setIsCountdownShowing(true);
    }
    electronAPI.showCountdown({
      text: formatTime(totalSeconds),
      show: true
    });

    const interval = setInterval(() => {
      setCountdownRemaining(prev => {
        const newRemaining = prev - 1;
        if (newRemaining <= 0) {
          clearInterval(interval);
          setIsCountdownRunning(false);
          setCountdownInterval(null);
          // 倒计时结束
          electronAPI.showCountdown({
            text: '时间到！',
            show: true
          });
          return 0;
        }
        // 更新显示
        if (isCountdownShowing) {
          electronAPI.showCountdown({
            text: formatTime(newRemaining),
            show: true
          });
        }
        return newRemaining;
      });
    }, 1000);
    setCountdownInterval(interval);
  };

  const pauseCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }
    setIsCountdownRunning(false);
  };

  const resetCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
    }
    setIsCountdownRunning(false);
    setCountdownRemaining(0);
    updateCountdownDisplay();
  };

  // 更新倒计时显示
  useEffect(() => {
    updateCountdownDisplay();
  }, [countdownMinutes, countdownSeconds]);

  // 清理倒计时 interval
  useEffect(() => {
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [countdownInterval]);

  // 时钟预览实时更新
  const [currentClockTime, setCurrentClockTime] = useState('');
  useEffect(() => {
    if (currentNav !== 'notifications') return;

    const updateClock = () => {
      setCurrentClockTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [currentNav]);

  // 使用历史通知
  const useNotification = (notification) => {
    setNotificationText(notification.text);
  };

  // 删除历史通知
  const deleteNotification = (id, e) => {
    e.stopPropagation();
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const renderNotificationsPage = () => {
    const toolCopy = {
      title: uiLanguage === 'en' ? 'Notice' : uiLanguage === 'zh-Hant' ? '通知' : '通知',
      placeholder: uiLanguage === 'en' ? 'Enter the notice text...' : uiLanguage === 'zh-Hant' ? '輸入要顯示的通知內容...' : '输入要显示的通知内容...',
      fontSize: uiLanguage === 'en' ? 'Font size' : uiLanguage === 'zh-Hant' ? '字體大小' : '字体大小',
      addNotice: uiLanguage === 'en' ? 'Show notice' : uiLanguage === 'zh-Hant' ? '添加通知' : '添加通知',
      removeNotice: uiLanguage === 'en' ? 'Hide notice' : uiLanguage === 'zh-Hant' ? '移除通知' : '移除通知',
      countdown: uiLanguage === 'en' ? 'Countdown' : uiLanguage === 'zh-Hant' ? '倒計時' : '倒计时',
      minutes: uiLanguage === 'en' ? 'Minutes' : uiLanguage === 'zh-Hant' ? '分鐘' : '分钟',
      seconds: uiLanguage === 'en' ? 'Seconds' : uiLanguage === 'zh-Hant' ? '秒' : '秒',
      start: uiLanguage === 'en' ? 'Start' : uiLanguage === 'zh-Hant' ? '開始' : '开始',
      pause: uiLanguage === 'en' ? 'Pause' : uiLanguage === 'zh-Hant' ? '暫停' : '暂停',
      reset: uiLanguage === 'en' ? 'Reset' : uiLanguage === 'zh-Hant' ? '重置' : '重置',
      addCountdown: uiLanguage === 'en' ? 'Show countdown' : uiLanguage === 'zh-Hant' ? '添加倒計時' : '添加倒计时',
      removeCountdown: uiLanguage === 'en' ? 'Hide countdown' : uiLanguage === 'zh-Hant' ? '移除倒計時' : '移除倒计时',
      clock: uiLanguage === 'en' ? 'Clock' : uiLanguage === 'zh-Hant' ? '時鐘' : '时钟',
      clockHint: uiLanguage === 'en' ? 'The clock appears in the top-right corner of the projection.' : uiLanguage === 'zh-Hant' ? '時鐘將顯示在投屏頁面右上角' : '时钟将显示在投屏页面右上角',
      addClock: uiLanguage === 'en' ? 'Show clock' : uiLanguage === 'zh-Hant' ? '添加時鐘' : '添加时钟',
      removeClock: uiLanguage === 'en' ? 'Hide clock' : uiLanguage === 'zh-Hant' ? '移除時鐘' : '移除时钟',
      history: uiLanguage === 'en' ? 'Notice history' : uiLanguage === 'zh-Hant' ? '歷史通知' : '历史通知',
      emptyHistory: uiLanguage === 'en' ? 'No notice history yet' : uiLanguage === 'zh-Hant' ? '暫無歷史通知' : '暂无历史通知',
    };

    return (
      <div className="tools-single-layout">
      {/* 左侧：三个工具卡片 */}
      <div className="tools-left-section">
        {/* 通知工具 */}
        <div className="tool-card">
          <div className="tool-card-header">
            <h3 className="tool-card-title">{toolCopy.title}</h3>
          </div>
          <div className="tool-card-body">
            <textarea
              className="tool-textarea"
              placeholder={toolCopy.placeholder}
              value={notificationText}
              onChange={(e) => setNotificationText(e.target.value)}
              rows={4}
            />
            <div className="tool-setting-row">
              <label className="tool-label">{toolCopy.fontSize}</label>
              <div className="tool-slider-row">
                <input
                  type="range"
                  className="tool-slider"
                  min="24"
                  max="96"
                  value={notificationFontSize}
                  onChange={(e) => setNotificationFontSize(Number(e.target.value))}
                />
                <span className="tool-value">{notificationFontSize}px</span>
              </div>
            </div>
          </div>
          <div className="tool-card-footer">
            <button
              className={`tool-btn ${isNotificationShowing ? 'tool-btn-danger' : 'tool-btn-primary'}`}
              onClick={toggleNotification}
            >
              {isNotificationShowing ? toolCopy.removeNotice : toolCopy.addNotice}
            </button>
          </div>
        </div>

        {/* 倒计时工具 */}
        <div className="tool-card">
          <div className="tool-card-header">
            <h3 className="tool-card-title">{toolCopy.countdown}</h3>
          </div>
          <div className="tool-card-body">
            <div className="countdown-display">
              <div className="countdown-time">{isCountdownRunning ? formatTime(countdownRemaining) : countdownDisplay}</div>
            </div>
            <div className="countdown-inputs-row">
              <div className="countdown-input-group">
                <label className="tool-label">{toolCopy.minutes}</label>
                <input
                  type="number"
                  className="tool-input"
                  min="0"
                  max="99"
                  value={countdownMinutes}
                  onChange={(e) => setCountdownMinutes(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
                  disabled={isCountdownRunning}
                />
              </div>
              <div className="countdown-input-group">
                <label className="tool-label">{toolCopy.seconds}</label>
                <input
                  type="number"
                  className="tool-input"
                  min="0"
                  max="59"
                  value={countdownSeconds}
                  onChange={(e) => setCountdownSeconds(Math.max(0, Math.min(59, Number(e.target.value) || 0)))}
                  disabled={isCountdownRunning}
                />
              </div>
            </div>
            <div className="countdown-actions-row">
              {!isCountdownRunning ? (
                <button className="tool-btn tool-btn-primary" onClick={startCountdown} style={{ flex: 1 }}>
                  {toolCopy.start}
                </button>
              ) : (
                <button className="tool-btn" onClick={pauseCountdown} style={{ flex: 1 }}>
                  {toolCopy.pause}
                </button>
              )}
              <button className="tool-btn tool-btn-danger" onClick={resetCountdown} style={{ flex: 1 }}>
                {toolCopy.reset}
              </button>
            </div>
          </div>
          <div className="tool-card-footer">
            <button
              className={`tool-btn ${isCountdownShowing ? 'tool-btn-danger' : 'tool-btn-primary'}`}
              onClick={toggleCountdown}
            >
              {isCountdownShowing ? toolCopy.removeCountdown : toolCopy.addCountdown}
            </button>
          </div>
        </div>

        {/* 时钟工具 */}
        <div className="tool-card">
          <div className="tool-card-header">
            <h3 className="tool-card-title">{toolCopy.clock}</h3>
          </div>
          <div className="tool-card-body">
            <div className="clock-display">
              <div className="clock-time">
                {currentClockTime || new Date().toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
            </div>
            <p className="tool-hint">{toolCopy.clockHint}</p>
          </div>
          <div className="tool-card-footer">
            <button
              className={`tool-btn ${isClockShowing ? 'tool-btn-danger' : 'tool-btn-primary'}`}
              onClick={toggleClock}
            >
              {isClockShowing ? toolCopy.removeClock : toolCopy.addClock}
            </button>
          </div>
        </div>
      </div>

      {/* 右侧：历史通知 */}
      <div className="tools-right-section">
        <div className="history-card">
          <div className="history-card-header">
            <h3>{toolCopy.history}</h3>
          </div>
          <div className="history-card-body">
            {notifications.length === 0 ? (
              <div className="history-empty">{toolCopy.emptyHistory}</div>
            ) : (
              <div className="history-list">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="history-item"
                    onClick={() => useNotification(n)}
                  >
                    <span className="history-text">{n.text}</span>
                    <button
                      className="history-delete-btn"
                      onClick={(e) => deleteNotification(n.id, e)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .tools-single-layout {
          display: flex;
          flex: 1;
          padding: 24px;
          gap: 24px;
          background: #f5f5f5;
        }

        .tools-left-section {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          flex: 2;
        }

        .tools-right-section {
          flex: 1;
          min-width: 280px;
        }

        .tool-card {
          background: #ffffff;
          border: 1px solid #000000;
          border-radius: 0px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .tool-card-header {
          padding: 16px;
          border-bottom: 1px solid #000000;
          background: #f5f5f5;
        }

        .tool-card-title {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          text-align: center;
          color: #000000;
        }

        .tool-card-body {
          padding: 16px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .tool-card-footer {
          padding: 16px;
          border-top: 1px solid #000000;
          background: #f5f5f5;
        }

        .tool-textarea {
          width: 100%;
          min-height: 96px;
          padding: 12px;
          border: 1px solid #000000;
          border-radius: 0px;
          background: #ffffff;
          color: #000000;
          font-size: 14px;
          box-sizing: border-box;
          resize: vertical;
        }

        .tool-textarea:focus {
          outline: none;
          border-color: #000000;
        }

        .tool-setting-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tool-label {
          font-size: 13px;
          color: #666666;
          font-weight: 500;
        }

        .tool-slider-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .tool-slider {
          flex: 1;
          height: 8px;
          -webkit-appearance: none;
          background: #e5e5e5;
          border-radius: 0px;
        }

        .tool-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          background: #323341;
          border-radius: 0px;
          cursor: pointer;
        }

        .tool-value {
          min-width: 56px;
          text-align: right;
          font-size: 14px;
          font-weight: 500;
          color: #000000;
        }

        .tool-input {
          width: 100%;
          height: 56px;
          padding: 0;
          border: 1px solid #000000;
          border-radius: 0px;
          background: #ffffff;
          color: #000000;
          font-size: 24px;
          text-align: center;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 56px;
        }

        .tool-input:focus {
          outline: none;
          border-color: #000000;
        }

        .tool-input:disabled {
          background: #e5e5e5;
          color: #999999;
        }

        .tool-btn {
          width: 100%;
          height: 40px;
          padding: 0 16px;
          border: 1px solid #000000;
          border-radius: 0px;
          background: #ffffff;
          color: #000000;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          box-sizing: border-box;
        }

        .tool-btn:hover {
          background: #f5f5f5;
        }

        .tool-btn-primary {
          background: #323341;
          color: #ffffff;
        }

        .tool-btn-primary:hover {
          background: #454658;
        }

        .tool-btn-danger {
          background: #323341;
          color: #ffffff;
        }

        .tool-btn-danger:hover {
          background: #454658;
        }

        .countdown-display {
          background: #323341;
          padding: 24px 16px;
          border-radius: 0px;
          text-align: center;
        }

        .countdown-time {
          font-size: 40px;
          font-weight: 500;
          color: #ffffff;
          font-family: monospace;
          letter-spacing: 4px;
        }

        .countdown-inputs-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .countdown-input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .countdown-input-group .tool-label {
          text-align: center;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          position: relative;
          left: -8px;
        }

        .countdown-actions-row {
          display: flex;
          gap: 8px;
        }

        .clock-display {
          background: #323341;
          padding: 24px 16px;
          border-radius: 0px;
          text-align: center;
        }

        .clock-time {
          font-size: 40px;
          font-weight: 500;
          color: #ffffff;
          font-family: monospace;
          letter-spacing: 4px;
        }

        .tool-hint {
          margin: 0;
          font-size: 13px;
          color: #666666;
          text-align: center;
        }

        .history-card {
          background: #ffffff;
          border: 1px solid #000000;
          border-radius: 0px;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .history-card-header {
          padding: 16px;
          border-bottom: 1px solid #000000;
          background: #f5f5f5;
        }

        .history-card-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          color: #000000;
        }

        .history-card-body {
          padding: 16px;
          flex: 1;
          overflow-y: auto;
        }

        .history-empty {
          text-align: center;
          color: #999999;
          padding: 32px 16px;
          font-size: 14px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 12px;
          background: #f5f5f5;
          border: 1px solid #cccccc;
          border-radius: 0px;
          cursor: pointer;
        }

        .history-item:hover {
          border-color: #000000;
          background: #e5e5e5;
        }

        .history-text {
          flex: 1;
          font-size: 14px;
          color: #000000;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-delete-btn {
          width: 24px;
          height: 24px;
          padding: 0;
          border: none;
          border-radius: 0px;
          background: transparent;
          color: #666666;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .history-delete-btn:hover {
          background: #323341;
          color: #ffffff;
        }

        .notification-input-section-small label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 13px;
        }

        .notification-textarea-small {
          width: 100%;
          padding: 10px;
          border: 1px solid #000000;
          border-radius: 0px;
          font-size: 14px;
          resize: none;
          height: 96px;
          box-sizing: border-box;
        }

        .notification-settings-small {
          background: #ffffff;
          padding: 8px 12px;
          border-radius: 0px;
          border: 1px solid #000000;
          height: 56px;
          box-sizing: border-box;
          margin-top: 32px;
          display: flex;
          align-items: center;
        }

        .setting-row-small {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 40px;
          width: 100%;
        }

        .setting-row-small label {
          min-width: 60px;
          font-size: 13px;
          height: 40px;
          display: flex;
          align-items: center;
          color: #666666;
        }

        .setting-row-small input[type="range"] {
          flex: 1;
        }

        .font-size-preview-small {
          min-width: 50px;
          text-align: right;
          font-weight: 500;
          color: #000000;
          font-size: 15px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }

        .countdown-display-small {
          background: #323341;
          border-radius: 0px;
          padding: 24px;
          text-align: center;
          height: 96px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .countdown-time-small {
          font-size: 36px;
          font-weight: 500;
          color: #ffffff;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
        }

        .countdown-settings-small {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .countdown-settings-small .setting-row-small {
          flex: 1;
          flex-direction: column;
          gap: 8px;
          height: auto;
          align-items: center;
        }

        .countdown-settings-small .setting-row-small label {
          height: 56px;
          font-size: 13px;
          text-align: center;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .countdown-input-small {
          width: 100%;
          height: 56px;
          padding: 0 16px;
          border: 1px solid #000000;
          border-radius: 0px;
          font-size: 15px;
          text-align: center;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .countdown-input-small:disabled {
          background: #e5e5e5;
          color: #999999;
        }

        .countdown-actions-small {
          display: flex;
          gap: 8px;
          margin-top: 8px;
        }

        .countdown-actions-small .btn {
          height: 40px;
          padding: 0 16px;
          font-size: 15px;
        }

        .clock-preview {
          background: #323341;
          border-radius: 0px;
          padding: 24px;
          text-align: center;
          height: 96px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .clock-time-small {
          font-size: 36px;
          font-weight: 500;
          color: #ffffff;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
        }

        .tool-hint {
          color: #666666;
          font-size: 13px;
          margin: 16px 0 0 0;
          text-align: center;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .notification-history-small {
          width: 280px;
          background: #ffffff;
          border-radius: 0px;
          border: 1px solid #000000;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }

        .history-header-small h3 {
          margin: 0 0 16px 0;
          font-size: 15px;
          font-weight: 400;
        }

        .history-list-small {
          flex: 1;
          overflow-y: auto;
        }

        .history-item-small {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 0px;
          margin-bottom: 8px;
          cursor: pointer;
        }

        .history-item-small:hover {
          background: #e5e5e5;
        }

        .history-text-small {
          flex: 1;
          font-size: 12px;
          color: #333;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .delete-btn-small {
          border: none;
          background: none;
          color: #666666;
          cursor: pointer;
          padding: 0 2px;
          font-size: 14px;
        }

        .delete-btn-small:hover {
          color: #000000;
        }

        .empty-small {
          color: #999999;
          text-align: center;
          padding: 20px;
          font-size: 13px;
        }

        .btn.small {
          height: 40px;
          padding: 0 16px;
          font-size: 15px;
        }

        .btn.primary {
          background: #323341;
          color: #ffffff;
        }

        .btn.primary:hover {
          background: #454658;
        }

        .btn.danger {
          background: #323341;
          color: #ffffff;
        }

        .btn.danger:hover {
          background: #454658;
        }

        .setting-row-small input[type="range"] {
          -webkit-appearance: none;
          height: 4px;
          border-radius: 0px;
          background: #cccccc;
          outline: none;
        }

        .setting-row-small input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 0px;
          background: #323341;
          cursor: pointer;
        }
      `}</style>
    </div>
    );
  };

  return (
    <div className="full-layout" onClick={() => {
      if (slideRightClickMenu) setSlideRightClickMenu(null);
    }}>
      {renderNav()}

      {currentNav === 'project' && (
        <div className="four-panel-layout">
          {renderProjectPanel()}
          {renderBiblePanel()}
          {renderEditPanel()}
          {renderDisplayPanel()}
        </div>
      )}

      {currentNav === 'songs' && renderSongsPage()}
      {currentNav === 'files' && renderFilesPage()}
      {currentNav === 'backgrounds' && renderBackgroundsPage()}
      {currentNav === 'notifications' && renderNotificationsPage()}

      <style>{`
        .full-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          background: #fafafa;
        }

        .top-nav-full {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          background: #ffffff;
          border-bottom: 1px solid #eeeeee;
          padding: 0 24px;
          color: #000000;
          flex-shrink: 0;
        }

        .nav-brand-full h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .nav-items-full {
          display: flex;
          gap: 8px;
        }

        .nav-items-full button {
          height: 40px;
          padding: 0 16px;
          border: none;
          background: transparent;
          color: #666666;
          border-radius: 0px;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .nav-items-full button:hover {
          background: #fafafa;
          color: #000000;
        }

        .nav-items-full button.active {
          background: #f5f5f5;
          color: #000000;
          font-weight: 500;
        }

        .nav-status-full .status {
          padding: 4px 16px;
          border-radius: 0px;
          font-size: 11px;
          font-weight: 500;
        }

        .nav-status-full .status.active {
          background: #323341;
          color: #ffffff;
        }

        .nav-status-full .status.inactive {
          background: #f5f5f5;
          color: #666666;
        }

        .four-panel-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .panel {
          display: flex;
          flex-direction: column;
          border-right: 1px solid #eeeeee;
          background: #ffffff;
          overflow: hidden;
        }

        .panel:last-child {
          border-right: none;
        }

        .panel-1 { flex: 1.2; min-width: 240px; flex-shrink: 0; }
        .panel-2 { flex: 1.2; min-width: 240px; flex-shrink: 0; }
        .panel-3 { flex: 1.8; min-width: 480px; flex-shrink: 0; }
        .panel-4 { flex: 1.8; min-width: 480px; background: #fafafa; }

        .panel-header {
          padding: 16px;
          background: #ffffff;
          border-bottom: 1px solid #eeeeee;
          box-sizing: border-box;
          min-height: 96px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.4;
          letter-spacing: 0.02em;
          color: #000000;
          height: 40px;
          display: flex;
          align-items: center;
        }

        .panel-search {
          width: 100%;
          height: 40px;
          padding: 0 16px;
          border: 1px solid #000000;
          border-radius: 0px;
          font-size: 15px;
          box-sizing: border-box;
          background: #ffffff;
        }

        .new-project-btn {
          width: 100%;
          height: 40px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 500;
        }

        .btn.primary {
          background: #323341;
          color: #ffffff;
        }

        .btn.primary:hover {
          background: #454658;
        }

        .btn.danger {
          background: #323341;
          color: #ffffff;
        }

        .btn.danger:hover {
          background: #454658;
        }

        .quick-search-btn {
          width: 100%;
          height: 40px;
          padding: 0 16px;
          font-size: 14px;
          font-weight: 500;
          box-sizing: border-box;
        }

        .quick-search-result {
          padding: 16px 0px;
        }

        .quick-search-hint {
          text-align: center;
          padding: 20px;
          background: #f5f5f5;
          border-radius: 0px;
          border: 1px solid #000000;
          margin-bottom: 20px;
        }

        .quick-search-hint p {
          margin: 0 0 12px 0;
          color: #000000;
          font-weight: 400;
        }

        .quick-search-preview {
          font-size: 16px;
          font-weight: 500;
          color: #000000;
        }

        .search-tips {
          background: #f5f5f5;
          padding: 16px;
          border-radius: 0px;
          border: 1px solid #cccccc;
        }

        .search-tips h5 {
          margin: 0 0 12px 0;
          font-size: 12px;
          color: #666666;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .search-tips ul {
          margin: 0;
          padding-left: 20px;
        }

        .search-tips li {
          margin: 8px 0;
          font-size: 13px;
          color: #666666;
        }

        .search-tips code {
          background: #e5e5e5;
          padding: 2px 6px;
          border-radius: 0px;
          font-family: monospace;
          color: #000000;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          border-top: 1px solid #eeeeee;
        }

        .project-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .project-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: transparent;
          border-radius: 0px;
          cursor: pointer;
          border: 1px solid transparent;
          box-sizing: border-box;
          height: 56px;
        }

        .project-item:hover {
          background: #fafafa;
          border-color: #eeeeee;
        }

        .project-item.selected {
          border-color: #000000;
          background: #f5f5f5;
        }

        .project-type-icon {
          font-size: 16px;
          line-height: 1;
        }

        .project-name {
          flex: 1;
          font-weight: 400;
          font-size: 15px;
          line-height: 1.4;
          letter-spacing: -0.01em;
        }

        .project-count {
          font-size: 11px;
          color: #999999;
          line-height: 1;
          background: #f5f5f5;
          padding: 3px 8px;
          border: 1px solid #eeeeee;
          font-weight: 500;
        }

        .bible-books-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .testament-section h4 {
          margin: 0 0 16px 0;
          font-size: 15px;
          color: #000000;
          font-weight: 500;
          letter-spacing: 0.02em;
          height: 40px;
          display: flex;
          align-items: center;
        }

        .book-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        .book-card {
          aspect-ratio: 1;
          background: #fafafa;
          border: none;
          border-radius: 0px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 500;
          color: #000000;
          cursor: pointer;
          transition: 0ms;
          padding: 0;
          max-width: 48px;
          max-height: 48px;
        }

        .book-card:hover {
          background: #f5f5f5;
        }

        .book-card.selected {
          background: #ffffff;
          color: #000000;
          border: 1px solid #000000;
        }

        .chapters-view, .verses-view {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .back-btn {
          align-self: flex-start;
          padding: 0 16px;
          margin-bottom: 16px;
          height: 40px;
          font-size: 15px;
          font-weight: 500;
          border-radius: 0;
          background: #fafafa;
          color: #666666;
          border: 1px solid #000000;
        }

        .back-btn:hover {
          background: #f5f5f5;
          border-color: #000000;
          color: #000000;
        }

        .chapters-view h4, .verses-header h4 {
          margin: 0;
          margin-left: 0;
          font-size: 15px;
          font-weight: 500;
          letter-spacing: -0.01em;
          height: 40px;
          display: flex;
          align-items: center;
        }

        .chapter-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        .verses-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }

        .custom-theme-controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
          padding: 12px;
          background: #f5f5f5;
          border: 1px solid #000000;
          border-radius: 0px;
        }

        .color-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .color-control label {
          min-width: 70px;
          font-size: 13px;
          color: #666666;
          font-weight: 400;
        }

        .color-control input[type="color"] {
          width: 36px;
          height: 36px;
          border-radius: 0px;
          border: 1px solid #000000;
          cursor: pointer;
          padding: 0;
        }

        .color-control .color-value {
          font-size: 12px;
          color: #666666;
          font-family: monospace;
        }

        .right-click-menu {
          position: fixed;
          background: #ffffff;
          border: 1px solid #000000;
          border-radius: 0px;
          box-shadow: none;
          padding: 4px 0;
          min-width: 160px;
          z-index: 9999;
        }

        .right-click-menu-item {
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
          color: #000000;
          transition: background 0ms;
        }

        .right-click-menu-item:hover {
          background: #e5e5e5;
        }

        .right-click-menu-item.danger {
          color: #000000;
        }

        .right-click-menu-item.danger:hover {
          background: #e5e5e5;
        }

        .right-click-menu-divider {
          height: 1px;
          background: #323341;
          margin: 4px 0;
        }

        .chapter-card {
          aspect-ratio: 1;
          background: #fafafa;
          border: none;
          border-radius: 0px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 500;
          color: #000000;
          cursor: pointer;
          transition: 0ms;
          padding: 0;
          max-width: 48px;
          max-height: 48px;
        }

        .chapter-card:hover {
          background: #f5f5f5;
        }

        .chapter-card.selected {
          background: #ffffff;
          color: #000000;
          border: 1px solid #000000;
        }

        .verse-num-item {
          aspect-ratio: 1;
          background: #fafafa;
          border: none;
          border-radius: 0px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 500;
          color: #000000;
          cursor: pointer;
          transition: 0ms;
          padding: 0;
          max-width: 48px;
          max-height: 48px;
        }

        .verse-num-item:hover {
          background: #f5f5f5;
        }

        .verse-num-item.selected {
          background: #ffffff;
          color: #000000;
          border: 1px solid #000000;
        }

        .verses-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 16px;
        }

        .verses-header .panel-actions {
          margin-left: 0;
          width: 100%;
        }

        .verses-header .panel-actions .btn {
          flex: 1;
        }

        .select-mode {
          display: flex;
          gap: 8px;
        }

        .select-mode button {
          padding: 0 16px;
          height: 32px;
          border: 1px solid #000000;
          background: #ffffff;
          border-radius: 0px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
        }

        .select-mode button.active {
          background: #323341;
          color: #ffffff;
          border-color: #000000;
        }

        .verses-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .verse-item {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #fafafa;
          border-radius: 0px;
          cursor: pointer;
          border: 1px solid transparent;
          min-height: 48px;
          box-sizing: border-box;
          align-items: flex-start;
        }

        .verse-item:hover {
          background: #f5f5f5;
          border-color: #eeeeee;
        }

        .verse-item.selected {
          border-color: #000000;
          background: #ffffff;
        }

        .verse-num {
          font-weight: 500;
          color: #000000;
          min-width: 40px;
          background: #ffffff;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0;
          flex-shrink: 0;
          border: 1px solid #eeeeee;
          font-size: 12px;
        }

        .verse-text {
          flex: 1;
          font-size: 13px;
          line-height: 1.7;
          font-weight: 400;
          letter-spacing: -0.01em;
        }

        .verses-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid #eee;
        }

        .selected-count {
          font-size: 13px;
          color: #666;
        }

        .display-select select {
          padding: 6px 10px;
          border: 1px solid #000000;
          border-radius: 0px;
          background: #ffffff;
          color: #000000;
          min-height: 30px;
          box-sizing: border-box;
        }

        .song-detail-header h2 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 500;
        }

        .song-title-input {
          width: 100%;
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 500;
          border: 1px solid #000000;
          border-radius: 0px;
          background: #ffffff;
          color: #000000;
          padding: 8px 16px;
          box-sizing: border-box;
        }

        .song-title-input:focus {
          outline: none;
          border-color: #000000;
        }

        .slides-editor {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .slide-editor-item {
          background: #ffffff;
          border-radius: 0px;
          padding: 12px;
          border: 1px solid #cccccc;
          cursor: pointer;
          aspect-ratio: 2/1;
        }

        .slide-editor-item.active {
          border-color: #000000;
        }

        .slide-number {
          font-weight: 400;
          font-size: 12px;
          color: #000000;
          margin-bottom: 8px;
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
          padding: 8px 10px;
          border: 1px solid #000000;
          border-radius: 0px;
          font-size: 13px;
          resize: vertical;
          box-sizing: border-box;
        }

        .theme-selector {
          margin-top: 20px;
        }

        .theme-selector h4 {
          margin: 0 0 12px 0;
          font-size: 12px;
          font-weight: 500;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .theme-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .theme-chip {
          padding: 6px 12px;
          border-radius: 0px;
          cursor: pointer;
          font-size: 12px;
          border: 1px solid #cccccc;
        }

        .theme-chip.active {
          border-color: #000000;
          background: #323341;
          color: #ffffff;
        }

        /* ===== 重构的自定义主题面板 ===== */
        .custom-theme-panel {
          margin-top: 12px;
          background: #f5f5f5;
          border: 1px solid #cccccc;
          border-radius: 0;
          padding: 16px;
          position: relative;
          z-index: 10;
        }

        .custom-theme-grid {
          display: grid;
          gap: 12px;
        }

        .theme-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .theme-section.colors {
          flex-direction: row;
        }

        .theme-section.bottom {
          flex-direction: row;
          gap: 8px;
          align-items: center;
        }

        .color-picker-row {
          display: flex;
          gap: 12px;
          width: 100%;
        }

        .color-picker-item {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .color-picker-item label {
          font-size: 11px;
          color: #666666;
          font-weight: 500;
          width: 24px;
        }

        .color-picker-item input[type="color"] {
          width: 40px;
          height: 32px;
          border-radius: 0;
          border: 1px solid #cccccc;
          cursor: pointer;
          padding: 0;
          flex: 1;
        }

        .theme-section.sliders {
          gap: 8px;
        }

        .slider-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .slider-control label {
          font-size: 11px;
          color: #666666;
          width: 40px;
          font-weight: 500;
        }

        .slider-control input[type="range"] {
          flex: 1;
          -webkit-appearance: none;
          height: 4px;
          border-radius: 0;
          background: #cccccc;
          outline: none;
        }

        .slider-control input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 0;
          background: #323341;
          cursor: pointer;
        }

        .slider-value {
          font-size: 11px;
          font-weight: 500;
          color: #000000;
          width: 32px;
          text-align: right;
        }

        .alignment-controls {
          display: flex;
          gap: 8px;
        }

        .alignment-btn {
          width: 40px;
          height: 32px;
          border-radius: 0;
          border: 1px solid #cccccc;
          background: #ffffff;
          color: #666666;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: none;
          font-weight: 500;
        }

        .alignment-btn:hover {
          background: #f5f5f5;
        }

        .alignment-btn.active {
          background: #323341;
          border-color: #000000;
          color: #ffffff;
        }

        .theme-section.bottom .font-selector {
          flex: 1;
          height: 32px;
          padding: 0 8px;
          border-radius: 0;
          border: 1px solid #cccccc;
          background: #ffffff;
          font-size: 11px;
          color: #000000;
          cursor: pointer;
          transition: none;
        }

        .theme-section.bottom .font-selector:focus {
          outline: none;
          border-color: #000000;
        }

        /* ===== 编辑栏新布局 ===== */
        .edit-panel-header {
          display: flex;
          flex-direction: row;
          gap: 16px;
          padding: 16px;
        }

        .edit-panel-left {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .edit-panel-right {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .edit-buttons-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 8px;
        }

        .theme-selector-fixed {
          margin-top: 0;
          position: relative;
          z-index: 10;
        }

        .theme-selector-fixed h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 500;
          color: #666666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .theme-selector-fixed .theme-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .theme-selector-fixed .theme-chip {
          flex: 1;
          min-width: 32px;
          padding: 6px 8px;
          text-align: center;
        }

        /* ===== 编辑栏新布局V2 ===== */
        .edit-panel-header-v2 {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
        }

        .edit-row-1, .edit-row-2 {
          display: flex;
          gap: 16px;
          width: 100%;
        }

        .edit-col-50 {
          flex: 1;
          width: 50%;
        }

        .edit-buttons-row-2 {
          display: flex;
          gap: 8px;
          width: 100%;
        }

        .song-title-wrapper {
          width: 100%;
        }

        .song-title-input-2 {
          width: 100%;
          height: 32px;
          padding: 0 12px;
          border: 1px solid #cccccc;
          border-radius: 0;
          background: #ffffff;
          font-size: 13px;
          color: #000000;
          box-sizing: border-box;
        }

        .song-title-input-2:focus {
          outline: none;
          border-color: #000000;
        }

        .theme-selector-compact {
          width: 100%;
        }

        .theme-selector-compact .theme-row-full {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          width: 100%;
        }

        .theme-selector-compact .theme-chip {
          flex: 1;
          min-width: 32px;
          padding: 6px 8px;
          text-align: center;
        }

        .custom-theme-panel-sticky {
          margin-top: 8px;
          background: #f5f5f5;
          border: 1px solid #cccccc;
          border-radius: 0;
          padding: 12px;
          position: relative;
          z-index: 10;
        }

        .edit-panel-content {
          padding-top: 8px;
        }

        /* ===== 调整编辑卡片内的文字编辑区 ===== */
        .slide-editor-item {
          background: #ffffff;
          border-radius: 0px;
          padding: 12px;
          border: 1px solid #cccccc;
          cursor: pointer;
          aspect-ratio: 2/1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slide-editor-item .slide-number {
          font-size: 11px;
          color: #666666;
          margin-bottom: 0;
          height: 20px;
          flex-shrink: 0;
        }

        .slide-editor-item .slide-textarea {
          flex: 1;
          width: 100%;
          min-height: 0;
          padding: 8px 10px;
          border: 1px solid #cccccc;
          border-radius: 0px;
          font-size: 13px;
          resize: none;
          box-sizing: border-box;
        }

        .slide-editor-item .media-preview {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
        }

        /* ===== 编辑栏宽松布局 ===== */
        .edit-panel-header-spacious {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          min-height: auto;
        }

        .edit-row-top, .edit-row-middle, .edit-row-bottom {
          display: flex;
          gap: 16px;
          width: 100%;
        }

        .edit-col-half {
          flex: 1;
          width: 50%;
        }

        .edit-buttons-group {
          display: flex;
          gap: 8px;
          width: 100%;
        }

        .song-title-full {
          width: 100%;
        }

        .song-title-input-spacious {
          width: 100%;
          height: 36px;
          padding: 0 16px;
          border: 1px solid #cccccc;
          border-radius: 0;
          background: #ffffff;
          font-size: 14px;
          color: #000000;
          box-sizing: border-box;
        }

        .song-title-input-spacious:focus {
          outline: none;
          border-color: #000000;
        }

        .theme-selector-spacious {
          width: 100%;
        }

        .theme-selector-spacious .theme-row-wide {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          width: 100%;
        }

        .theme-selector-spacious .theme-chip {
          flex: 1;
          min-width: 40px;
          padding: 8px 12px;
          text-align: center;
        }

        .custom-theme-panel-spacious {
          margin-top: 8px;
          background: #f5f5f5;
          border: 1px solid #cccccc;
          border-radius: 0;
          padding: 16px;
          position: relative;
          z-index: 10;
        }

        .edit-panel-content-spacious {
          padding-top: 8px;
        }

        /* ===== 编辑栏最终布局 ===== */
        .edit-panel-header-final {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          min-height: auto;
        }

        .edit-row-display {
          width: 100%;
        }

        .edit-row-title-buttons {
          display: flex;
          gap: 16px;
          width: 100%;
        }

        .edit-title-col {
          flex: 1;
          width: 50%;
        }

        .edit-buttons-col {
          flex: 1;
          width: 50%;
        }

        .song-title-input-final {
          width: 100%;
          height: 32px;
          padding: 0 12px;
          border: 1px solid #cccccc;
          border-radius: 0;
          background: #ffffff;
          font-size: 13px;
          color: #000000;
          box-sizing: border-box;
        }

        .song-title-input-final:focus {
          outline: none;
          border-color: #000000;
        }

        .edit-three-buttons {
          display: flex;
          gap: 8px;
          width: 100%;
          justify-content: flex-end;
        }

        .edit-three-buttons .btn {
          flex: none;
        }

        .edit-row-theme {
          width: 100%;
        }

        .theme-selector-compact-final {
          width: 100%;
        }

        .theme-selector-compact-final .theme-row-compact {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          width: 100%;
        }

        .theme-selector-compact-final .theme-chip {
          flex: 1;
          min-width: 32px;
          padding: 4px 8px;
          text-align: center;
          font-size: 11px;
        }

        .custom-theme-panel-final {
          margin-top: 8px;
          background: #f5f5f5;
          border: 1px solid #cccccc;
          border-radius: 0;
          padding: 12px;
          position: relative;
          z-index: 10;
        }

        .edit-panel-content-final {
          padding-top: 8px;
        }

        /* ===== 编辑栏截图样式 ===== */
        .edit-panel-header-screenshot {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          min-height: auto;
        }

        .display-select-screenshot {
          width: 50%;
        }

        .display-selector-screenshot {
          width: 100%;
          height: 48px;
          padding: 0 16px;
          border: 2px solid #000000;
          border-radius: 0;
          background: #ffffff;
          font-size: 16px;
          color: #000000;
          box-sizing: border-box;
        }

        .display-selector-screenshot:focus {
          outline: none;
        }

        .edit-buttons-screenshot {
          display: flex;
          gap: 16px;
          width: 100%;
        }

        .btn-screenshot {
          height: 48px;
          border: none;
          border-radius: 0;
          cursor: pointer;
          font-size: 20px;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: inherit;
          flex: 1;
        }

        .btn-save-screenshot {
          background: #323341;
          color: #ffffff;
        }

        .btn-saveas-screenshot {
          background: #f5f5f5;
          color: #000000;
          border: 1px solid #cccccc;
        }

        .btn-clear-screenshot {
          background: #323341;
          color: #ffffff;
        }

        .edit-panel-content-screenshot {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .song-title-section-screenshot {
          width: 100%;
        }

        .song-title-input-screenshot {
          width: 100%;
          height: 64px;
          padding: 0 20px;
          border: 3px solid #000000;
          border-radius: 0;
          background: #ffffff;
          font-size: 24px;
          color: #000000;
          box-sizing: border-box;
        }

        .song-title-input-screenshot:focus {
          outline: none;
        }

        .theme-section-screenshot {
          display: flex;
          align-items: center;
          gap: 24px;
          width: 100%;
          background: #f5f5f5;
          padding: 16px;
          border-radius: 0;
        }

        .theme-label-screenshot {
          font-size: 18px;
          font-weight: 500;
          color: #666666;
          white-space: nowrap;
        }

        .theme-chips-screenshot {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .theme-chip-screenshot {
          width: 64px;
          height: 48px;
          border-radius: 0;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid transparent;
        }

        .theme-chip-screenshot:hover {
          opacity: 0.9;
        }

        .theme-chip-screenshot.active {
          border-color: #000000;
        }

        .custom-theme-panel-screenshot {
          background: #f5f5f5;
          border-radius: 0;
          padding: 16px;
        }

        /* ===== 编辑栏最终版本V2 ===== */
        .edit-panel-header-final-v2 {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          min-height: auto;
        }

        .theme-row-single-line {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
        }

        .theme-label-inline {
          font-size: 12px;
          font-weight: 500;
          color: #666666;
          white-space: nowrap;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .theme-chips-inline {
          display: flex;
          gap: 6px;
          flex-wrap: nowrap;
        }

        .theme-chip-inline {
          flex: 1;
          min-width: 0;
          height: 32px;
          border-radius: 0;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid transparent;
        }

        .theme-chip-inline:hover {
          opacity: 0.9;
        }

        .theme-chip-inline.active {
          border-color: #000000;
        }

        .custom-theme-panel-inline {
          margin-top: 8px;
          background: #f5f5f5;
          border: 1px solid #cccccc;
          border-radius: 0;
          padding: 12px;
          position: relative;
          z-index: 10;
        }

        .edit-panel-content-final-v2 {
          padding-top: 8px;
        }

        .share-selected, .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666666;
        }

        .drop-hint {
          margin-top: 20px;
          color: #999999;
          font-size: 13px;
        }

        .display-tabs {
          display: flex;
          gap: 4px;
        }

        .display-tabs button {
          padding: 6px 14px;
          border: 1px solid #000000;
          background: #ffffff;
          border-radius: 0px;
          cursor: pointer;
          font-size: 13px;
        }

        .display-tabs button.active {
          background: #323341;
          color: #ffffff;
        }

        .live-preview {
          aspect-ratio: 16/9;
          width: 100%;
          border-radius: 0px;
          border: 1px solid #000000;
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
          height: 40px;
          padding: 0 16px;
          border: 1px solid #000000;
          border-radius: 0px;
          cursor: pointer;
          font-size: 14px;
          background: #ffffff;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .control-btn.primary {
          background: #323341;
          color: #ffffff;
        }

        .control-btn.danger {
          background: #323341;
          color: #ffffff;
        }

        .control-btn.sync-btn {
          background: #323341;
          color: #ffffff;
        }

        .control-btn.lock-btn {
          background: #e5e5e5;
          color: #000000;
        }

        .control-btn.lock-btn.locked {
          background: #323341;
          color: #ffffff;
        }

        .display-next, .display-share {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .next-preview {
          aspect-ratio: 16/9;
          width: 100%;
          border-radius: 0px;
          border: 1px solid #000000;
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
          border: 1px solid #000000;
          background: #323341;
          color: #ffffff;
          border-radius: 0px;
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
          background: #ffffff;
          border-radius: 0px;
          padding: 10px;
          cursor: pointer;
          border: 1px solid #cccccc;
        }

        .source-item:hover {
          background: #f5f5f5;
        }

        .source-item.selected {
          border-color: #000000;
        }

        .source-name {
          font-weight: 400;
          margin-bottom: 6px;
        }

        .source-thumb {
          width: 100%;
          border-radius: 0px;
        }

        .song-stats {
          font-size: 12px;
          color: #666;
          text-align: right;
        }

        .song-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .song-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: #fafafa;
          border-radius: 0px;
          cursor: pointer;
          border: 1px solid transparent;
          box-sizing: border-box;
          min-height: 48px;
        }

        .song-item:hover {
          background: #f5f5f5;
          border-color: #eeeeee;
        }

        .song-item.selected {
          border-color: #000000;
          background: #ffffff;
        }

        .song-number {
          font-size: 11px;
          color: #999999;
          min-width: 32px;
          line-height: 1;
          text-align: center;
        }

        .song-title {
          flex: 1;
          font-size: 13px;
          font-weight: 400;
          line-height: 1.4;
          letter-spacing: -0.01em;
          padding-right: 90px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .slide-count {
          position: absolute;
          top: 50%;
          right: 48px;
          transform: translateY(-50%);
          font-size: 11px;
          color: #999999;
          background: #ffffff;
          padding: 3px 8px;
          border-radius: 0;
          font-weight: 500;
          border: 1px solid #eeeeee;
        }

        .song-favorite {
          position: absolute;
          top: 50%;
          right: 16px;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          color: #999999;
          background: none;
          border: none;
          padding: 0;
        }

        .song-favorite:hover {
          transform: translateY(-50%) scale(1.1);
        }

        .song-favorite.active {
          color: #666666;
        }

        .file-filter-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: nowrap;
          margin-bottom: 8px;
          width: 100%;
        }

        .file-filter-tabs button {
          padding: 0;
          height: 30px;
          border: 1px solid #000000;
          background: #ffffff;
          border-radius: 0px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          color: #000000;
          box-sizing: border-box;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .file-filter-tabs button:hover {
          background: #f5f5f5;
          border-color: #000000;
          color: #000000;
        }

        .file-filter-tabs button.active {
          background: #323341;
          color: #ffffff;
          border-color: #000000;
        }

        .import-btn {
          width: 100%;
          height: 40px;
          padding: 0 16px;
          font-size: 13px;
          font-weight: 500;
          box-sizing: border-box;
        }

        .file-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .file-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #fafafa;
          border-radius: 0px;
          cursor: pointer;
          border: 1px solid transparent;
          box-sizing: border-box;
          height: 56px;
        }

        .file-item:hover {
          background: #f5f5f5;
          border-color: #eeeeee;
        }

        .file-item.selected {
          border-color: #000000;
          background: #ffffff;
        }

        .file-icon {
          font-size: 16px;
          line-height: 1;
        }

        .file-name {
          flex: 1;
          font-size: 13px;
          line-height: 1.4;
          font-weight: 400;
          letter-spacing: -0.01em;
        }

        .bg-filter-tabs {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .bg-filter-tabs button {
          flex: 1;
          padding: 6px 8px;
          border: 1px solid #000000;
          background: #ffffff;
          border-radius: 0px;
          font-size: 13px;
          cursor: pointer;
          min-height: 30px;
          box-sizing: border-box;
        }

        .bg-filter-tabs button.active {
          background: #323341;
          color: #ffffff;
          border-color: #000000;
        }

        .background-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .bg-item {
          cursor: pointer;
          border: 2px solid transparent;
          border-radius: 0px;
          overflow: hidden;
        }

        .bg-item.selected {
          border-color: #000000;
        }

        .bg-preview {
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f0f0;
          position: relative;
          overflow: hidden;
        }

        .video-preview video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .video-badge {
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(0, 0, 0, 0.7);
          color: #ffffff;
          padding: 4px 8px;
          border-radius: 0px;
          font-size: 12px;
          font-weight: 500;
        }

        .dynamic-preview {
          font-size: 24px;
        }

        .none-preview {
          font-size: 14px;
          color: #999;
        }

        .bg-name {
          display: block;
          padding: 8px 6px;
          font-size: 12px;
          text-align: center;
          background: #f5f5f5;
        }

        .songs-page, .files-page, .backgrounds-page, .notifications-page {
          flex: 1;
          padding: 40px;
        }

        .empty {
          text-align: center;
          color: #999999;
          padding: 40px;
        }

        .verse-select-hint {
          font-size: 12px;
          color: #666666;
          text-align: center;
          padding: 12px;
          background: #f5f5f5;
          border-radius: 0px;
          border: 1px solid #cccccc;
          margin-bottom: 16px;
        }

        .keyword-search-view {
          padding: 8px;
        }

        .keyword-search-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .keyword-search-header h4 {
          margin: 0;
          font-size: 15px;
          font-weight: 500;
          color: #000000;
          flex: 1;
        }

        .keyword-results-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .keyword-result-item {
          padding: 12px;
          background: #ffffff;
          border: 1px solid #cccccc;
          border-radius: 0px;
          cursor: pointer;
        }

        .keyword-result-item:hover {
          background: #f5f5f5;
          border-color: #000000;
        }

        .keyword-result-ref {
          font-size: 13px;
          font-weight: 500;
          color: #000000;
          margin-bottom: 4px;
        }

        .keyword-result-content {
          font-size: 14px;
          color: #333333;
          line-height: 1.6;
        }

        .add-song-btn {
          width: 100%;
          padding: 10px;
          margin-top: 12px;
          min-height: 30px;
          box-sizing: border-box;
        }

        .panel-4-vertical {
          display: flex;
          flex-direction: column;
        }

        .panel-content-vertical {
          flex: 1;
          overflow-y: auto;
          padding: 8px 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-top: 1px solid #cccccc;
        }

        .display-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .section-title {
          margin: 0;
          font-size: 15px;
          font-weight: 500;
          color: #000000;
          line-height: 1.4;
          letter-spacing: 0.02em;
          height: 40px;
          display: flex;
          align-items: center;
        }

        .live-preview-vertical {
          aspect-ratio: 16/9;
          width: 100%;
          border-radius: 0px;
          border: 1px solid #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }

        .live-controls-vertical {
          display: flex;
          gap: 10px;
          padding: 4px 0;
        }

        .live-controls-vertical .control-btn {
          flex: 1;
          height: 40px;
          padding: 0 16px;
          border: 1px solid #000000;
          border-radius: 0px;
          cursor: pointer;
          font-size: 14px;
          background: #ffffff;
          color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .live-controls-vertical .control-btn.primary {
          background: #323341;
          color: #ffffff;
        }

        .live-controls-vertical .control-btn.danger {
          background: #323341;
          color: #ffffff;
        }

        .live-controls-vertical .control-btn.sync-btn {
          background: #323341;
          color: #ffffff;
        }

        .live-controls-vertical .control-btn.lock-btn {
          background: #e5e5e5;
          color: #000000;
        }

        .live-controls-vertical .control-btn.lock-btn.locked {
          background: #323341;
          color: #ffffff;
        }

        .next-preview-vertical {
          aspect-ratio: 16/9;
          width: 100%;
          border-radius: 0px;
          border: 1px solid #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .next-info-vertical {
          text-align: center;
          color: #666;
          font-size: 13px;
        }

        .empty-text {
          font-size: 18px;
          opacity: 0.5;
          text-align: center;
        }

        .share-section {
          flex: 1;
          display: flex;
          flex-direction: column;
        }

        .refresh-btn-vertical {
          width: 100%;
          height: 40px;
          padding: 0 16px;
          border: 1px solid #000000;
          background: #323341;
          color: #ffffff;
          border-radius: 0px;
          cursor: pointer;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .refresh-btn-vertical:disabled {
          opacity: 0.6;
        }

        .source-list-vertical {
          display: flex;
          flex-direction: column;
          gap: 8px;
          overflow-y: auto;
        }

        .source-item-vertical {
          background: #ffffff;
          border-radius: 0px;
          padding: 10px;
          cursor: pointer;
          border: 1px solid #cccccc;
        }

        .source-item-vertical:hover {
          background: #f5f5f5;
        }

        .source-item-vertical.selected {
          border-color: #000000;
        }

        .source-thumb-vertical {
          width: 100%;
          border-radius: 0px;
        }

        .share-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .share-dialog {
          background: #ffffff;
          border-radius: 0px;
          border: 2px solid #000000;
          width: 95%;
          max-width: 1600px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: none;
        }

        .share-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #000000;
          background: #f5f5f5;
        }

        .share-dialog-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          color: #000000;
        }

        .share-dialog-close {
          background: #323341;
          color: #ffffff;
          border: none;
          width: 32px;
          height: 32px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .share-dialog-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #ffffff;
        }

        .share-dialog-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .share-dialog-item {
          background: #fafafa;
          border: 2px solid #cccccc;
          border-radius: 0px;
          padding: 16px;
          cursor: pointer;
          transition: 0ms;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .share-dialog-item:hover {
          background: #f5f5f5;
          border-color: #000000;
        }

        .share-dialog-item.selected {
          border-color: #000000;
          background: #e5e5e5;
        }

        .share-dialog-thumb {
          width: 100%;
          flex: 1;
          object-fit: contain;
          border: 1px solid #000000;
          border-radius: 0px;
          margin-top: 8px;
          background: #323341;
          min-height: 120px;
        }

        .share-dialog-name {
          font-size: 13px;
          color: #000000;
          text-align: left;
          font-weight: 500;
          margin: 0;
          word-break: break-all;
          order: -1;
        }

        .share-dialog-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #000000;
          background: #f5f5f5;
          justify-content: flex-end;
        }

        .share-dialog-footer .btn {
          height: 40px;
          padding: 0 20px;
          font-size: 15px;
        }

        .help-status-btn {
          padding: 4px 16px;
          border-radius: 0px;
          font-size: 11px;
          font-weight: 500;
          background: #f5f5f5;
          color: #666666;
          border: none;
          cursor: pointer;
        }

        .help-status-btn:hover {
          background: #323341;
          color: #ffffff;
        }

        .help-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .help-dialog {
          background: #ffffff;
          border-radius: 0px;
          border: 2px solid #000000;
          width: 90%;
          max-width: 700px;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          box-shadow: none;
        }

        .help-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #000000;
          background: #f5f5f5;
        }

        .help-dialog-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          color: #000000;
        }

        .help-dialog-close {
          background: #323341;
          color: #ffffff;
          border: none;
          width: 32px;
          height: 32px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .help-dialog-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: #ffffff;
        }

        .input-dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .input-dialog {
          background: #ffffff;
          border-radius: 0px;
          border: 2px solid #000000;
          width: 90%;
          max-width: 450px;
          display: flex;
          flex-direction: column;
          box-shadow: none;
        }

        .input-dialog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #000000;
          background: #f5f5f5;
        }

        .input-dialog-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
          color: #000000;
        }

        .input-dialog-close {
          background: #323341;
          color: #ffffff;
          border: none;
          width: 32px;
          height: 32px;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .input-dialog-content {
          padding: 24px;
          background: #ffffff;
        }

        .input-dialog-message {
          margin: 0 0 16px 0;
          font-size: 14px;
          color: #000000;
        }

        .input-dialog-input {
          width: 100%;
          height: 40px;
          padding: 0 12px;
          border: 1px solid #000000;
          border-radius: 0px;
          font-size: 14px;
          background: #ffffff;
          color: #000000;
          box-sizing: border-box;
        }

        .input-dialog-input:focus {
          outline: none;
          border-color: #000000;
        }

        .input-dialog-footer {
          display: flex;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #000000;
          background: #f5f5f5;
          justify-content: flex-end;
        }

        .input-dialog-footer .btn {
          height: 40px;
          padding: 0 20px;
          font-size: 15px;
        }

        .help-section {
          margin-bottom: 32px;
        }

        .help-section:last-child {
          margin-bottom: 0;
        }

        .help-section h4 {
          margin: 0 0 16px 0;
          font-size: 16px;
          font-weight: 500;
          color: #000000;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
        }

        .help-shortcut-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .help-shortcut-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: #fafafa;
          border: 1px solid #cccccc;
          border-radius: 0px;
        }

        .help-shortcut-key {
          font-family: monospace;
          font-size: 13px;
          font-weight: 500;
          background: #323341;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 0px;
        }

        .help-shortcut-desc {
          font-size: 13px;
          color: #000000;
        }

        .help-bible-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .help-bible-item {
          padding: 14px 16px;
          background: #fafafa;
          border: 1px solid #cccccc;
          border-radius: 0px;
        }

        .help-bible-example {
          font-family: monospace;
          font-size: 14px;
          font-weight: 500;
          color: #000000;
          margin-bottom: 6px;
        }

        .help-bible-desc {
          font-size: 13px;
          color: #666666;
        }
      `}</style>

      {/* 选择投屏源弹窗 */}
      {showShareDialog && (
        <div className="share-dialog-overlay" onClick={() => setShowShareDialog(false)}>
          <div className="share-dialog" onClick={e => e.stopPropagation()}>
            <div className="share-dialog-header">
              <h3>{uiLanguage === 'en' ? 'Manage share sources' : uiLanguage === 'zh-Hant' ? '管理投屏源' : '管理投屏源'}</h3>
              <button className="share-dialog-close" onClick={() => setShowShareDialog(false)}>✕</button>
            </div>
            <div className="share-dialog-content">
              {availableSources.length === 0 ? (
                <div className="empty">
                  <button
                    className="btn primary" onClick={refreshSources} style={{ width: '100%' }}>
                    {shareDialogCopy.refresh}
                  </button>
                </div>
              ) : (
                <div className="share-dialog-grid">
                  {availableSources.map(source => (
                    <div
                      key={source.id}
                      className={`share-dialog-item ${currentSharingId === source.id ? 'selected' : ''}`}
                      onClick={() => {
                        selectShareSource(source.id);
                        setShowShareDialog(false);
                      }}
                      style={{ position: 'relative' }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newFavorites = favoriteSourceIds.includes(source.id)
                            ? favoriteSourceIds.filter(id => id !== source.id)
                            : [...favoriteSourceIds, source.id];
                          setFavoriteSourceIds(newFavorites);
                          localStorage.setItem('favoriteSourceIds', JSON.stringify(newFavorites));
                        }}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: '#000000',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '20px',
                          padding: '4px 8px',
                          borderRadius: '0px',
                          zIndex: 10
                        }}
                      >
                        {favoriteSourceIds.includes(source.id) ? '⭐' : '☆'}
                      </button>
                      {source.thumbnail && (
                        <img
                          className="share-dialog-thumb"
                          src={source.thumbnail}
                          alt={source.name}
                        />
                      )}
                      <div className="share-dialog-name">{source.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="share-dialog-footer">
              {currentSharingId && (
                <button
                  className="btn danger" onClick={() => {
                    stopShareAndRestore();
                    setShowShareDialog(false);
                  }}>
                  {shareDialogCopy.stop}
                </button>
              )}
              <button className="btn" onClick={() => setShowShareDialog(false)}>
                {shareDialogCopy.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 帮助对话框 */}
      {showHelpDialog && (
        <div className="help-dialog-overlay" onClick={() => setShowHelpDialog(false)}>
          <div className="help-dialog" onClick={e => e.stopPropagation()}>
            <div className="help-dialog-header">
              <h3>{t.help}</h3>
              <button className="help-dialog-close" onClick={() => setShowHelpDialog(false)}>✕</button>
            </div>
            <div className="help-dialog-content">
              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'Shortcuts' : uiLanguage === 'zh-Hant' ? '快捷鍵' : '快捷键'}</h4>
                <div className="help-shortcut-list">
                  <div className="help-shortcut-item">
                    <span className="help-shortcut-key">F5</span>
                    <span className="help-shortcut-desc">{uiLanguage === 'en' ? 'Start/stop projection' : uiLanguage === 'zh-Hant' ? '開始/停止投屏' : '开始/停止投屏'}</span>
                  </div>
                  <div className="help-shortcut-item">
                    <span className="help-shortcut-key">F6</span>
                    <span className="help-shortcut-desc">{uiLanguage === 'en' ? 'Toggle app sharing' : uiLanguage === 'zh-Hant' ? '切換應用分享' : '切换应用分享'}</span>
                  </div>
                  <div className="help-shortcut-item">
                    <span className="help-shortcut-key">F7</span>
                    <span className="help-shortcut-desc">{uiLanguage === 'en' ? 'Live sync / lock switch' : uiLanguage === 'zh-Hant' ? '實時同步（切換鎖定）' : '实时同步（切换锁定）'}</span>
                  </div>
                  <div className="help-shortcut-item">
                    <span className="help-shortcut-key">F8</span>
                    <span className="help-shortcut-desc">{uiLanguage === 'en' ? 'Lock/unlock projection' : uiLanguage === 'zh-Hant' ? '鎖定/解鎖投屏' : '锁定/解锁投屏'}</span>
                  </div>
                  <div className="help-shortcut-item">
                    <span className="help-shortcut-key">ESC</span>
                    <span className="help-shortcut-desc">{uiLanguage === 'en' ? 'Exit projection / sharing' : uiLanguage === 'zh-Hant' ? '退出投屏/應用分享' : '退出投屏/应用分享'}</span>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'Bible quick search' : uiLanguage === 'zh-Hant' ? '聖經快速搜尋' : '圣经快速检索'}</h4>
                <div className="help-bible-list">
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'Keyboard quick search' : uiLanguage === 'zh-Hant' ? '全鍵盤快捷查詢' : '全键盘快捷查询'}</div>
                    <div className="help-bible-desc">
                      <code>m</code> → {uiLanguage === 'en' ? 'Filter Matthew, then press Enter to select it' : uiLanguage === 'zh-Hant' ? '篩選出馬太福音，按 Enter 選中' : '过滤出马太福音，按回车选中'}
                      <br />
                      <code>caj 1 1-5</code> → {uiLanguage === 'en' ? 'Exodus 1:1-5' : uiLanguage === 'zh-Hant' ? '出埃及記 1 章 1-5 節' : '出埃及记1章1-5节'}
                      <br />
                      <code>创 1 1</code> → {uiLanguage === 'en' ? 'Genesis 1:1' : uiLanguage === 'zh-Hant' ? '創世記 1 章 1 節' : '创世记1章1节'}
                      <br />
                      <code>诗 23</code> → {uiLanguage === 'en' ? 'Psalm 23' : uiLanguage === 'zh-Hant' ? '詩篇 23 章' : '诗篇23章'}
                      <br />
                      {uiLanguage === 'en' ? 'First Enter: jump and select verses. Second Enter: add them straight to the editor.' : uiLanguage === 'zh-Hant' ? '第一次按 Enter：跳轉並選中經文；第二次按 Enter：直接加入編輯欄' : '第一次回车：跳转并选中经文，第二次回车：直接加入编辑栏'}
                    </div>
                  </div>
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'Mouse selection' : uiLanguage === 'zh-Hant' ? '滑鼠快捷查詢' : '鼠标快捷查询'}</div>
                    <div className="help-bible-desc">
                      {uiLanguage === 'en' ? 'Choose a book first, then choose a chapter.' : uiLanguage === 'zh-Hant' ? '先選卷，再選章；' : '先选卷，再选章；'}
                      <br />
                      {uiLanguage === 'en' ? 'Click verse 1, then verse 7, to auto-select verses 1-7.' : uiLanguage === 'zh-Hant' ? '點擊第 1 節，再點擊第 7 節，會自動選中 1-7 節；' : '点击第1节，再点击第7节，自动选中1-7节；'}
                      <br />
                      {uiLanguage === 'en' ? 'Shift + click: select a range' : uiLanguage === 'zh-Hant' ? 'Shift + 點擊：範圍選擇' : 'Shift+点击：范围选择'}
                    </div>
                  </div>
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'Keyword search' : uiLanguage === 'zh-Hant' ? '關鍵詞查詢' : '关键词查询'}</div>
                    <div className="help-bible-desc">
                      {uiLanguage === 'en' ? 'Type "grace" and press Enter to show matching verses, then drag them into the editor.' : uiLanguage === 'zh-Hant' ? '輸入「感恩」，按 Enter 顯示相關經文，可拖拽入編輯欄' : '输入"感恩"，按回车，显示相关经文，可拖拽入编辑栏'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'Background formats' : uiLanguage === 'zh-Hant' ? '背景格式要求' : '背景格式要求'}</h4>
                <div className="help-bible-list">
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'Static background image' : uiLanguage === 'zh-Hant' ? '靜態背景圖片' : '静态背景图片'}</div>
                    <div className="help-bible-desc">
                      <strong>{uiLanguage === 'en' ? 'Recommended formats:' : uiLanguage === 'zh-Hant' ? '推薦格式：' : '推荐格式：'}</strong>{uiLanguage === 'en' ? ' JPG/JPEG, PNG, WebP' : 'JPG/JPEG、PNG、WebP'}
                      <br />
                      <strong>{uiLanguage === 'en' ? 'Recommended resolution:' : uiLanguage === 'zh-Hant' ? '推薦解析度：' : '推荐分辨率：'}</strong>{uiLanguage === 'en' ? ' 1920×1080 (Full HD), 3840×2160 (4K)' : '1920×1080 (Full HD)、3840×2160 (4K)'}
                      <br />
                      <strong>{uiLanguage === 'en' ? 'Design tips:' : uiLanguage === 'zh-Hant' ? '設計建議：' : '设计建议：'}</strong>{uiLanguage === 'en' ? ' Minimal, low-saturation, solid or gradient backgrounds' : uiLanguage === 'zh-Hant' ? '極簡風格，低飽和度，純色或漸變背景' : '极简风格，低饱和度，纯色或渐变背景'}
                    </div>
                  </div>
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'Video background' : uiLanguage === 'zh-Hant' ? '動態背景影片' : '动态背景视频'}</div>
                    <div className="help-bible-desc">
                      <strong>{uiLanguage === 'en' ? 'Recommended formats:' : uiLanguage === 'zh-Hant' ? '推薦格式：' : '推荐格式：'}</strong>{uiLanguage === 'en' ? ' MP4 (H.264), MOV, WebM' : 'MP4 (H.264)、MOV、WebM'}
                      <br />
                      <strong>{uiLanguage === 'en' ? 'Recommended specs:' : uiLanguage === 'zh-Hant' ? '推薦參數：' : '推荐参数：'}</strong>{uiLanguage === 'en' ? ' 1920×1080, 24-30fps, bitrate 3-5Mbps' : uiLanguage === 'zh-Hant' ? '1920×1080，24-30fps，碼率 3-5Mbps' : '1920×1080，24-30fps，码率3-5Mbps'}
                      <br />
                      <strong>{uiLanguage === 'en' ? 'Design tips:' : uiLanguage === 'zh-Hant' ? '設計建議：' : '设计建议：'}</strong>{uiLanguage === 'en' ? ' Slow motion, muted, avoid rapid flashing' : uiLanguage === 'zh-Hant' ? '緩慢動態效果，無聲，避免快速閃爍' : '缓慢动态效果，无声，避免快速闪烁'}
                    </div>
                  </div>
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'Right-click delete' : uiLanguage === 'zh-Hant' ? '右鍵刪除' : '右键删除'}</div>
                    <div className="help-bible-desc">
                      {uiLanguage === 'en' ? 'Right-click a background thumbnail to delete it.' : uiLanguage === 'zh-Hant' ? '右鍵點擊背景縮略圖可刪除該背景' : '右键点击背景缩略图可删除该背景'}
                      <br />
                      {uiLanguage === 'en' ? 'Built-in default backgrounds can also be deleted.' : uiLanguage === 'zh-Hant' ? '內置預設背景也可以刪除' : '内置默认背景也可以删除'}
                      <br />
                      {uiLanguage === 'en' ? 'If the current background is deleted, the app switches to the first available background automatically.' : uiLanguage === 'zh-Hant' ? '正在使用的背景刪除後會自動切換到第一個可用背景' : '正在使用的背景删除后会自动切换到第一个可用背景'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'Lyric file import' : uiLanguage === 'zh-Hant' ? '歌詞文件導入' : '歌词文件导入'}</h4>
                <div className="help-bible-list">
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'Supported formats' : uiLanguage === 'zh-Hant' ? '支持的格式' : '支持的格式'}</div>
                    <div className="help-bible-desc">
                      <strong>{uiLanguage === 'en' ? 'JSON:' : uiLanguage === 'zh-Hant' ? 'JSON 格式：' : 'JSON格式：'}</strong>{uiLanguage === 'en' ? ' { "title": "Song", "slides": ["Verse 1", "Verse 2"] }' : ' { "title": "歌曲", "slides": ["第1段", "第2段"] }'}
                      <br />
                      <strong>{uiLanguage === 'en' ? 'LRC:' : uiLanguage === 'zh-Hant' ? 'LRC 格式：' : 'LRC格式：'}</strong>{uiLanguage === 'en' ? ' [00:00.00]Lyric text (timestamps optional)' : ' [00:00.00]歌词文本（时间戳可选）'}
                      <br />
                      <strong>{uiLanguage === 'en' ? 'TXT:' : uiLanguage === 'zh-Hant' ? 'TXT 格式：' : 'TXT格式：'}</strong>{uiLanguage === 'en' ? ' One slide per line, or separate slides with empty lines' : '每行一段，或用空行分隔段落'}
                    </div>
                  </div>
                  <div className="help-bible-item">
                    <div className="help-bible-example">{uiLanguage === 'en' ? 'How to import' : uiLanguage === 'zh-Hant' ? '導入方式' : '导入方式'}</div>
                    <div className="help-bible-desc">
                      {uiLanguage === 'en' ? '1. Go to the "Files" tab' : uiLanguage === 'zh-Hant' ? '1. 切換到「文件」頁籤' : '1. 切换到「文件」标签'}
                      <br />
                      {uiLanguage === 'en' ? '2. Click "+ Import files"' : uiLanguage === 'zh-Hant' ? '2. 點擊「+ 導入文件」' : '2. 点击「+ 导入文件」'}
                      <br />
                      {uiLanguage === 'en' ? '3. Select lyric files (TXT/LRC/JSON)' : uiLanguage === 'zh-Hant' ? '3. 選擇歌詞文件（TXT/LRC/JSON）' : '3. 选择歌词文件（TXT/LRC/JSON）'}
                      <br />
                      {uiLanguage === 'en' ? '4. Files are automatically parsed and added to the project list' : uiLanguage === 'zh-Hant' ? '4. 歌詞將被自動解析並加入項目列表' : '4. 歌词将被自动解析并加入项目列表'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'About' : uiLanguage === 'zh-Hant' ? '關於' : '关于'}</h4>
                <div className="help-about-content">
                  <div className="help-about-item">
                    <div className="help-about-title">{uiLanguage === 'en' ? 'Author' : uiLanguage === 'zh-Hant' ? '作者' : '作者'}</div>
                    <div className="help-about-desc">
                      <strong>IssaYH</strong>
                    </div>
                  </div>
                  <div className="help-about-item">
                    <div className="help-about-title">{uiLanguage === 'en' ? 'Contact' : uiLanguage === 'zh-Hant' ? '聯繫' : '联系'}</div>
                    <div className="help-about-desc">
                      <a href="mailto:issawork7877@gmail.com">issawork7877@gmail.com</a>
                    </div>
                  </div>
                  <div className="help-about-item">
                    <div className="help-about-title">{uiLanguage === 'en' ? 'Version' : uiLanguage === 'zh-Hant' ? '版本' : '版本'}</div>
                    <div className="help-about-desc">
                      {uiLanguage === 'en' ? 'Jianying Projection - Multi-language Edition' : uiLanguage === 'zh-Hant' ? '簡影投屏 - 多語言版' : '简影投屏 - 多语言版'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'Support Us' : uiLanguage === 'zh-Hant' ? '支持我們' : '支持我们'}</h4>
                <div className="help-support-content">
                  <p style={{ marginBottom: '12px', fontSize: '14px' }}>
                    {uiLanguage === 'en'
                      ? 'If this software helps you, consider supporting us!'
                      : uiLanguage === 'zh-Hant'
                        ? '如果這個軟件對你有幫助，歡迎支持我們！'
                        : '如果这个软件对你有帮助，欢迎支持我们！'}
                  </p>
                  <div className="help-support-buttons">
                    <button
                      className="tool-btn tool-btn-primary"
                      style={{ fontSize: '13px', padding: '8px 16px' }}
                      onClick={() => setRewardModalOpen(true)}
                    >
                      💚 {uiLanguage === 'en' ? 'Support Us' : uiLanguage === 'zh-Hant' ? '支持我們' : '支持我们'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'Copyright Notice' : uiLanguage === 'zh-Hant' ? '版權聲明' : '版权声明'}</h4>
                <div className="help-copyright-content" style={{ fontSize: '12px', lineHeight: 1.6 }}>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>{uiLanguage === 'en' ? 'Bible Versions' : uiLanguage === 'zh-Hant' ? '聖經版本' : '圣经版本'}:</strong>
                    <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                      <li>KJV (King James Version): {uiLanguage === 'en' ? 'Public Domain' : uiLanguage === 'zh-Hant' ? '公有領域' : '公有领域'}</li>
                      <li>CUV (Chinese Union Version): {uiLanguage === 'en' ? 'For personal use only' : uiLanguage === 'zh-Hant' ? '僅供個人使用' : '仅供个人使用'}</li>
                    </ul>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>{uiLanguage === 'en' ? 'Hymns/Songs' : uiLanguage === 'zh-Hant' ? '詩歌' : '诗歌'}:</strong>
                    <div style={{ marginLeft: '20px', marginTop: '5px' }}>
                      {uiLanguage === 'en'
                        ? 'Users are responsible for any hymns/songs they import.'
                        : uiLanguage === 'zh-Hant'
                          ? '用戶自行負責導入的詩歌版權。'
                          : '用户自行负责导入的诗歌版权。'}
                    </div>
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <strong>{uiLanguage === 'en' ? 'Images/Videos' : uiLanguage === 'zh-Hant' ? '圖片/視頻' : '图片/视频'}:</strong>
                    <div style={{ marginLeft: '20px', marginTop: '5px' }}>
                      {uiLanguage === 'en'
                        ? 'Users are responsible for any media they import.'
                        : uiLanguage === 'zh-Hant'
                          ? '用戶自行負責導入的媒體版權。'
                          : '用户自行负责导入的媒体版权。'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="help-section">
                <h4>{uiLanguage === 'en' ? 'Disclaimer' : uiLanguage === 'zh-Hant' ? '免責聲明' : '免责声明'}</h4>
                <div className="help-disclaimer-content" style={{ fontSize: '12px', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: '8px' }}>
                    {uiLanguage === 'en'
                      ? 'This software is provided as-is, without any warranty.'
                      : uiLanguage === 'zh-Hant'
                        ? '本軟件按「現狀」提供，不提供任何擔保。'
                        : '本软件按「现状」提供，不提供任何担保。'}
                  </p>
                  <p style={{ marginBottom: '8px' }}>
                    {uiLanguage === 'en'
                      ? 'The author is not responsible for any issues caused by the use of this software.'
                      : uiLanguage === 'zh-Hant'
                        ? '作者不對使用本軟件導致的任何問題負責。'
                        : '作者不对使用本软件导致的任何问题负责。'}
                  </p>
                  <p>
                    {uiLanguage === 'en'
                      ? 'Users are solely responsible for the content they display with this software.'
                      : uiLanguage === 'zh-Hant'
                        ? '用戶需對使用本軟件顯示的內容負全部責任。'
                        : '用户需对使用本软件显示的内容负全部责任。'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 输入对话框 */}
      {showInputDialog && (
        <div className="input-dialog-overlay" onClick={() => setShowInputDialog(false)}>
          <div className="input-dialog" onClick={e => e.stopPropagation()}>
            <div className="input-dialog-header">
              <h3>{inputDialogConfig.title}</h3>
              <button className="input-dialog-close" onClick={() => setShowInputDialog(false)}>✕</button>
            </div>
            <div className="input-dialog-content">
              <p className="input-dialog-message">{inputDialogConfig.message}</p>
              <input
                type="text"
                className="input-dialog-input"
                value={inputDialogValue}
                onChange={(e) => setInputDialogValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    inputDialogConfig.onConfirm?.(inputDialogValue);
                    setShowInputDialog(false);
                  } else if (e.key === 'Escape') {
                    setShowInputDialog(false);
                  }
                }}
                autoFocus
              />
            </div>
            <div className="input-dialog-footer">
              <button className="btn" onClick={() => setShowInputDialog(false)}>
                {uiLanguage === 'en' ? 'Cancel' : uiLanguage === 'zh-Hant' ? '取消' : '取消'}
              </button>
              <button className="btn primary" onClick={() => {
                inputDialogConfig.onConfirm?.(inputDialogValue);
                setShowInputDialog(false);
              }}>
                {uiLanguage === 'en' ? 'Confirm' : uiLanguage === 'zh-Hant' ? '確定' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右键菜单 */}
      {rightClickMenu && (
        <div
          className="right-click-menu"
          style={{ left: rightClickMenu.x, top: rightClickMenu.y }}
          onClick={closeRightClickMenu}
        >
          <div
            className="right-click-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              editProjectNote(rightClickMenu.projectId);
            }}
          >
            {uiLanguage === 'en' ? 'Rename' : uiLanguage === 'zh-Hant' ? '重新命名' : '重命名'}
          </div>
          <div className="right-click-menu-divider"></div>
          <div
            className="right-click-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              deleteProject(rightClickMenu.projectId);
            }}
          >
            {uiLanguage === 'en' ? '🗑️ Delete project' : uiLanguage === 'zh-Hant' ? '🗑️ 刪除項目' : '🗑️ 删除项目'}
          </div>
        </div>
      )}

      {/* 诗歌库右键菜单 */}
      {songRightClickMenu && (
        <div
          className="right-click-menu"
          style={{ left: songRightClickMenu.x, top: songRightClickMenu.y }}
          onClick={() => setSongRightClickMenu(null)}
        >
          <div
            className="right-click-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              deleteSongFromLibrary(songRightClickMenu.song);
            }}
          >
            {uiLanguage === 'en' ? '🗑️ Delete song' : uiLanguage === 'zh-Hant' ? '🗑️ 刪除詩歌' : '🗑️ 删除诗歌'}
          </div>
        </div>
      )}

      {/* 文件右键菜单 */}
      {fileRightClickMenu && (
        <div
          className="right-click-menu"
          style={{ left: fileRightClickMenu.x, top: fileRightClickMenu.y }}
          onClick={() => setFileRightClickMenu(null)}
        >
          <div
            className="right-click-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              renameFile(fileRightClickMenu.file);
            }}
          >
            {uiLanguage === 'en' ? '✏️ Rename' : uiLanguage === 'zh-Hant' ? '✏️ 重新命名' : '✏️ 重命名'}
          </div>
          <div className="right-click-menu-divider"></div>
          <div
            className="right-click-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              deleteFile(fileRightClickMenu.file);
            }}
          >
            {uiLanguage === 'en' ? '🗑️ Delete' : uiLanguage === 'zh-Hant' ? '🗑️ 刪除' : '🗑️ 删除'}
          </div>
        </div>
      )}

      {/* 幻灯片右键菜单 */}
      {slideRightClickMenu && (
        <div
          className="right-click-menu"
          style={{ left: slideRightClickMenu.x, top: slideRightClickMenu.y }}
          onClick={(e) => {
            e.stopPropagation();
            setSlideRightClickMenu(null);
          }}
        >
          <div
            className="right-click-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              copySlide(slideRightClickMenu.slideIndex);
            }}
          >
            {uiLanguage === 'en' ? '📋 Copy' : uiLanguage === 'zh-Hant' ? '📋 複製' : '📋 复制'}
          </div>
          <div
            className="right-click-menu-item"
            onClick={(e) => {
              e.stopPropagation();
              cutSlide(slideRightClickMenu.slideIndex);
            }}
          >
            {uiLanguage === 'en' ? '✂️ Cut' : uiLanguage === 'zh-Hant' ? '✂️ 剪下' : '✂️ 剪切'}
          </div>
          {clipboardSlide && (
            <div
              className="right-click-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                pasteSlide(slideRightClickMenu.slideIndex);
              }}
            >
              {uiLanguage === 'en' ? '📄 Paste' : uiLanguage === 'zh-Hant' ? '📄 貼上' : '📄 粘贴'}
            </div>
          )}
          <div className="right-click-menu-divider"></div>
          <div
            className="right-click-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              deleteSlideFromMenu(slideRightClickMenu.slideIndex);
            }}
          >
            {uiLanguage === 'en' ? '🗑️ Delete' : uiLanguage === 'zh-Hant' ? '🗑️ 刪除' : '🗑️ 删除'}
          </div>
          {deletedSlidesHistory.length > 0 && (
            <div
              className="right-click-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                if (deletedSlidesHistory.length > 0) {
                  const lastDeleted = deletedSlidesHistory[deletedSlidesHistory.length - 1];
                  const newSlides = [...selectedSong.slides];
                  newSlides.splice(lastDeleted.index, 0, lastDeleted.content);
                  setSelectedSong({ ...selectedSong, slides: newSlides });
                  setCurrentSlideIndex(lastDeleted.index);
                  if (selectedProject) {
                    const updatedProject = { ...selectedProject, slides: newSlides };
                    setSelectedProject(updatedProject);
                    setProjects(projects.map(p => p.id === selectedProject.id ? updatedProject : p));
                  }
                  setDeletedSlidesHistory(deletedSlidesHistory.slice(0, -1));
                }
                setSlideRightClickMenu(null);
              }}
            >
              ↩️ {uiLanguage === 'en' ? 'Restore' : uiLanguage === 'zh-Hant' ? '恢復' : '恢复'}
            </div>
          )}
        </div>
      )}

      {/* 背景右键菜单 */}
      {bgRightClickMenu && bgRightClickMenu.background.id !== 'none' && (
        <div
          className="right-click-menu"
          style={{ left: bgRightClickMenu.x, top: bgRightClickMenu.y }}
          onClick={() => setBgRightClickMenu(null)}
        >
          <div
            className="right-click-menu-item danger"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(uiLanguage === 'en' ? 'Delete this background?' : uiLanguage === 'zh-Hant' ? '確定要刪除這個背景嗎？' : '确定要删除这个背景吗？')) {
                // 如果当前正在使用这个背景，切换到默认背景
                if (currentBackgroundId === bgRightClickMenu.background.id) {
                  // 找到第一个未删除的默认背景
                  const firstAvailableBg = defaultBackgrounds.find(
                    bg => bg.id !== 'none' && !deletedDefaultBackgroundIds.includes(bg.id)
                  ) || defaultBackgrounds[0];
                  setCurrentBackgroundId(firstAvailableBg.id);
                }
                // 判断是自定义背景还是默认背景，分别处理
                if (bgRightClickMenu.background.isCustom) {
                  // 从自定义背景列表中删除
                  setCustomBackgrounds(
                    customBackgrounds.filter(bg => bg.id !== bgRightClickMenu.background.id)
                  );
                } else {
                  // 添加到已删除的默认背景ID列表
                  setDeletedDefaultBackgroundIds([
                    ...deletedDefaultBackgroundIds,
                    bgRightClickMenu.background.id
                  ]);
                }
              }
              setBgRightClickMenu(null);
            }}
          >
            🗑️ {uiLanguage === 'en' ? 'Delete background' : uiLanguage === 'zh-Hant' ? '刪除背景' : '删除背景'}
          </div>
        </div>
      )}

      {/* 悬浮诗歌预览层 */}
      {hoveredSongFromLibrary && (
        <div
          style={{
            position: 'fixed',
            left: '550px',
            top: '100px',
            width: '400px',
            maxHeight: '70vh',
            background: '#ffffff',
            border: '1px solid #000000',
            borderRadius: '0px',
            boxShadow: 'none',
            padding: '16px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <h4 style={{ margin: 0, fontSize: '15px', color: '#000000', fontWeight: 400 }}>
              {hoveredSongFromLibrary.title}
            </h4>
            <button
              className="btn primary"
              style={{ padding: '8px 16px', fontSize: '12px', background: '#323341', color: '#ffffff', borderRadius: '0px' }}
              onClick={() => {
                selectSongFromLibrary(hoveredSongFromLibrary);
              }}
            >
              {uiLanguage === 'en' ? '+ Add to project' : uiLanguage === 'zh-Hant' ? '+ 添加到項目' : '+ 添加到项目'}
            </button>
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: '0px',
            padding: '12px',
            border: '1px solid #cccccc'
          }}>
            {hoveredSongFromLibrary.slides?.map((slide, idx) => (
              <div key={idx} style={{
                padding: '8px 0',
                borderBottom: idx < hoveredSongFromLibrary.slides.length - 1 ? '1px dashed #cccccc' : 'none',
                fontSize: '13px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}>
                <div style={{
                  fontWeight: '400',
                  color: '#000000',
                  marginBottom: '4px',
                  fontSize: '12px'
                }}>
            {uiLanguage === 'en' ? `Page ${idx + 1}` : uiLanguage === 'zh-Hant' ? `第 ${idx + 1} 頁` : `第 ${idx + 1} 页`}
                </div>
                {slide}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 数据包管理 */}
      <DataPackManager
        isOpen={datapackModalOpen}
        onClose={() => setDatapackModalOpen(false)}
        onSongsImported={handleSongsImported}
      />

      {/* 赞赏码弹窗 */}
      {rewardModalOpen && (
        <div className="modal-overlay" onClick={() => setRewardModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {uiLanguage === 'en' ? 'Support Us' : uiLanguage === 'zh-Hant' ? '支持我們' : '支持我们'}
              </h3>
              <button className="close-btn" onClick={() => setRewardModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <p style={{ color: '#888', fontSize: '13px', marginBottom: '20px' }}>
                {uiLanguage === 'en'
                  ? 'Scan the QR code with WeChat to support us'
                  : uiLanguage === 'zh-Hant'
                    ? '請用微信掃碼支持我們'
                    : '请用微信扫码支持我们'}
              </p>
              <img
                src="./wx-reward-qr.png"
                alt="WeChat Reward QR"
                style={{ width: '280px', height: '280px', borderRadius: '12px' }}
              />
              <p style={{ color: '#aaa', fontSize: '12px', marginTop: '16px' }}>
                {uiLanguage === 'en'
                  ? 'Thank you for your support! ❤️'
                  : uiLanguage === 'zh-Hant'
                    ? '感謝你的支持！❤️'
                    : '感谢你的支持！❤️'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FullLayout;
