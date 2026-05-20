// 默认歌单数据
export const defaultPlaylists = [
  {
    id: 'default-sunday',
    name: '主日崇拜',
    description: '每周主日崇拜常用诗歌',
    items: [
      { type: 'song', id: 1, note: '开场赞美' },
      { type: 'song', id: 2, note: '敬拜' },
      { type: 'song', id: 3, note: '感恩' },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// 歌单项类型
export const PLAYLIST_ITEM_TYPES = {
  SONG: 'song',
  BIBLE: 'bible',
  MEDIA: 'media',
  NOTE: 'note',
};
