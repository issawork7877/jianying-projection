// 主题配置

export const themes = [
  {
    id: 'classic-black',
    name: '经典黑底',
    shortName: '黑',
    backgroundColor: '#323341',
    textColor: '#ffffff',
    fontFamily: 'Noto Sans SC, sans-serif',
    fontSize: 56,
    lineHeight: 1.4,
    textAlign: 'left',
    description: '经典黑底白字，大多数投影都适用'
  },
  {
    id: 'classic-white',
    name: '经典白底',
    shortName: '白',
    backgroundColor: '#ffffff',
    textColor: '#000000',
    fontFamily: 'Noto Sans SC, sans-serif',
    fontSize: 56,
    lineHeight: 1.4,
    textAlign: 'left',
    description: '白底黑字，适合亮环境'
  },
  {
    id: 'blue-gradient',
    name: '蓝色渐变',
    shortName: '蓝',
    backgroundColor: 'linear-gradient(135deg, #1a365d 0%, #2c5282 100%)',
    textColor: '#f7fafc',
    fontFamily: 'Noto Sans SC, sans-serif',
    fontSize: 56,
    lineHeight: 1.4,
    textAlign: 'left',
    description: '优雅蓝色背景'
  },
  {
    id: 'green-church',
    name: '教会绿',
    shortName: '绿',
    backgroundColor: 'linear-gradient(135deg, #0f4c2c 0%, #1a693e 100%)',
    textColor: '#f0fff4',
    fontFamily: 'Noto Sans SC, sans-serif',
    fontSize: 56,
    lineHeight: 1.4,
    textAlign: 'left',
    description: '传统教会风格绿色'
  },
  {
    id: 'cross-bg',
    name: '十字架背景',
    shortName: '十',
    backgroundColor: '#323341',
    textColor: '#e53e3e',
    fontFamily: 'Noto Sans SC, sans-serif',
    fontSize: 56,
    lineHeight: 1.4,
    textAlign: 'left',
    description: '红色文字，黑色背景'
  }
];

export default themes;
