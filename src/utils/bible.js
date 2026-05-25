import { matchBibleBook } from '../data/bibleBooks';

const stripHtmlTags = (text) => {
  if (!text) return text;
  return text.replace(/<[^>]*>/g, '');
};

const parseVerseList = (text) => {
  if (!text) return [];
  const verses = [];

  text.split(',').forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const range = trimmed.split('-');
    if (range.length === 2) {
      const start = parseInt(range[0], 10);
      const end = parseInt(range[1], 10);
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let verse = start; verse <= end; verse += 1) {
          verses.push(verse);
        }
      }
      return;
    }

    const verse = parseInt(trimmed, 10);
    if (!Number.isNaN(verse)) {
      verses.push(verse);
    }
  });

  return verses;
};

const createBibleSlides = (book, chapter, verses, bibleVersion) => {
  if (!verses || verses.length === 0) return { slides: [], headers: [] };

  const isEnglish = bibleVersion === 'kjv' || bibleVersion === 'niv';
  const MAX_CHARS_PER_SLIDE = isEnglish ? 300 : 230;
  const MAX_VERSES_PER_SLIDE = isEnglish ? 5 : 4;

  const firstVerse = verses[0];
  const lastVerse = verses[verses.length - 1];
  let refHeader = '';
  if (verses.length === 1) {
    refHeader = firstVerse.ref;
  } else {
    refHeader = `${book}${chapter}:${firstVerse.verse}-${lastVerse.verse}`;
  }

  const slides = [];
  const headers = [];

  let currentSlideVerses = [];
  let currentLength = 0;

  verses.forEach((verse) => {
    const verseText = `${verse.verse}. ${stripHtmlTags(verse.content)}`;
    const verseLength = verseText.length;
    const additionalLength = currentSlideVerses.length > 0 ? 2 : 0;
    const wouldExceedLength = currentLength + verseLength + additionalLength > MAX_CHARS_PER_SLIDE;
    const wouldExceedVerses = currentSlideVerses.length >= MAX_VERSES_PER_SLIDE;

    if ((wouldExceedLength || wouldExceedVerses) && currentSlideVerses.length > 0) {
      slides.push(currentSlideVerses.join('\n'));
      headers.push(refHeader);
      currentSlideVerses = [verseText];
      currentLength = verseLength;
    } else {
      currentSlideVerses.push(verseText);
      currentLength += verseLength + additionalLength;
    }
  });

  if (currentSlideVerses.length > 0) {
    slides.push(currentSlideVerses.join('\n'));
    headers.push(refHeader);
  }

  return { slides, headers };
};

const parseQuickSearch = (text, selectedBookId) => {
  if (!text || text.trim().length < 1) return null;

  const trimmed = text.trim();
  const pattern1 = /^(.+?)\s+(\d+)(?:\s+([\d\-,]+))?$/;
  const match1 = trimmed.match(pattern1);

  if (match1) {
    const matchedBook = matchBibleBook(match1[1]);
    if (matchedBook) {
      return {
        type: 'quick',
        bookId: matchedBook.id,
        chapter: parseInt(match1[2], 10),
        verses: parseVerseList(match1[3]),
      };
    }
  }

  const pattern2 = /^([^\d]+?)(\d+)(?::([\d\-,]+))?$/;
  const match2 = trimmed.match(pattern2);

  if (match2) {
    const matchedBook = matchBibleBook(match2[1]);
    if (matchedBook) {
      return {
        type: 'quick',
        bookId: matchedBook.id,
        chapter: parseInt(match2[2], 10),
        verses: parseVerseList(match2[3]),
      };
    }
  }

  const pattern3 = /^(\d+)(?:\s+([\d\-,]+))?$/;
  const match3 = trimmed.match(pattern3);
  if (match3 && selectedBookId) {
    return {
      type: 'chapter-only',
      chapter: parseInt(match3[1], 10),
      verses: parseVerseList(match3[2]),
    };
  }

  return null;
};

export { stripHtmlTags, parseVerseList, parseQuickSearch, createBibleSlides };
