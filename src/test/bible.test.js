import { describe, it, expect } from 'vitest';
import { stripHtmlTags, parseVerseList, parseQuickSearch, createBibleSlides } from '../utils/bible';
import { matchBibleBook } from '../data/bibleBooks';

// --- stripHtmlTags ---

describe('stripHtmlTags', () => {
  it('removes simple HTML tags', () => {
    expect(stripHtmlTags('<p>Hello</p>')).toBe('Hello');
  });

  it('removes nested tags', () => {
    expect(stripHtmlTags('<div><span>text</span></div>')).toBe('text');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtmlTags('')).toBe('');
  });

  it('returns null/undefined unchanged', () => {
    expect(stripHtmlTags(null)).toBe(null);
    expect(stripHtmlTags(undefined)).toBe(undefined);
  });

  it('returns plain text unchanged', () => {
    expect(stripHtmlTags('plain text')).toBe('plain text');
  });

  it('removes self-closing tags', () => {
    expect(stripHtmlTags('before<br/>after')).toBe('beforeafter');
  });
});

// --- parseVerseList ---

describe('parseVerseList', () => {
  it('parses a single verse', () => {
    expect(parseVerseList('3')).toEqual([3]);
  });

  it('parses a verse range', () => {
    expect(parseVerseList('1-5')).toEqual([1, 2, 3, 4, 5]);
  });

  it('parses comma-separated verses', () => {
    expect(parseVerseList('1,3,5')).toEqual([1, 3, 5]);
  });

  it('parses mixed ranges and singles', () => {
    expect(parseVerseList('1-3,5,7-9')).toEqual([1, 2, 3, 5, 7, 8, 9]);
  });

  it('handles whitespace', () => {
    expect(parseVerseList(' 1 , 3-5 , 7 ')).toEqual([1, 3, 4, 5, 7]);
  });

  it('returns empty array for empty string', () => {
    expect(parseVerseList('')).toEqual([]);
  });

  it('returns empty array for null/undefined', () => {
    expect(parseVerseList(null)).toEqual([]);
    expect(parseVerseList(undefined)).toEqual([]);
  });

  it('handles single range with spaces', () => {
    expect(parseVerseList('10-12')).toEqual([10, 11, 12]);
  });
});

// --- parseQuickSearch ---

describe('parseQuickSearch', () => {
  it('parses "Book Chapter:Verses" format (pattern2, colon)', () => {
    const result = parseQuickSearch('John 3:16', null);
    expect(result).toEqual({
      type: 'quick',
      bookId: 'john',
      chapter: 3,
      verses: [16],
    });
  });

  it('parses "Book Chapter Verses" format (pattern1, space)', () => {
    const result = parseQuickSearch('John 3 1-5', null);
    expect(result).toEqual({
      type: 'quick',
      bookId: 'john',
      chapter: 3,
      verses: [1, 2, 3, 4, 5],
    });
  });

  it('parses chapter-only with selectedBookId', () => {
    const result = parseQuickSearch('3 1-5', 'john');
    expect(result).toEqual({
      type: 'chapter-only',
      chapter: 3,
      verses: [1, 2, 3, 4, 5],
    });
  });

  it('parses chapter-only without verses', () => {
    const result = parseQuickSearch('3', 'john');
    expect(result).toEqual({
      type: 'chapter-only',
      chapter: 3,
      verses: [],
    });
  });

  it('returns null for chapter-only without selectedBookId', () => {
    const result = parseQuickSearch('3', null);
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseQuickSearch('', null)).toBeNull();
  });

  it('returns null for whitespace only', () => {
    expect(parseQuickSearch('   ', null)).toBeNull();
  });

  it('parses Chinese book name', () => {
    const result = parseQuickSearch('約翰福音 3:16', null);
    expect(result).toBeTruthy();
    expect(result.type).toBe('quick');
    expect(result.chapter).toBe(3);
    expect(result.verses).toEqual([16]);
  });
});

// --- createBibleSlides ---

