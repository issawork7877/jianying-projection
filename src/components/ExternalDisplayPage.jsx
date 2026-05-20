import React, { useState, useEffect, useRef } from 'react';

function ExternalDisplayPage() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [theme, setTheme] = useState(null);
  const [background, setBackground] = useState(null);
  const [sharingSourceId, setSharingSourceId] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not found, running in browser?');
      return;
    }

    const handleDisplayMessage = (event, message) => {
      if (message.type === 'update-content') {
        setCurrentSong(message.song);
        setCurrentSlideIndex(message.slideIndex);
        setTheme(message.theme);
        setBackground(message.background);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        setSharingSourceId(null);
      } else if (message.type === 'start-share') {
        setSharingSourceId(message.sourceId);
        startCapture(message.sourceId);
      } else if (message.type === 'stop-share') {
        stopCapture();
      }
    };

    const startCapture = async (sourceId) => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
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

    const stopCapture = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setSharingSourceId(null);
    };

    window.electronAPI.onDisplayMessage?.(handleDisplayMessage);

    const handleKeyDown = (e) => {
      if (!sharingSourceId && window.electronAPI) {
        if (e.code === 'Space' || e.code === 'ArrowRight') {
          window.electronAPI.sendToMain?.({ type: 'next-slide' });
          e.preventDefault();
        } else if (e.code === 'ArrowLeft') {
          window.electronAPI.sendToMain?.({ type: 'prev-slide' });
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (window.electronAPI) {
        window.electronAPI.removeDisplayMessageListener?.(handleDisplayMessage);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (sharingSourceId) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: 'black',
        overflow: 'hidden'
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
      </div>
    );
  }

  if (!currentSong || !theme) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 48
      }}>
        等待投影...
      </div>
    );
  }

  const slideContent = currentSong.slides[currentSlideIndex];

  let containerStyle = {
    width: '100vw',
    height: '100vh',
    color: theme.textColor,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px',
    boxSizing: 'border-box',
    overflow: 'hidden',
    position: 'relative'
  };

  if (background && background.type === 'image' && background.url) {
    containerStyle.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${background.url})`;
    containerStyle.backgroundSize = 'cover';
    containerStyle.backgroundPosition = 'center';
    containerStyle.backgroundRepeat = 'no-repeat';
  } else {
    if (theme.backgroundColor.startsWith('linear-gradient')) {
      containerStyle.background = theme.backgroundColor;
    } else {
      containerStyle.backgroundColor = theme.backgroundColor;
    }
  }

  return (
    <div style={containerStyle}>
      <div style={{
        fontFamily: theme.fontFamily,
        fontSize: (theme.fontSize || 80) + 'px',
        lineHeight: theme.lineHeight || 1.4,
        textAlign: theme.textAlign || 'center',
        whiteSpace: 'pre-wrap',
        maxWidth: '90%',
        position: 'relative',
        zIndex: 10
      }}>
        {slideContent}
      </div>
      <div style={{
        position: 'absolute',
        bottom: '25px',
        right: '35px',
        fontSize: '24px',
        opacity: 0.5,
        color: theme.textColor,
        zIndex: 10
      }}>
        {currentSlideIndex + 1} / {currentSong.slides.length}
      </div>
    </div>
  );
}

export default ExternalDisplayPage;
