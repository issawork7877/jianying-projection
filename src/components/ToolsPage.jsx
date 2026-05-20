import React, { useState, useEffect } from 'react';

function DraggableTool({ id, initialX, initialY, children, onClose }) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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
          display: 'flex',
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

function ToolsPage() {
  const [notification, setNotification] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [clock, setClock] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

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
      return;
    }

    const handleToolUpdate = (event, data) => {
      if (data.type === 'notification') {
        setNotification(data.show ? data : null);
      } else if (data.type === 'countdown') {
        setCountdown(data.show ? data : null);
      } else if (data.type === 'clock') {
        setClock(data.show ? data : null);
      }
    };

    window.electronAPI.onToolUpdate(handleToolUpdate);

    return () => {
      window.electronAPI.removeListener('tool-update', handleToolUpdate);
    };
  }, []);

  const handleCloseTool = (toolType) => {
    if (toolType === 'notification') {
      setNotification(null);
    } else if (toolType === 'countdown') {
      setCountdown(null);
    } else if (toolType === 'clock') {
      setClock(null);
    }
    if (window.electronAPI) {
      window.electronAPI.sendToMain({ type: 'tool-closed', tool: toolType });
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: 'transparent',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* 通知工具 */}
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

      {/* 倒计时工具 */}
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

      {/* 时钟工具 */}
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

export default ToolsPage;
