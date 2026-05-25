#!/usr/bin/env python3
"""
从 SQLite 数据库提取圣经和诗歌数据，输出为 ES module JS 文件。

用法:
  python3 scripts/extract-from-db.py bible CUVS   # 提取和合本简体
  python3 scripts/extract-from-db.py bible CUVT   # 提取和合本繁体
  python3 scripts/extract-from-db.py bible NIV    # 提取 NIV
  python3 scripts/extract-from-db.py songs        # 提取诗歌库
  python3 scripts/extract-from-db.py all          # 提取全部
"""

import sqlite3
import json
import os
import sys

DB_DIR = os.path.expanduser("~/Documents/db")
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "src", "data")

def extract_bible(db_name, export_name, out_filename):
    db_path = os.path.join(DB_DIR, f"{db_name}.db")
    if not os.path.exists(db_path):
        print(f"  ❌ 数据库不存在: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Get book name mapping
    cur.execute("SELECT bookId, bookName FROM bible_books ORDER BY bookId")
    book_names = {row[0]: row[1] for row in cur.fetchall()}

    # Get all verses
    cur.execute("SELECT Book, Chapter, Verse, Scripture FROM bible_verses ORDER BY Book, Chapter, Verse")
    rows = cur.fetchall()

    verses = []
    for row in rows:
        book_id, chapter, verse, scripture = row
        book_name = book_names.get(book_id, f"Book{book_id}")
        if scripture:
            verses.append({
                "book": book_name,
                "chapter": chapter,
                "verse": verse,
                "content": scripture,
                "ref": f"{book_name} {chapter}:{verse}"
            })

    conn.close()

    # Write ES module
    out_path = os.path.join(OUT_DIR, out_filename)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(f"// {export_name} - 从 {db_name}.db 提取\n")
        f.write(f"// 共 {len(verses)} 节经文\n")
        f.write(f"export const {export_name} = ")
        json.dump(verses, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"  ✅ {out_filename} ({len(verses)} verses)")

def extract_songs():
    db_path = os.path.join(DB_DIR, "Songs.db")
    if not os.path.exists(db_path):
        print(f"  ❌ 数据库不存在: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Get author mapping
    cur.execute("SELECT id, name FROM song_author_info")
    authors = {row[0]: row[1] for row in cur.fetchall()}

    # Get all songs with content
    cur.execute("""
        SELECT si.id, si.name, si.authorId, sc.content
        FROM song_info si
        JOIN song_content sc ON si.id = sc.songId
        ORDER BY si.id
    """)
    rows = cur.fetchall()

    songs = []
    for row in rows:
        song_id, title, author_id, content = row
        author = authors.get(author_id, "")
        if not content:
            continue

        # Split content into slides by blank lines
        # Each slide is a paragraph/verse block
        paragraphs = content.strip().split('\n\n')
        slides = []
        for para in paragraphs:
            para = para.strip()
            if para:
                slides.append(para)

        if slides:
            songs.append({
                "id": str(song_id),
                "title": title.strip() if title else f"Song {song_id}",
                "author": author.strip() if author else "",
                "slides": slides
            })

    conn.close()

    # Write ES module
    out_path = os.path.join(OUT_DIR, "all_songs.js")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(f"// 完整诗歌库 - 从 Songs.db 提取\n")
        f.write(f"// 共 {len(songs)} 首诗歌\n")
        f.write(f"export const allSongs = ")
        json.dump(songs, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"  ✅ all_songs.js ({len(songs)} songs)")

if __name__ == "__main__":
    os.makedirs(OUT_DIR, exist_ok=True)

    if len(sys.argv) < 2:
        print("用法: python3 extract-from-db.py <bible|songs|all> [DB_NAME]")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "bible":
        db = sys.argv[2] if len(sys.argv) > 2 else "CUVS"
        mapping = {
            "CUVS": ("cuvS", "full_bible.js", "和合本 (简体)"),
            "CUVT": ("cuvTraditional", "full_bible_cuv_traditional.js", "和合本 (繁体)"),
            "NIV": ("niv", "full_bible_niv.js", "NIV"),
        }
        if db not in mapping:
            print(f"未知数据库: {db}. 可用: {list(mapping.keys())}")
            sys.exit(1)
        export_name, filename, desc = mapping[db]
        print(f"📖 提取 {desc}...")
        extract_bible(db, export_name, filename)

    elif cmd == "songs":
        print("🎵 提取诗歌库...")
        extract_songs()

    elif cmd == "all":
        print("🔨 提取全部...\n")
        for db, (export_name, filename, desc) in {
            "CUVS": ("cuvS", "full_bible.js", "和合本 (简体)"),
            "CUVT": ("cuvTraditional", "full_bible_cuv_traditional.js", "和合本 (繁体)"),
            "NIV": ("niv", "full_bible_niv.js", "NIV"),
        }.items():
            print(f"📖 {desc}...")
            extract_bible(db, export_name, filename)
        print("\n🎵 诗歌库...")
        extract_songs()
        print("\n✨ 全部提取完成！")

    else:
        print(f"未知命令: {cmd}")
        sys.exit(1)
