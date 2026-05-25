import { useEffect } from 'react';
import electronAPI from '../utils/electronAPI';

export function useKeyboardShortcuts({
  currentSlideIndex,
  selectedSong,
  selectedProject,
  projects,
  currentSharingId,
  isProjectionActive,
  isProjectionLocked,
  currentTheme,
  currentBackground,
  deletedSlidesHistory,
  clipboardSlide,
  cutSlideIndex,
  selectedSourceId,
  uiLanguage,
  syncToProjection,
  startAppSharing,
  stopShareAndRestore,
  saveCurrentEdit,
  setIsProjectionActive,
  setIsProjectionLocked,
  setLockedSlideIndex,
  setCurrentSlideIndex,
  setSelectedSong,
  setSelectedProject,
  setProjects,
  setDeletedSlidesHistory,
  setClipboardSlide,
  setCutSlideIndex,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // F5: start/stop projection
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

      // F6: toggle app sharing
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

      // F7: toggle live sync
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

      // F8: toggle lock
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

      // ESC: exit projection or sharing
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

      // Ctrl+S / Cmd+S: save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentEdit();
        return;
      }

      // Delete / Backspace: delete current slide
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
            setDeletedSlidesHistory([
              ...deletedSlidesHistory,
              { index: currentSlideIndex, content: selectedSong.slides[currentSlideIndex] },
            ]);
          }
        }
        e.preventDefault();
        return;
      }

      // Ctrl+Z / Cmd+Z: undo delete
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

      // Ctrl+C / Cmd+C: copy current slide
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !e.shiftKey) {
        setClipboardSlide({ content: selectedSong.slides[currentSlideIndex], operation: 'copy' });
        setCutSlideIndex(null);
        e.preventDefault();
        return;
      }

      // Ctrl+X / Cmd+X: cut current slide
      if ((e.ctrlKey || e.metaKey) && e.key === 'x' && !e.shiftKey) {
        setClipboardSlide({ content: selectedSong.slides[currentSlideIndex], operation: 'cut' });
        setCutSlideIndex(currentSlideIndex);
        e.preventDefault();
        return;
      }

      // Ctrl+V / Cmd+V: paste slide
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

      // Arrow navigation
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentSlideIndex > 0) {
          const newIndex = currentSlideIndex - 1;
          setCurrentSlideIndex(newIndex);
          if (isProjectionActive && !isProjectionLocked) {
            setLockedSlideIndex(newIndex);
            const songToUse = selectedSong || (selectedProject?.type === 'song' ? selectedProject : null);
            if (songToUse) {
              electronAPI.updateLyrics({
                song: songToUse,
                slideIndex: newIndex,
                theme: currentTheme,
                background: currentBackground,
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
            const songToUse = selectedSong || (selectedProject?.type === 'song' ? selectedProject : null);
            if (songToUse) {
              electronAPI.updateLyrics({
                song: songToUse,
                slideIndex: newIndex,
                theme: currentTheme,
                background: currentBackground,
              });
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentSlideIndex,
    selectedSong,
    currentSharingId,
    isProjectionActive,
    isProjectionLocked,
    selectedProject,
    currentTheme,
    currentBackground,
    deletedSlidesHistory,
    clipboardSlide,
    cutSlideIndex,
    projects,
    selectedSourceId,
    uiLanguage,
  ]);
}
