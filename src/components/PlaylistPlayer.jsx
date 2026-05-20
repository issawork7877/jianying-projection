import React, { useState, useEffect, useRef } from 'react';
import { PLAYLIST_ITEM_TYPES } from '../data/playlists';

function PlaylistPlayer({
  playlist,
  songs,
  onSelectItem,
  currentItemIndex,
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
}) {
  const [currentTime, setCurrentTime] = useState(0);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(false);
  const [autoPlayInterval, setAutoPlayInterval] = useState(10); // seconds
  const timerRef = useRef(null);

  useEffect(() => {
    if (autoPlayEnabled && isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= autoPlayInterval - 1) {
            onNext?.();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setCurrentTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoPlayEnabled, isPlaying, autoPlayInterval, onNext]);

  useEffect(() => {
    setCurrentTime(0);
  }, [currentItemIndex]);

  if (!playlist) return null;

  const currentItem = playlist.items[currentItemIndex];

  const getItemDisplay = (item) => {
    switch (item.type) {
      case PLAYLIST_ITEM_TYPES.SONG:
        const song = songs.find(s => s.id === item.id);
        return {
          icon: '🎵',
          title: song?.title || item.title || '未知歌曲',
        };
      case PLAYLIST_ITEM_TYPES.BIBLE:
        return {
          icon: '📖',
          title: item.ref || '未知经文',
        };
      case PLAYLIST_ITEM_TYPES.MEDIA:
        return {
          icon: '🎬',
          title: item.title || '未知媒体',
        };
      case PLAYLIST_ITEM_TYPES.NOTE:
        return {
          icon: '📝',
          title: item.content?.substring(0, 20) || '备注',
        };
      default:
        return { icon: '❓', title: '未知项目' };
    }
  };

  return (
    <div className="playlist-player">
      <div className="player-header">
        <h3>📋 {playlist.name}</h3>
        <div className="player-status">
          {isPlaying ? (
            <span className="status-playing">▶ 播放中</span>
          ) : (
            <span className="status-paused">⏸ 已暂停</span>
          )}
        </div>
      </div>

      {/* 当前项目 */}
      {currentItem && (
        <div className="current-playing-item">
          <div className="current-item-display">
            <span className="item-icon">
              {getItemDisplay(currentItem).icon}
            </span>
            <div className="item-info">
              <div className="item-title-large">
                {getItemDisplay(currentItem).title}
              </div>
              {currentItem.note && (
                <div className="item-note-small">{currentItem.note}</div>
              )}
            </div>
          </div>
          <div className="item-progress">
            {currentItemIndex + 1} / {playlist.items.length}
          </div>
        </div>
      )}

      {/* 播放控制 */}
      <div className="player-controls">
        <button
          className="control-btn"
          onClick={onPrev}
          disabled={currentItemIndex <= 0}
        >
          ⏮ 上一个
        </button>
        <button
          className="control-btn primary"
          onClick={onPlayPause}
        >
          {isPlaying ? '⏸ 暂停' : '▶ 开始'}
        </button>
        <button
          className="control-btn"
          onClick={onNext}
          disabled={currentItemIndex >= playlist.items.length - 1}
        >
          下一个 ⏭
        </button>
      </div>

      {/* 自动播放设置 */}
      <div className="auto-play-settings">
        <label className="auto-play-toggle">
          <input
            type="checkbox"
            checked={autoPlayEnabled}
            onChange={(e) => setAutoPlayEnabled(e.target.checked)}
          />
          自动播放
        </label>
        {autoPlayEnabled && (
          <div className="auto-play-interval">
            <span>每页停留：</span>
            <select
              value={autoPlayInterval}
              onChange={(e) => setAutoPlayInterval(Number(e.target.value))}
            >
              <option value={5}>5秒</option>
              <option value={10}>10秒</option>
              <option value={15}>15秒</option>
              <option value={30}>30秒</option>
              <option value={60}>1分钟</option>
            </select>
            <span className="countdown">
              ({autoPlayInterval - currentTime}秒后切换)
            </span>
          </div>
        )}
      </div>

      {/* 歌单项目列表 */}
      <div className="playlist-items-mini">
        <h4>歌单项目</h4>
        <div className="mini-list">
          {playlist.items.map((item, index) => {
            const display = getItemDisplay(item);
            return (
              <div
                key={index}
                className={`mini-item ${index === currentItemIndex ? 'active' : ''}`}
                onClick={() => onSelectItem(index)}
              >
                <span className="mini-index">{index + 1}</span>
                <span className="mini-icon">{display.icon}</span>
                <span className="mini-title">{display.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .playlist-player {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 16px;
        }
        .player-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .player-header h3 {
          margin: 0;
          font-size: 16px;
        }
        .status-playing {
          color: #28a745;
          font-weight: bold;
        }
        .status-paused {
          color: #6c757d;
        }
        .current-playing-item {
          background: white;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          border: 2px solid #667eea;
        }
        .current-item-display {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .item-icon {
          font-size: 32px;
        }
        .item-info {
          flex: 1;
        }
        .item-title-large {
          font-size: 18px;
          font-weight: bold;
        }
        .item-note-small {
          font-size: 12px;
          color: #666;
        }
        .item-progress {
          text-align: right;
          color: #667eea;
          font-weight: bold;
        }
        .player-controls {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .control-btn {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          background: #e9ecef;
        }
        .control-btn:hover:not(:disabled) {
          background: #dee2e6;
        }
        .control-btn.primary {
          background: #667eea;
          color: white;
        }
        .control-btn.primary:hover {
          background: #5a6fd6;
        }
        .control-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .auto-play-settings {
          background: white;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .auto-play-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }
        .auto-play-interval {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }
        .countdown {
          color: #667eea;
          font-weight: bold;
        }
        .playlist-items-mini h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
        }
        .mini-list {
          max-height: 200px;
          overflow-y: auto;
          background: white;
          border-radius: 6px;
        }
        .mini-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 1px solid #f0f0f0;
        }
        .mini-item:hover {
          background: #f5f5f5;
        }
        .mini-item.active {
          background: #667eea;
          color: white;
        }
        .mini-index {
          width: 24px;
          text-align: center;
          font-weight: bold;
        }
        .mini-title {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}

export default PlaylistPlayer;
