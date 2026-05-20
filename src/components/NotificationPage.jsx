import React, { useState, useEffect } from 'react';
import electronAPI from '../utils/electronAPI';

function NotificationPage() {
  const [notificationData, setNotificationData] = useState(null);
  const [countdownData, setCountdownData] = useState(null);
  const [clockData, setClockData] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const handleNotificationData = (event, data) => {
      setNotificationData(data);
    };

    const handleCountdownData = (event, data) => {
      setCountdownData(data);
    };

    const handleClockData = (event, data) => {
      setClockData(data);
    };

    electronAPI.onNotificationData(handleNotificationData);
    electronAPI.onCountdownData(handleCountdownData);
    electronAPI.onClockData(handleClockData);

    return () => {
      electronAPI.removeNotificationDataListener(handleNotificationData);
      electronAPI.removeCountdownDataListener(handleCountdownData);
      electronAPI.removeClockDataListener(handleClockData);
    };
  }, []);

  useEffect(() => {
    if (!clockData?.show) return;

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
  }, [clockData?.show]);

  return (
    <>
      {/* 通知 - 顶端居中 */}
      {notificationData && notificationData.show && (
        <div style={{
          position: 'fixed',
          top: '40px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            fontSize: `${notificationData.fontSize || 48}px`,
            color: notificationData.theme?.textColor || '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            textAlign: 'center',
            padding: '20px 40px',
            borderRadius: '12px',
            maxWidth: '90%',
            lineHeight: '1.4',
            fontFamily: notificationData.theme?.fontFamily || 'sans-serif',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}>
            {notificationData.text}
          </div>
        </div>
      )}

      {/* 倒计时 - 右上角 */}
      {countdownData && countdownData.show && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
        }}>
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
            textShadow: '0 0 10px rgba(255, 68, 68, 0.8)',
          }}>
            {countdownData.text}
          </div>
        </div>
      )}

      {/* 时钟 - 右上角（在倒计时下方） */}
      {clockData && clockData.show && (
        <div style={{
          position: 'fixed',
          top: countdownData?.show ? '100px' : '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            fontSize: '32px',
            color: '#ffffff',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            textAlign: 'center',
            padding: '10px 20px',
            borderRadius: '8px',
            fontFamily: 'Courier New, monospace',
            letterSpacing: '1px',
          }}>
            {currentTime}
          </div>
        </div>
      )}
    </>
  );
}

export default NotificationPage;
