import React, { useState, useEffect, useRef } from 'react';

function LiveDisplayPage() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [theme, setTheme] = useState(null);
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

    return () => {
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
        backgroundColor: 'transparent',
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
        backgroundColor: 'transparent',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 36,
        textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
      }}>
        直播屏幕
      </div>
    );
  }

  const slideContent = currentSong.slides[currentSlideIndex];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      color: theme.textColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative',
      textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
    }}>
      <div style={{
        fontFamily: theme.fontFamily,
        fontSize: '72px',
        lineHeight: theme.lineHeight || 1.4,
        textAlign: theme.textAlign || 'center',
        whiteSpace: 'pre-wrap',
        maxWidth: '90%',
        position: 'relative',
        zIndex: 10
      }}>
        {slideContent}
      </div>
    </div>
  );
}

export default LiveDisplayPage;
