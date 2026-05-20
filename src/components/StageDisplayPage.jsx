import React, { useState, useEffect } from 'react';

function StageDisplayPage() {
  const [currentSong, setCurrentSong] = useState(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [nextSlideIndex, setNextSlideIndex] = useState(1);
  const [theme, setTheme] = useState(null);
  const [timer, setTimer] = useState('00:00:00');
  const [startTime, setStartTime] = useState(null);

  useEffect(() => {
    if (!window.electronAPI) {
      console.error('electronAPI not found, running in browser?');
      return;
    }

    const handleDisplayMessage = (event, message) => {
      if (message.type === 'update-content') {
        setCurrentSong(message.song);
        setCurrentSlideIndex(message.slideIndex);
        setNextSlideIndex(Math.min(message.slideIndex + 1, message.song?.slides.length - 1 || 0));
        if (!startTime) {
          setStartTime(Date.now());
        }
      }
    };

    window.electronAPI.onDisplayMessage?.(handleDisplayMessage);

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeDisplayMessageListener?.(handleDisplayMessage);
      }
    };
  }, [startTime]);

  useEffect(() => {
    if (!startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setTimer(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  if (!currentSong) {
    return (
      <div style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#1a1a1a',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 32
      }}>
        <div>舞台提示屏</div>
        <div style={{ fontSize: 18, marginTop: 20, opacity: 0.7 }}>等待投影开始...</div>
      </div>
    );
  }

  const currentSlide = currentSong.slides[currentSlideIndex];
  const nextSlide = currentSong.slides[nextSlideIndex];

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#0d1117',
      color: '#c9d1d9',
      display: 'flex',
      flexDirection: 'column',
      padding: '30px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* 顶部信息栏 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        borderBottom: '1px solid #30363d'
      }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#58a6ff' }}>
          {currentSong.title}
        </div>
        <div style={{ fontSize: 48, fontWeight: 'bold', fontFamily: 'monospace', color: '#7ee787' }}>
          {timer}
        </div>
      </div>

      {/* 主要内容区域 */}
      <div style={{
        display: 'flex',
        flex: 1,
        gap: '20px',
        paddingTop: '20px'
      }}>
        {/* 当前幻灯片 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#161b22',
          borderRadius: '12px',
          padding: '24px',
          border: '2px solid #238636'
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#7ee787',
            marginBottom: '16px'
          }}>
            当前 (第 {currentSlideIndex + 1} / {currentSong.slides.length} 页)
          </div>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '42px',
            lineHeight: 1.5,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            color: '#ffffff'
          }}>
            {currentSlide}
          </div>
        </div>

        {/* 下一页幻灯片 */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#161b22',
          borderRadius: '12px',
          padding: '24px',
          border: '2px solid #30363d',
          opacity: 0.8
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 600,
            color: '#8b949e',
            marginBottom: '16px'
          }}>
            下一页 (第 {nextSlideIndex + 1} 页)
          </div>
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            lineHeight: 1.5,
            textAlign: 'center',
            whiteSpace: 'pre-wrap',
            color: '#8b949e'
          }}>
            {nextSlide || '（已是最后一页）'}
          </div>
        </div>
      </div>

      {/* 底部备注 */}
      <div style={{
        marginTop: '20px',
        paddingTop: '20px',
        borderTop: '1px solid #30363d',
        fontSize: 16,
        color: '#8b949e',
        textAlign: 'center'
      }}>
        按 ← → 键翻页 | 按 L 键锁定投影
      </div>
    </div>
  );
}

export default StageDisplayPage;
