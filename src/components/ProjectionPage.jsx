import React, { useState, useEffect, useRef } from 'react';
import { uiCopy } from '../data/i18n';

function DraggableTool({ id, initialX, initialY, children, onClose }) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseDown = (e) => {
    if (e.target.closest('.tool-close-btn')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 99999,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <button
        className="tool-close-btn"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '-12px',
          right: '-12px',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#ff4444',
          color: 'white',
          border: '2px solid white',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold',
          display: (isHovered || isDragging) ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          lineHeight: 1
        }}
      >
        ×
      </button>
    </div>
  );
}

const isMediaSlide = (song, slide, index) => {
  if (!song?.fileType || !song?.filePath) return false;
  if (index === 0) return true;
  const projectName = song.title || song.name;
  return slide === projectName;
};

function ProjectionPage() {
  const uiLanguage = localStorage.getItem('uiLanguage') || 'zh-Hans';
  const t = uiCopy[uiLanguage] || uiCopy['zh-Hans'];
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [theme, setTheme] = useState(null);
  const [background, setBackground] = useState(null);
  const [sharingSourceId, setSharingSourceId] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const bgVideoRef = useRef(null);

  // 工具状态
  const [notification, setNotification] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [clock, setClock] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  // 时钟更新
  useEffect(() => {
    if (!clock?.show) return;

    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [clock?.show]);

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not found, running in browser?');
      return;
    }

    const handleUpdate = (event, data) => {
      setCurrentSong(data.song);
      setCurrentSlideIndex(data.slideIndex);
      setTheme(data.theme);
      setBackground(data.background);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setSharingSourceId(null);
    };

    const handleShare = (event, sourceId) => {
      setSharingSourceId(sourceId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      const startCapture = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId
              }
            },
            audio: false
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          streamRef.current = stream;
        } catch (err) {
          console.error('Failed to capture stream:', err);
        }
      };
      startCapture();
    };

    const handleStopShare = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setSharingSourceId(null);
    };

    // 工具更新监听
    const handleToolUpdate = (event, data) => {
      if (data.type === 'notification') {
        setNotification(data.show ? data : null);
      } else if (data.type === 'countdown') {
        setCountdown(data.show ? data : null);
      } else if (data.type === 'clock') {
        setClock(data.show ? data : null);
      }
    };

    window.electronAPI.onUpdateLyrics(handleUpdate);
    window.electronAPI.onShareSource(handleShare);
    window.electronAPI.onStopShare(handleStopShare);
    if (window.electronAPI.onToolUpdate) {
      window.electronAPI.onToolUpdate(handleToolUpdate);
    }

    const handleKeyDown = (e) => {
      // ESC键关闭工具
      if (e.code === 'Escape') {
        if (notification) {
          handleCloseTool('notification');
        } else if (countdown) {
          handleCloseTool('countdown');
        } else if (clock) {
          handleCloseTool('clock');
        }
      }

      if (!sharingSourceId && window.electronAPI) {
        if (e.code === 'Space' || e.code === 'ArrowRight') {
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('next-slide');
          }
          e.preventDefault();
        } else if (e.code === 'ArrowLeft') {
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('prev-slide');
          }
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (window.electronAPI) {
        window.electronAPI.removeListener('update-lyrics', handleUpdate);
        window.electronAPI.removeListener('share-source', handleShare);
        window.electronAPI.removeListener('stop-share', handleStopShare);
        if (window.electronAPI.onToolUpdate) {
          window.electronAPI.removeListener('tool-update', handleToolUpdate);
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 监听背景变化，确保视频背景能正确加载和播放
  useEffect(() => {
    if (background && background.type === 'video' && background.url && bgVideoRef.current) {
      const videoEl = bgVideoRef.current;

      // 只有当 URL 真正变化时才重新设置
      if (videoEl.src !== background.url) {
        videoEl.src = background.url;
        videoEl.load();
        videoEl.play().catch(() => {
          // 静默处理自动播放错误
        });
      }
    }
  }, [background]);

  const handleCloseTool = (toolType) => {
    if (toolType === 'notification') {
      setNotification(null);
    } else if (toolType === 'countdown') {
      setCountdown(null);
    } else if (toolType === 'clock') {
      setClock(null);
    }
  };

  if (sharingSourceId) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#323341',
        overflow: 'hidden',
        position: 'relative'
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'
          }}
        />
        {/* 工具 */}
        {notification && (
          <DraggableTool
            id="notification"
            initialX={window.innerWidth / 2 - 200}
            initialY={40}
            onClose={() => handleCloseTool('notification')}
          >
            <div style={{
              fontSize: `${notification.fontSize || 48}px`,
              color: notification.theme?.textColor || '#ffffff',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              textAlign: 'center',
              padding: '20px 40px',
              borderRadius: '12px',
              maxWidth: '90vw',
              lineHeight: '1.4',
              fontFamily: notification.theme?.fontFamily || 'sans-serif',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}>
              {notification.text}
            </div>
          </DraggableTool>
        )}
        {countdown && (
          <DraggableTool
            id="countdown"
            initialX={window.innerWidth - 200}
            initialY={20}
            onClose={() => handleCloseTool('countdown')}
          >
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#ff4444',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              textAlign: 'center',
              padding: '12px 24px',
              borderRadius: '8px',
              fontFamily: 'Courier New, monospace',
              letterSpacing: '2px',
              textShadow: '0 0 10px rgba(255, 68, 68, 0.8)'
            }}>
              {countdown.text}
            </div>
          </DraggableTool>
        )}
        {clock && (
          <DraggableTool
            id="clock"
            initialX={window.innerWidth - 180}
            initialY={countdown ? 120 : 20}
            onClose={() => handleCloseTool('clock')}
          >
            <div style={{
              fontSize: '32px',
              color: '#ffffff',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              textAlign: 'center',
              padding: '10px 20px',
              borderRadius: '8px',
              fontFamily: 'Courier New, monospace',
              letterSpacing: '1px'
            }}>
              {currentTime}
            </div>
          </DraggableTool>
        )}
      </div>
    );
  }

  if (!currentSong || !theme) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#323341',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 48,
        position: 'relative'
      }}>
        {t.waitingProjection}
        {/* 工具 */}
        {notification && (
          <DraggableTool
            id="notification"
            initialX={window.innerWidth / 2 - 200}
            initialY={40}
            onClose={() => handleCloseTool('notification')}
          >
            <div style={{
              fontSize: `${notification.fontSize || 48}px`,
              color: notification.theme?.textColor || '#ffffff',
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              textAlign: 'center',
              padding: '20px 40px',
              borderRadius: '12px',
              maxWidth: '90vw',
              lineHeight: '1.4',
              fontFamily: notification.theme?.fontFamily || 'sans-serif',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word'
            }}>
              {notification.text}
            </div>
          </DraggableTool>
        )}
        {countdown && (
          <DraggableTool
            id="countdown"
            initialX={window.innerWidth - 200}
            initialY={20}
            onClose={() => handleCloseTool('countdown')}
          >
            <div style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: '#ff4444',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              textAlign: 'center',
              padding: '12px 24px',
              borderRadius: '8px',
              fontFamily: 'Courier New, monospace',
              letterSpacing: '2px',
              textShadow: '0 0 10px rgba(255, 68, 68, 0.8)'
            }}>
              {countdown.text}
            </div>
          </DraggableTool>
        )}
        {clock && (
          <DraggableTool
            id="clock"
            initialX={window.innerWidth - 180}
            initialY={countdown ? 120 : 20}
            onClose={() => handleCloseTool('clock')}
          >
            <div style={{
              fontSize: '32px',
              color: '#ffffff',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              textAlign: 'center',
              padding: '10px 20px',
              borderRadius: '8px',
              fontFamily: 'Courier New, monospace',
              letterSpacing: '1px'
            }}>
              {currentTime}
            </div>
          </DraggableTool>
        )}
      </div>
    );
  }

  const slideContent = currentSong.slides[currentSlideIndex];
  const slideHeaders = currentSong.slideHeaders;
  const currentSlideHeader = slideHeaders ? slideHeaders[currentSlideIndex] : null;

  const hasMedia = currentSong.fileType && currentSong.filePath;
  const isMediaFile = isMediaSlide(currentSong, slideContent, currentSlideIndex);
  const fileType = currentSong.fileType;

  let containerStyle = {
    width: '100vw',
    height: '100vh',
    color: theme.textColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    position: 'relative'
  };

  if (isMediaFile) {
    containerStyle.backgroundColor = '#323341';
    containerStyle.padding = '0';
  }
  else if (background && background.type === 'image' && background.url) {
    containerStyle.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${background.url})`;
    containerStyle.backgroundSize = 'cover';
    containerStyle.backgroundPosition = 'center';
    containerStyle.backgroundRepeat = 'no-repeat';
  } else if (background && background.type === 'video' && background.url) {
    // 视频背景设置深色背景作为备用
    containerStyle.backgroundColor = '#323341';
  } else {
    if (theme.backgroundColor.startsWith('linear-gradient')) {
      containerStyle.background = theme.backgroundColor;
    } else {
      containerStyle.backgroundColor = theme.backgroundColor;
    }
  }

  const renderMediaContent = () => {
    if (!isMediaFile) return null;

    const filePath = currentSong.filePath?.startsWith('/')
      ? `local-file://${currentSong.filePath}`
      : currentSong.filePath;

    switch (fileType) {
      case 'image':
        return (
          <img
            src={filePath}
            alt={currentSong.title || slideContent}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
              const fallback = e.target.parentElement.querySelector('.media-fallback');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        );
      case 'video':
        return (
          <video
            src={filePath}
            autoPlay
            loop
            controls
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
            onError={(e) => {
              console.error('Video load error:', e);
              e.target.style.display = 'none';
              const fallback = e.target.parentElement.querySelector('.media-fallback');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        );
      case 'audio':
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '30px',
            color: 'white',
            width: '100%',
            height: '100%'
          }}>
            <span style={{ fontSize: '120px' }}>🎵</span>
            <span style={{ fontSize: '36px', fontWeight: 'bold' }}>{currentSong.title || slideContent}</span>
            <audio
              src={filePath}
              autoPlay
              loop
              controls
              style={{
                width: '80%',
                maxWidth: '600px'
              }}
              onError={(e) => {
                console.error('Audio load error:', e);
                const fallback = e.target.parentElement.parentElement.querySelector('.media-fallback');
                if (fallback) {
                  fallback.style.display = 'flex';
                  e.target.parentElement.style.display = 'none';
                }
              }}
            />
          </div>
        );
      case 'pdf':
        return (
          <iframe
            src={filePath}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
            title={currentSong.title || slideContent}
            onError={(e) => {
              console.error('PDF load error:', e);
              e.target.style.display = 'none';
              const fallback = e.target.parentElement.querySelector('.media-fallback');
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        );
      case 'ppt':
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '30px',
            color: 'white',
            width: '100%',
            height: '100%',
            textAlign: 'center',
            padding: '40px'
          }}>
            <span style={{ fontSize: '120px' }}>📊</span>
            <span style={{ fontSize: '36px', fontWeight: 'bold' }}>{currentSong.title || slideContent}</span>
            <span style={{ fontSize: '18px', opacity: 0.7 }}>PPT文件</span>
            <span style={{ fontSize: '14px', opacity: 0.5, marginTop: '10px' }}>
              提示：PPT文件需要先转换为PDF或图片才能投影
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      {/* 视频背景 */}
      {!isMediaFile && background && background.type === 'video' && background.url && (
        <video
          key={background.id || background.url}
          ref={bgVideoRef}
          src={background.url}
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
            zIndex: 1
          }}
          onError={(e) => {
            console.error('Video background load error:', e);
            console.error('Attempted to load:', background.url);
          }}
          onLoadStart={() => {
            console.log('Video background loading started:', background.url);
          }}
          onCanPlay={() => {
            console.log('Video background ready to play');
          }}
        />
      )}
      {isMediaFile ? (
        <>
          {renderMediaContent()}
          <div className="media-fallback" style={{
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            color: 'white'
          }}>
            <span style={{ fontSize: '60px' }}>⚠️</span>
            <span style={{ fontSize: '28px' }}>{currentSong.title || slideContent}</span>
          </div>
        </>
      ) : currentSlideHeader ? (
        <>
          <div style={{
            position: 'absolute',
            top: '48px',
            left: '0',
            right: '0',
            textAlign: theme.textAlign,
            fontFamily: theme.fontFamily,
            fontSize: Math.round(theme.fontSize * 0.65) + 'px',
            lineHeight: theme.lineHeight,
            letterSpacing: (theme.letterSpacing || 0) + 'px',
            color: theme.textColor,
            zIndex: 10,
            padding: '0 40px',
            textShadow: background && background.type === 'video' ? '2px 2px 8px rgba(0,0,0,0.8)' : 'none'
          }}>
            {currentSlideHeader}
          </div>
          <div style={{
            fontFamily: theme.fontFamily,
            fontSize: theme.fontSize + 'px',
            lineHeight: theme.lineHeight,
            textAlign: theme.textAlign,
            letterSpacing: (theme.letterSpacing || 0) + 'px',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '90%',
            maxHeight: '75vh',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 10,
            textShadow: background && background.type === 'video' ? '2px 2px 8px rgba(0,0,0,0.8)' : 'none'
          }}>
            {slideContent}
          </div>
        </>
      ) : (
        <div style={{
          fontFamily: theme.fontFamily,
          fontSize: theme.fontSize + 'px',
          lineHeight: theme.lineHeight,
          textAlign: theme.textAlign,
          letterSpacing: (theme.letterSpacing || 0) + 'px',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '90%',
          maxHeight: '85vh',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
          textShadow: background && background.type === 'video' ? '2px 2px 8px rgba(0,0,0,0.8)' : 'none'
        }}>
          {slideContent}
        </div>
      )}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '30px',
        fontSize: '18px',
        opacity: 0.5,
        color: isMediaFile ? 'white' : theme.textColor,
        zIndex: 10
      }}>
        {currentSlideIndex + 1} / {currentSong.slides.length}
      </div>

      {/* 工具 */}
      {notification && (
        <DraggableTool
          id="notification"
          initialX={window.innerWidth / 2 - 200}
          initialY={40}
          onClose={() => handleCloseTool('notification')}
        >
          <div style={{
            fontSize: `${notification.fontSize || 48}px`,
            color: notification.theme?.textColor || '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            textAlign: 'center',
            padding: '20px 40px',
            borderRadius: '12px',
            maxWidth: '90vw',
            lineHeight: '1.4',
            fontFamily: notification.theme?.fontFamily || 'sans-serif',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {notification.text}
          </div>
        </DraggableTool>
      )}
      {countdown && (
        <DraggableTool
          id="countdown"
          initialX={window.innerWidth - 200}
          initialY={20}
          onClose={() => handleCloseTool('countdown')}
        >
          <div style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: '#ff4444',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            textAlign: 'center',
            padding: '12px 24px',
            borderRadius: '8px',
            fontFamily: 'Courier New, monospace',
            letterSpacing: '2px',
            textShadow: '0 0 10px rgba(255, 68, 68, 0.8)'
          }}>
            {countdown.text}
          </div>
        </DraggableTool>
      )}
      {clock && (
        <DraggableTool
          id="clock"
          initialX={window.innerWidth - 180}
          initialY={countdown ? 120 : 20}
          onClose={() => handleCloseTool('clock')}
        >
          <div style={{
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            textAlign: 'center',
            padding: '10px 20px',
            borderRadius: '8px',
            fontFamily: 'Courier New, monospace',
            letterSpacing: '1px'
          }}>
            {currentTime}
          </div>
        </DraggableTool>
      )}
    </div>
  );
}

export default ProjectionPage;