describe('createBibleSlides', () => {
  const makeVerse = (verse, content) => ({
    book: 'John',
    chapter: 3,
    verse,
    content,
    ref: `John 3:${verse}`,
  });

  it('returns empty for empty verses', () => {
    const result = createBibleSlides('John', 3, [], 'kjv');
    expect(result).toEqual({ slides: [], headers: [] });
  });

  it('returns empty for null verses', () => {
    const result = createBibleSlides('John', 3, null, 'kjv');
    expect(result).toEqual({ slides: [], headers: [] });
  });

  it('creates a single slide for one short verse', () => {
    const verses = [makeVerse(16, 'For God so loved the world')];
    const result = createBibleSlides('John', 3, verses, 'kjv');
    expect(result.slides).toHaveLength(1);
    expect(result.headers).toHaveLength(1);
    expect(result.headers[0]).toBe('John 3:16');
    expect(result.slides[0]).toContain('16. For God so loved the world');
  });

  it('uses ref for single verse header', () => {
    const verses = [makeVerse(16, 'For God so loved the world')];
    const result = createBibleSlides('John', 3, verses, 'kjv');
    expect(result.headers[0]).toBe('John 3:16');
  });

  it('uses range ref for multiple verses', () => {
    const verses = [
      makeVerse(1, 'Short text'),
      makeVerse(2, 'Another short'),
    ];
    const result = createBibleSlides('John', 3, verses, 'kjv');
    expect(result.headers[0]).toBe('John3:1-2');
  });

  it('groups short verses on one slide', () => {
    const verses = [
      makeVerse(1, 'A'),
      makeVerse(2, 'B'),
      makeVerse(3, 'C'),
    ];
    const result = createBibleSlides('John', 3, verses, 'kjv');
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0]).toContain('1. A');
    expect(result.slides[0]).toContain('2. B');
    expect(result.slides[0]).toContain('3. C');
  });

  it('splits when exceeding char limit for English (300)', () => {
    const longText = 'A'.repeat(290);
    const verses = [
      makeVerse(1, longText),
      makeVerse(2, longText),
    ];
    const result = createBibleSlides('John', 3, verses, 'kjv');
    expect(result.slides.length).toBeGreaterThanOrEqual(1);
    expect(result.headers).toHaveLength(result.slides.length);
  });

  it('splits when exceeding max verses per slide for English (5)', () => {
    const verses = Array.from({ length: 10 }, (_, i) => makeVerse(i + 1, 'X'));
    const result = createBibleSlides('John', 3, verses, 'kjv');
    expect(result.slides.length).toBeGreaterThanOrEqual(2);
    expect(result.headers).toHaveLength(result.slides.length);
  });

  it('uses CJK limits for non-English versions', () => {
    const longCJK = '經'.repeat(220);
    const verses = [
      makeVerse(1, longCJK),
      makeVerse(2, longCJK),
    ];
    const result = createBibleSlides('約翰福音', 3, verses, 'cuv');
    expect(result.slides.length).toBeGreaterThanOrEqual(1);
    expect(result.headers).toHaveLength(result.slides.length);
  });

  it('strips HTML from verse content', () => {
    const verses = [makeVerse(16, 'For God <i>so</i> loved the world')];
    const result = createBibleSlides('John', 3, verses, 'kjv');
    expect(result.slides[0]).not.toContain('<i>');
    expect(result.slides[0]).toContain('For God so loved the world');
  });
});

// --- matchBibleBook ---

describe('matchBibleBook', () => {
  it('matches English book name', () => {
    const result = matchBibleBook('John');
    expect(result).toBeTruthy();
    expect(result.names.en).toBe('John');
  });

  it('matches Chinese book name', () => {
    const result = matchBibleBook('約翰福音');
    expect(result).toBeTruthy();
    expect(result.names['zh-Hant']).toBe('約翰福音');
  });

  it('matches short Chinese book name', () => {
    const result = matchBibleBook('創');
    expect(result).toBeTruthy();
    expect(result.names['zh-Hant']).toBe('創世記');
  });

  it('returns null for unknown book', () => {
    const result = matchBibleBook('NotABook');
    expect(result).toBeNull();
  });
});
