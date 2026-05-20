export const bibleBooks = [
  { id: 'genesis', testament: 'old', chapters: 50, names: { 'zh-Hans': '创世记', en: 'Genesis', 'zh-Hant': '創世記' }, shortNames: { 'zh-Hans': '创', en: 'Gen', 'zh-Hant': '創' }, aliases: ['创', '创世', '創', '創世', 'gen', 'genesis', 'c', 'csj'] },
  { id: 'exodus', testament: 'old', chapters: 40, names: { 'zh-Hans': '出埃及记', en: 'Exodus', 'zh-Hant': '出埃及記' }, shortNames: { 'zh-Hans': '出', en: 'Exo', 'zh-Hant': '出' }, aliases: ['出', '出埃及', 'exo', 'exodus', 'caj'] },
  { id: 'leviticus', testament: 'old', chapters: 27, names: { 'zh-Hans': '利未记', en: 'Leviticus', 'zh-Hant': '利未記' }, shortNames: { 'zh-Hans': '利', en: 'Lev', 'zh-Hant': '利' }, aliases: ['利', '利未', 'lev', 'leviticus', 'lwj'] },
  { id: 'numbers', testament: 'old', chapters: 36, names: { 'zh-Hans': '民数记', en: 'Numbers', 'zh-Hant': '民數記' }, shortNames: { 'zh-Hans': '民', en: 'Num', 'zh-Hant': '民' }, aliases: ['民', '民数', '民數', 'num', 'numbers', 'msj'] },
  { id: 'deuteronomy', testament: 'old', chapters: 34, names: { 'zh-Hans': '申命记', en: 'Deuteronomy', 'zh-Hant': '申命記' }, shortNames: { 'zh-Hans': '申', en: 'Deu', 'zh-Hant': '申' }, aliases: ['申', '申命', 'deu', 'deuteronomy', 'smj'] },
  { id: 'joshua', testament: 'old', chapters: 24, names: { 'zh-Hans': '约书亚记', en: 'Joshua', 'zh-Hant': '約書亞記' }, shortNames: { 'zh-Hans': '书', en: 'Josh', 'zh-Hant': '書' }, aliases: ['书', '書', '约书亚', '約書亞', 'jos', 'josh', 'joshua', 'ysy'] },
  { id: 'judges', testament: 'old', chapters: 21, names: { 'zh-Hans': '士师记', en: 'Judges', 'zh-Hant': '士師記' }, shortNames: { 'zh-Hans': '士', en: 'Judg', 'zh-Hant': '士' }, aliases: ['士', '士师', '士師', 'judg', 'judges', 'ssj'] },
  { id: 'ruth', testament: 'old', chapters: 4, names: { 'zh-Hans': '路得记', en: 'Ruth', 'zh-Hant': '路得記' }, shortNames: { 'zh-Hans': '得', en: 'Ruth', 'zh-Hant': '得' }, aliases: ['得', '路得', 'rut', 'ruth', 'ldj'] },
  { id: '1-samuel', testament: 'old', chapters: 31, names: { 'zh-Hans': '撒母耳记上', en: '1 Samuel', 'zh-Hant': '撒母耳記上' }, shortNames: { 'zh-Hans': '撒上', en: '1Sa', 'zh-Hant': '撒上' }, aliases: ['撒上', '撒母耳上', '1sa', '1 samuel', '1samuel', 'smes'] },
  { id: '2-samuel', testament: 'old', chapters: 24, names: { 'zh-Hans': '撒母耳记下', en: '2 Samuel', 'zh-Hant': '撒母耳記下' }, shortNames: { 'zh-Hans': '撒下', en: '2Sa', 'zh-Hant': '撒下' }, aliases: ['撒下', '撒母耳下', '2sa', '2 samuel', '2samuel', 'smex'] },
  { id: '1-kings', testament: 'old', chapters: 22, names: { 'zh-Hans': '列王纪上', en: '1 Kings', 'zh-Hant': '列王紀上' }, shortNames: { 'zh-Hans': '王上', en: '1Ki', 'zh-Hant': '王上' }, aliases: ['王上', '列王上', '1ki', '1 kings', '1kings', 'lwjs'] },
  { id: '2-kings', testament: 'old', chapters: 25, names: { 'zh-Hans': '列王纪下', en: '2 Kings', 'zh-Hant': '列王紀下' }, shortNames: { 'zh-Hans': '王下', en: '2Ki', 'zh-Hant': '王下' }, aliases: ['王下', '列王下', '2ki', '2 kings', '2kings', 'lwjx'] },
  { id: '1-chronicles', testament: 'old', chapters: 29, names: { 'zh-Hans': '历代志上', en: '1 Chronicles', 'zh-Hant': '歷代志上' }, shortNames: { 'zh-Hans': '代上', en: '1Ch', 'zh-Hant': '代上' }, aliases: ['代上', '历代上', '歷代上', '1ch', '1 chronicles', '1chronicles', 'ldzs'] },
  { id: '2-chronicles', testament: 'old', chapters: 36, names: { 'zh-Hans': '历代志下', en: '2 Chronicles', 'zh-Hant': '歷代志下' }, shortNames: { 'zh-Hans': '代下', en: '2Ch', 'zh-Hant': '代下' }, aliases: ['代下', '历代下', '歷代下', '2ch', '2 chronicles', '2chronicles', 'ldzx'] },
  { id: 'ezra', testament: 'old', chapters: 10, names: { 'zh-Hans': '以斯拉记', en: 'Ezra', 'zh-Hant': '以斯拉記' }, shortNames: { 'zh-Hans': '拉', en: 'Ezra', 'zh-Hant': '拉' }, aliases: ['拉', '以斯拉', 'ezr', 'ezra', 'ysl'] },
  { id: 'nehemiah', testament: 'old', chapters: 13, names: { 'zh-Hans': '尼希米记', en: 'Nehemiah', 'zh-Hant': '尼希米記' }, shortNames: { 'zh-Hans': '尼', en: 'Neh', 'zh-Hant': '尼' }, aliases: ['尼', '尼希米', 'neh', 'nehemiah', 'nxm'] },
  { id: 'esther', testament: 'old', chapters: 10, names: { 'zh-Hans': '以斯帖记', en: 'Esther', 'zh-Hant': '以斯帖記' }, shortNames: { 'zh-Hans': '斯', en: 'Est', 'zh-Hant': '斯' }, aliases: ['斯', '以斯帖', 'est', 'esther', 'yst'] },
  { id: 'job', testament: 'old', chapters: 42, names: { 'zh-Hans': '约伯记', en: 'Job', 'zh-Hant': '約伯記' }, shortNames: { 'zh-Hans': '伯', en: 'Job', 'zh-Hant': '伯' }, aliases: ['伯', '约伯', '約伯', 'job', 'ybj'] },
  { id: 'psalms', testament: 'old', chapters: 150, names: { 'zh-Hans': '诗篇', en: 'Psalms', 'zh-Hant': '詩篇' }, shortNames: { 'zh-Hans': '诗', en: 'Ps', 'zh-Hant': '詩' }, aliases: ['诗', '詩', '诗篇', '詩篇', 'ps', 'psalm', 'psalms', 'sp'] },
  { id: 'proverbs', testament: 'old', chapters: 31, names: { 'zh-Hans': '箴言', en: 'Proverbs', 'zh-Hant': '箴言' }, shortNames: { 'zh-Hans': '箴', en: 'Prov', 'zh-Hant': '箴' }, aliases: ['箴', '箴言', 'prov', 'proverbs', 'zy'] },
  { id: 'ecclesiastes', testament: 'old', chapters: 12, names: { 'zh-Hans': '传道书', en: 'Ecclesiastes', 'zh-Hant': '傳道書' }, shortNames: { 'zh-Hans': '传', en: 'Eccl', 'zh-Hant': '傳' }, aliases: ['传', '傳', '传道', '傳道', 'eccl', 'ecclesiastes', 'cds'] },
  { id: 'song-of-songs', testament: 'old', chapters: 8, names: { 'zh-Hans': '雅歌', en: 'Song of Songs', 'zh-Hant': '雅歌' }, shortNames: { 'zh-Hans': '歌', en: 'Song', 'zh-Hant': '歌' }, aliases: ['歌', '雅歌', 'song', 'song of songs', 'songs', 'yg'] },
  { id: 'isaiah', testament: 'old', chapters: 66, names: { 'zh-Hans': '以赛亚书', en: 'Isaiah', 'zh-Hant': '以賽亞書' }, shortNames: { 'zh-Hans': '赛', en: 'Isa', 'zh-Hant': '賽' }, aliases: ['赛', '賽', '以赛亚', '以賽亞', 'isa', 'isaiah', 'ysy'] },
  { id: 'jeremiah', testament: 'old', chapters: 52, names: { 'zh-Hans': '耶利米书', en: 'Jeremiah', 'zh-Hant': '耶利米書' }, shortNames: { 'zh-Hans': '耶', en: 'Jer', 'zh-Hant': '耶' }, aliases: ['耶', '耶利米', 'jer', 'jeremiah', 'ylm'] },
  { id: 'lamentations', testament: 'old', chapters: 5, names: { 'zh-Hans': '耶利米哀歌', en: 'Lamentations', 'zh-Hant': '耶利米哀歌' }, shortNames: { 'zh-Hans': '哀', en: 'Lam', 'zh-Hant': '哀' }, aliases: ['哀', '哀歌', 'lam', 'lamentations', 'ylmag'] },
  { id: 'ezekiel', testament: 'old', chapters: 48, names: { 'zh-Hans': '以西结书', en: 'Ezekiel', 'zh-Hant': '以西結書' }, shortNames: { 'zh-Hans': '结', en: 'Eze', 'zh-Hant': '結' }, aliases: ['结', '結', '以西结', '以西結', 'eze', 'ezekiel', 'yxj'] },
  { id: 'daniel', testament: 'old', chapters: 12, names: { 'zh-Hans': '但以理书', en: 'Daniel', 'zh-Hant': '但以理書' }, shortNames: { 'zh-Hans': '但', en: 'Dan', 'zh-Hant': '但' }, aliases: ['但', '但以理', 'dan', 'daniel', 'dyl'] },
  { id: 'hosea', testament: 'old', chapters: 14, names: { 'zh-Hans': '何西阿书', en: 'Hosea', 'zh-Hant': '何西阿書' }, shortNames: { 'zh-Hans': '何', en: 'Hos', 'zh-Hant': '何' }, aliases: ['何', '何西阿', 'hos', 'hosea', 'hxh'] },
  { id: 'joel', testament: 'old', chapters: 3, names: { 'zh-Hans': '约珥书', en: 'Joel', 'zh-Hant': '約珥書' }, shortNames: { 'zh-Hans': '珥', en: 'Joel', 'zh-Hant': '珥' }, aliases: ['珥', '约珥', '約珥', 'joel', 'ye'] },
  { id: 'amos', testament: 'old', chapters: 9, names: { 'zh-Hans': '阿摩司书', en: 'Amos', 'zh-Hant': '阿摩司書' }, shortNames: { 'zh-Hans': '摩', en: 'Amos', 'zh-Hant': '摩' }, aliases: ['摩', '阿摩司', 'amos', 'ams'] },
  { id: 'obadiah', testament: 'old', chapters: 1, names: { 'zh-Hans': '俄巴底亚书', en: 'Obadiah', 'zh-Hant': '俄巴底亞書' }, shortNames: { 'zh-Hans': '俄', en: 'Obad', 'zh-Hant': '俄' }, aliases: ['俄', '俄巴底亚', '俄巴底亞', 'obad', 'obadiah', 'ebdy'] },
  { id: 'jonah', testament: 'old', chapters: 4, names: { 'zh-Hans': '约拿书', en: 'Jonah', 'zh-Hant': '約拿書' }, shortNames: { 'zh-Hans': '拿', en: 'Jonah', 'zh-Hant': '拿' }, aliases: ['拿', '约拿', '約拿', 'jon', 'jonah', 'yn'] },
  { id: 'micah', testament: 'old', chapters: 7, names: { 'zh-Hans': '弥迦书', en: 'Micah', 'zh-Hant': '彌迦書' }, shortNames: { 'zh-Hans': '弥', en: 'Mic', 'zh-Hant': '彌' }, aliases: ['弥', '彌', '弥迦', '彌迦', 'mic', 'micah', 'mj'] },
  { id: 'nahum', testament: 'old', chapters: 3, names: { 'zh-Hans': '那鸿书', en: 'Nahum', 'zh-Hant': '那鴻書' }, shortNames: { 'zh-Hans': '鸿', en: 'Nah', 'zh-Hant': '鴻' }, aliases: ['鸿', '鴻', '那鸿', '那鴻', 'nah', 'nahum', 'nh'] },
  { id: 'habakkuk', testament: 'old', chapters: 3, names: { 'zh-Hans': '哈巴谷书', en: 'Habakkuk', 'zh-Hant': '哈巴谷書' }, shortNames: { 'zh-Hans': '哈', en: 'Hab', 'zh-Hant': '哈' }, aliases: ['哈', '哈巴谷', 'hab', 'habakkuk', 'hbg'] },
  { id: 'zephaniah', testament: 'old', chapters: 3, names: { 'zh-Hans': '西番雅书', en: 'Zephaniah', 'zh-Hant': '西番雅書' }, shortNames: { 'zh-Hans': '番', en: 'Zeph', 'zh-Hant': '番' }, aliases: ['番', '西番雅', 'zeph', 'zephaniah', 'xfy'] },
  { id: 'haggai', testament: 'old', chapters: 2, names: { 'zh-Hans': '哈该书', en: 'Haggai', 'zh-Hant': '哈該書' }, shortNames: { 'zh-Hans': '该', en: 'Hag', 'zh-Hant': '該' }, aliases: ['该', '該', '哈该', '哈該', 'hag', 'haggai', 'hg'] },
  { id: 'zechariah', testament: 'old', chapters: 14, names: { 'zh-Hans': '撒迦利亚书', en: 'Zechariah', 'zh-Hant': '撒迦利亞書' }, shortNames: { 'zh-Hans': '亚', en: 'Zech', 'zh-Hant': '亞' }, aliases: ['亚', '亞', '撒迦利亚', '撒迦利亞', 'zech', 'zechariah', 'zjly'] },
  { id: 'malachi', testament: 'old', chapters: 4, names: { 'zh-Hans': '玛拉基书', en: 'Malachi', 'zh-Hant': '瑪拉基書' }, shortNames: { 'zh-Hans': '玛', en: 'Mal', 'zh-Hant': '瑪' }, aliases: ['玛', '瑪', '玛拉基', '瑪拉基', 'mal', 'malachi', 'mlj'] },
  { id: 'matthew', testament: 'new', chapters: 28, names: { 'zh-Hans': '马太福音', en: 'Matthew', 'zh-Hant': '馬太福音' }, shortNames: { 'zh-Hans': '太', en: 'Matt', 'zh-Hant': '太' }, aliases: ['太', '马太', '馬太', 'matt', 'matthew', 'mt', 'mtfy', 'm'] },
  { id: 'mark', testament: 'new', chapters: 16, names: { 'zh-Hans': '马可福音', en: 'Mark', 'zh-Hant': '馬可福音' }, shortNames: { 'zh-Hans': '可', en: 'Mark', 'zh-Hant': '可' }, aliases: ['可', '马可', '馬可', 'mark', 'mk', 'mkfy'] },
  { id: 'luke', testament: 'new', chapters: 24, names: { 'zh-Hans': '路加福音', en: 'Luke', 'zh-Hant': '路加福音' }, shortNames: { 'zh-Hans': '路', en: 'Luke', 'zh-Hant': '路' }, aliases: ['路', '路加', 'luke', 'luk', 'lkfy', 'l'] },
  { id: 'john', testament: 'new', chapters: 21, names: { 'zh-Hans': '约翰福音', en: 'John', 'zh-Hant': '約翰福音' }, shortNames: { 'zh-Hans': '约', en: 'Jn', 'zh-Hant': '約' }, aliases: ['约', '約', '约翰', '約翰', 'john', 'jn', 'jhn', 'yhfy', 'y'] },
  { id: 'acts', testament: 'new', chapters: 28, names: { 'zh-Hans': '使徒行传', en: 'Acts', 'zh-Hant': '使徒行傳' }, shortNames: { 'zh-Hans': '徒', en: 'Acts', 'zh-Hant': '徒' }, aliases: ['徒', '行传', '行傳', 'acts', 'act', 'xtxz'] },
  { id: 'romans', testament: 'new', chapters: 16, names: { 'zh-Hans': '罗马书', en: 'Romans', 'zh-Hant': '羅馬書' }, shortNames: { 'zh-Hans': '罗', en: 'Rom', 'zh-Hant': '羅' }, aliases: ['罗', '羅', '罗马', '羅馬', 'rom', 'romans', 'lms'] },
  { id: '1-corinthians', testament: 'new', chapters: 16, names: { 'zh-Hans': '哥林多前书', en: '1 Corinthians', 'zh-Hant': '哥林多前書' }, shortNames: { 'zh-Hans': '林前', en: '1Co', 'zh-Hant': '林前' }, aliases: ['林前', '哥林多前', '1co', '1 corinthians', '1corinthians', 'gldqs'] },
  { id: '2-corinthians', testament: 'new', chapters: 13, names: { 'zh-Hans': '哥林多后书', en: '2 Corinthians', 'zh-Hant': '哥林多後書' }, shortNames: { 'zh-Hans': '林后', en: '2Co', 'zh-Hant': '林後' }, aliases: ['林后', '林後', '哥林多后', '哥林多後', '2co', '2 corinthians', '2corinthians', 'gldhs'] },
  { id: 'galatians', testament: 'new', chapters: 6, names: { 'zh-Hans': '加拉太书', en: 'Galatians', 'zh-Hant': '加拉太書' }, shortNames: { 'zh-Hans': '加', en: 'Gal', 'zh-Hant': '加' }, aliases: ['加', '加拉太', 'gal', 'galatians', 'jlts'] },
  { id: 'ephesians', testament: 'new', chapters: 6, names: { 'zh-Hans': '以弗所书', en: 'Ephesians', 'zh-Hant': '以弗所書' }, shortNames: { 'zh-Hans': '弗', en: 'Eph', 'zh-Hant': '弗' }, aliases: ['弗', '以弗所', 'eph', 'ephesians', 'yfs'] },
  { id: 'philippians', testament: 'new', chapters: 4, names: { 'zh-Hans': '腓立比书', en: 'Philippians', 'zh-Hant': '腓立比書' }, shortNames: { 'zh-Hans': '腓', en: 'Phil', 'zh-Hant': '腓' }, aliases: ['腓', '腓立比', 'phil', 'philippians', 'flb'] },
  { id: 'colossians', testament: 'new', chapters: 4, names: { 'zh-Hans': '歌罗西书', en: 'Colossians', 'zh-Hant': '歌羅西書' }, shortNames: { 'zh-Hans': '西', en: 'Col', 'zh-Hant': '西' }, aliases: ['西', '歌罗西', '歌羅西', 'col', 'colossians', 'glx'] },
  { id: '1-thessalonians', testament: 'new', chapters: 5, names: { 'zh-Hans': '帖撒罗尼迦前书', en: '1 Thessalonians', 'zh-Hant': '帖撒羅尼迦前書' }, shortNames: { 'zh-Hans': '帖前', en: '1Th', 'zh-Hant': '帖前' }, aliases: ['帖前', '帖撒罗尼迦前', '帖撒羅尼迦前', '1th', '1 thessalonians', '1thessalonians', 'tslnjqs'] },
  { id: '2-thessalonians', testament: 'new', chapters: 3, names: { 'zh-Hans': '帖撒罗尼迦后书', en: '2 Thessalonians', 'zh-Hant': '帖撒羅尼迦後書' }, shortNames: { 'zh-Hans': '帖后', en: '2Th', 'zh-Hant': '帖後' }, aliases: ['帖后', '帖後', '帖撒罗尼迦后', '帖撒羅尼迦後', '2th', '2 thessalonians', '2thessalonians', 'tslnjhs'] },
  { id: '1-timothy', testament: 'new', chapters: 6, names: { 'zh-Hans': '提摩太前书', en: '1 Timothy', 'zh-Hant': '提摩太前書' }, shortNames: { 'zh-Hans': '提前', en: '1Ti', 'zh-Hant': '提前' }, aliases: ['提前', '提摩太前', '1ti', '1 timothy', '1timothy', 'tmtqs'] },
  { id: '2-timothy', testament: 'new', chapters: 4, names: { 'zh-Hans': '提摩太后书', en: '2 Timothy', 'zh-Hant': '提摩太後書' }, shortNames: { 'zh-Hans': '提后', en: '2Ti', 'zh-Hant': '提後' }, aliases: ['提后', '提後', '提摩太后', '提摩太後', '2ti', '2 timothy', '2timothy', 'tmths'] },
  { id: 'titus', testament: 'new', chapters: 3, names: { 'zh-Hans': '提多书', en: 'Titus', 'zh-Hant': '提多書' }, shortNames: { 'zh-Hans': '多', en: 'Tit', 'zh-Hant': '多' }, aliases: ['多', '提多', 'tit', 'titus', 'tds'] },
  { id: 'philemon', testament: 'new', chapters: 1, names: { 'zh-Hans': '腓利门书', en: 'Philemon', 'zh-Hant': '腓利門書' }, shortNames: { 'zh-Hans': '门', en: 'Phm', 'zh-Hant': '門' }, aliases: ['门', '門', '腓利门', '腓利門', 'phm', 'philemon', 'flm'] },
  { id: 'hebrews', testament: 'new', chapters: 13, names: { 'zh-Hans': '希伯来书', en: 'Hebrews', 'zh-Hant': '希伯來書' }, shortNames: { 'zh-Hans': '来', en: 'Heb', 'zh-Hant': '來' }, aliases: ['来', '來', '希伯来', '希伯來', 'heb', 'hebrews', 'xbl'] },
  { id: 'james', testament: 'new', chapters: 5, names: { 'zh-Hans': '雅各书', en: 'James', 'zh-Hant': '雅各書' }, shortNames: { 'zh-Hans': '雅', en: 'Jas', 'zh-Hant': '雅' }, aliases: ['雅', '雅各', 'jas', 'james', 'ygs'] },
  { id: '1-peter', testament: 'new', chapters: 5, names: { 'zh-Hans': '彼得前书', en: '1 Peter', 'zh-Hant': '彼得前書' }, shortNames: { 'zh-Hans': '彼前', en: '1Pe', 'zh-Hant': '彼前' }, aliases: ['彼前', '彼得前', '1pe', '1 peter', '1peter', 'bdqs'] },
  { id: '2-peter', testament: 'new', chapters: 3, names: { 'zh-Hans': '彼得后书', en: '2 Peter', 'zh-Hant': '彼得後書' }, shortNames: { 'zh-Hans': '彼后', en: '2Pe', 'zh-Hant': '彼後' }, aliases: ['彼后', '彼後', '彼得后', '彼得後', '2pe', '2 peter', '2peter', 'bdhs'] },
  { id: '1-john', testament: 'new', chapters: 5, names: { 'zh-Hans': '约翰一书', en: '1 John', 'zh-Hant': '約翰一書' }, shortNames: { 'zh-Hans': '约一', en: '1Jn', 'zh-Hant': '約一' }, aliases: ['约一', '約一', '约翰一', '約翰一', '1jn', '1 john', '1john', 'yhys'] },
  { id: '2-john', testament: 'new', chapters: 1, names: { 'zh-Hans': '约翰二书', en: '2 John', 'zh-Hant': '約翰二書' }, shortNames: { 'zh-Hans': '约二', en: '2Jn', 'zh-Hant': '約二' }, aliases: ['约二', '約二', '约翰二', '約翰二', '2jn', '2 john', '2john', 'yhes'] },
  { id: '3-john', testament: 'new', chapters: 1, names: { 'zh-Hans': '约翰三书', en: '3 John', 'zh-Hant': '約翰三書' }, shortNames: { 'zh-Hans': '约三', en: '3Jn', 'zh-Hant': '約三' }, aliases: ['约三', '約三', '约翰三', '約翰三', '3jn', '3 john', '3john', 'yhss'] },
  { id: 'jude', testament: 'new', chapters: 1, names: { 'zh-Hans': '犹大书', en: 'Jude', 'zh-Hant': '猶大書' }, shortNames: { 'zh-Hans': '犹', en: 'Jude', 'zh-Hant': '猶' }, aliases: ['犹', '猶', '犹大', '猶大', 'jude', 'yds'] },
  { id: 'revelation', testament: 'new', chapters: 22, names: { 'zh-Hans': '启示录', en: 'Revelation', 'zh-Hant': '啟示錄' }, shortNames: { 'zh-Hans': '启', en: 'Rev', 'zh-Hant': '啟' }, aliases: ['启', '啟', '启示', '啟示', 'rev', 'revelation', 'qsl'] },
];

export const bibleBookMap = Object.fromEntries(bibleBooks.map((book) => [book.id, book]));

export function getBookLabel(bookId, uiLanguage, short = false) {
  const book = bibleBookMap[bookId];
  if (!book) return bookId;
  return short ? book.shortNames[uiLanguage] || book.shortNames['zh-Hans'] : book.names[uiLanguage] || book.names['zh-Hans'];
}

export function matchBibleBook(input) {
  const normalized = String(input || '').trim().toLowerCase();
  if (!normalized) return null;

  return bibleBooks.find((book) => {
    const fullNames = Object.values(book.names).map((value) => value.toLowerCase());
    const shortNames = Object.values(book.shortNames).map((value) => value.toLowerCase());
    const aliases = (book.aliases || []).map((value) => value.toLowerCase());
    const candidates = [...new Set([...fullNames, ...shortNames, ...aliases])];
    return candidates.some((candidate) => candidate.includes(normalized) || normalized.includes(candidate));
  }) || null;
}
