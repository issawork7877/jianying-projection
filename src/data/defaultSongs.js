/**
 * 简影投屏 国际版 - 默认诗歌
 * 仅包含公版赞美诗，完整诗歌库通过 .jydata 数据包导入
 */
import { getImportedSongs } from './loader';

// 公版赞美诗精选（无版权问题，全球可用）
const publicDomainSongs = [
  {
    id: 'pd-1',
    title: 'Amazing Grace',
    author: 'John Newton (1779)',
    slides: [
      'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.',
      "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;\nHow precious did that grace appear\nThe hour I first believed!",
      'Through many dangers, toils, and snares,\nI have already come;\nThis grace has brought me safe thus far,\nAnd grace will lead me home.',
      'When we\'ve been there ten thousand years,\nBright shining as the sun,\nWe\'ve no less days to sing God\'s praise\nThan when we\'d first begun.',
    ],
    searchKey: 'amazing grace john newton',
  },
  {
    id: 'pd-2',
    title: 'Holy, Holy, Holy',
    author: 'Reginald Heber (1826)',
    slides: [
      'Holy, holy, holy! Lord God Almighty!\nEarly in the morning our song shall rise to Thee;\nHoly, holy, holy, merciful and mighty!\nGod in three Persons, blessed Trinity!',
      'Holy, holy, holy! All the saints adore Thee,\nCasting down their golden crowns around the glassy sea;\nCherubim and seraphim falling down before Thee,\nWho was, and is, and evermore shall be.',
      'Holy, holy, holy! Though the darkness hide Thee,\nThough the eye of sinful man Thy glory may not see;\nOnly Thou art holy; there is none beside Thee,\nPerfect in power, in love, and purity.',
      'Holy, holy, holy! Lord God Almighty!\nAll Thy works shall praise Thy Name, in earth, and sky, and sea;\nHoly, holy, holy; merciful and mighty!\nGod in three Persons, blessed Trinity!',
    ],
    searchKey: 'holy lord god almighty reginald heber',
  },
  {
    id: 'pd-3',
    title: 'How Great Thou Art',
    author: 'Carl Boberg (1885)',
    slides: [
      'O Lord my God, when I in awesome wonder\nConsider all the worlds Thy hands have made,\nI see the stars, I hear the rolling thunder,\nThy power throughout the universe displayed.',
      'Then sings my soul, my Savior God, to Thee:\nHow great Thou art, how great Thou art!\nThen sings my soul, my Savior God, to Thee:\nHow great Thou art, how great Thou art!',
      'And when I think that God, His Son not sparing,\nSent Him to die, I scarce can take it in,\nThat on the cross, my burden gladly bearing,\nHe bled and died to take away my sin.',
      'When Christ shall come with shout of acclamation\nAnd take me home, what joy shall fill my heart!\nThen I shall bow in humble adoration\nAnd there proclaim, my God, how great Thou art!',
    ],
    searchKey: 'how great thou art carl boberg',
  },
  {
    id: 'pd-4',
    title: 'It Is Well With My Soul',
    author: 'Horatio Spafford (1873)',
    slides: [
      'When peace, like a river, attendeth my way,\nWhen sorrows like sea billows roll;\nWhatever my lot, Thou hast taught me to say,\nIt is well, it is well with my soul.',
      'It is well with my soul,\nIt is well, it is well with my soul.',
      'Though Satan should buffet, though trials should come,\nLet this blest assurance control,\nThat Christ hath regarded my helpless estate,\nAnd hath shed His own blood for my soul.',
      'And Lord, haste the day when the faith shall be sight,\nThe clouds be rolled back as a scroll;\nThe trump shall resound, and the Lord shall descend,\nEven so, it is well with my soul.',
    ],
    searchKey: 'it is well with my soul horatio spafford',
  },
  {
    id: 'pd-5',
    title: 'Be Thou My Vision',
    author: 'Irish hymn (8th century)',
    slides: [
      'Be Thou my Vision, O Lord of my heart;\nNaught be all else to me, save that Thou art;\nThou my best thought, by day or by night,\nWaking or sleeping, Thy presence my light.',
      'Be Thou my Wisdom, and Thou my true Word;\nI ever with Thee and Thou with me, Lord;\nThou my great Father, and I Thy true son;\nThou in me dwelling, and I with Thee one.',
      'Riches I heed not, nor man\'s empty praise,\nThou mine inheritance, now and always:\nThou and Thou only, first in my heart,\nHigh King of Heaven, my Treasure Thou art.',
      'High King of Heaven, my victory won,\nMay I reach heaven\'s joys, O bright heaven\'s Sun!\nHeart of my own heart, whatever befall,\nStill be my Vision, O Ruler of all.',
    ],
    searchKey: 'be thou my vision irish hymn',
  },
];

// 构建完整诗歌列表（内置公版 + 已导入数据包）
function buildSongs() {
  const imported = getImportedSongs();
  if (imported.length > 0) {
    // 去重：以 id 为准
    const seen = new Set(publicDomainSongs.map((s) => s.id));
    const unique = imported.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
    return [...unique, ...publicDomainSongs];
  }
  return publicDomainSongs;
}

// ===== 对外接口 =====

// 默认诗歌列表
export const defaultSongs = buildSongs();

/**
 * 刷新诗歌数据（导入数据包后调用）
 */
export function refreshSongs() {
  return buildSongs();
}

// 文本导入帮助函数
export function parseSongsFromText(text) {
  const blocks = text.split(/===\n?/).filter((b) => b.trim());
  return blocks.map((block, index) => {
    const lines = block.trim().split('\n').filter((l) => l.trim());
    const title = lines[0].trim();
    const lyrics = lines.slice(1).join('\n');
    const slides = lyrics.split(/\n\s*\n/).map((s) => s.trim()).filter((s) => s);

    return {
      id: `pd-import-${Date.now()}-${index}`,
      title,
      author: '',
      slides,
      searchKey: title.toLowerCase(),
    };
  });
}
