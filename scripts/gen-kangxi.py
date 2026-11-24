#!/usr/bin/env python3
"""產生 js/core/kangxi-data.js：Big5 繁體字的「康熙筆畫」與讀音（給姓名學用）。

為什麼不直接數筆畫：姓名學用康熙字典的筆畫，部首要還原成本字計算（氵算水 4 畫、艹算艸 6 畫、
阝在左算阜 8 畫、在右算邑 7 畫、王字旁算玉 5 畫），螢幕上的字數不出來。
Unicode Unihan 的 kRSKangXi 記的就是「康熙部首編號.部首外筆畫」，
康熙筆畫 = 部首本字筆畫 + 部首外筆畫（例：陳 170.8 → 阜 8 + 8 = 16；王 96.-1 → 玉 5 − 1 = 4）。

資料來源：npm 套件 cjk-unihan 0.0.3（MIT）內附的 Unihan SQLite 資料庫；Unihan 本身是
Unicode, Inc. 的資料，授權見 LICENSES/unicode-LICENSE.txt。曾與另一份康熙字典資料逐字比對：
12840 字一致、165 字不同（對方多把簡繁共用字算成繁體，如「姜」算成「薑」19 畫、「丑」算成「醜」），
所以以 Unihan 為準。

用法：python3 scripts/gen-kangxi.py [unihan.db 路徑]
      不給路徑時會用 npm pack 下載 cjk-unihan@0.0.3 到暫存資料夾，先核對 sha512 再解開。
"""

import base64
import hashlib
import os
import re
import sqlite3
import subprocess
import sys
import tarfile
import tempfile
import unicodedata

PACKAGE = 'cjk-unihan@0.0.3'
INTEGRITY = 'sha512-DZIlhKGqqjTFDgfIeurTrf2iAdSahm7RtWwXLyMI4nuzWyYE8llz3yXHEC0beISaqiR1IEyIE9Ycc1PppQ9O/Q=='
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'core', 'kangxi-data.js')

# 214 個康熙部首依筆畫排序，編號區間對應部首本字的筆畫數
RADICAL_RANGES = [(1, 6, 1), (7, 29, 2), (30, 60, 3), (61, 94, 4), (95, 117, 5), (118, 146, 6), (147, 166, 7),
                  (167, 175, 8), (176, 186, 9), (187, 194, 10), (195, 200, 11), (201, 204, 12), (205, 208, 13),
                  (209, 210, 14), (211, 211, 15), (212, 213, 16), (214, 214, 17)]


def radical_strokes(number):
    for lo, hi, strokes in RADICAL_RANGES:
        if lo <= number <= hi:
            return strokes
    raise ValueError(f'康熙部首編號超出範圍：{number}')


def kangxi_strokes(rs):
    """kRSKangXi「85.6」→ 10；有多個值時取第一個（Unihan 的主要歸部）"""
    first = rs.split()[0].replace("'", '')
    radical, residual = first.split('.')
    return radical_strokes(int(radical)) + int(residual)


TONE_MARKS = {'̄': 1, '́': 2, '̌': 3, '̀': 4}


def numbered_pinyin(reading):
    """「wáng」→「wang2」、「lǜ」→「lv4」；沒有聲調符號＝輕聲 5"""
    tone = 5
    letters = []
    for ch in unicodedata.normalize('NFD', reading):
        if ch in TONE_MARKS:
            tone = TONE_MARKS[ch]
        elif ch == '̈':  # ü 的兩點
            letters[-1] = 'v'
        elif 'a' <= ch <= 'z':
            letters.append(ch)
    return ''.join(letters) + str(tone) if letters else None


def fetch_db(tmp):
    out = subprocess.run(['npm', 'pack', PACKAGE, '--silent', '--pack-destination', tmp],
                         check=True, capture_output=True, text=True).stdout.strip().splitlines()[-1]
    path = os.path.join(tmp, out)
    algo, b64 = INTEGRITY.split('-', 1)
    digest = base64.b64encode(hashlib.new(algo, open(path, 'rb').read()).digest()).decode()
    if digest != b64:
        sys.exit(f'{PACKAGE} 的 {algo} 與預期不符，停止（可能被竄改或版本不同）')
    with tarfile.open(path) as tar:
        member = tar.getmember('package/data/unihan.db')
        tar.extract(member, tmp, filter='data')
    return os.path.join(tmp, 'package', 'data', 'unihan.db')


def build(db_path):
    con = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
    rows = con.execute("select character, kRSKangXi, kMandarin from unihan "
                       "where kBigFive is not null and kBigFive != '' order by kBigFive").fetchall()
    by_strokes = {}
    reads = []
    for ch, rs, mandarin in rows:
        if not rs:
            continue
        by_strokes.setdefault(kangxi_strokes(rs), []).append(ch)
        if mandarin:
            p = numbered_pinyin(mandarin.split()[0])
            if p and re.fullmatch(r'[a-z]+[1-5]', p):
                reads.append(ch + p)
    top = max(by_strokes)
    strokes = [''.join(by_strokes.get(n, [])) for n in range(top + 1)]
    return strokes, ''.join(reads), sum(len(s) for s in strokes)


def write(strokes, reads, count):
    lines = [
        '// 由 scripts/gen-kangxi.py 產生，請勿手改。',
        '// 已修改的資料：依 Unicode Unihan 資料庫的 kRSKangXi 換算成康熙筆畫，kMandarin 改寫成數字聲調拼音。',
        '// Unihan Copyright © Unicode, Inc.，依 Unicode 授權使用，全文見 LICENSES/unicode-LICENSE.txt。',
        f'// 共 {count} 字（Big5 範圍）。STROKES[n]＝康熙筆畫 n 的字；READ＝「字＋拼音＋聲調數字」連寫（ü 寫成 v）。',
        'export const STROKES = [',
    ]
    lines += [f"  '{s}'," for s in strokes]
    lines += ['];', f"export const READ = '{reads}';", '']
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))


def main():
    if len(sys.argv) > 1:
        strokes, reads, count = build(sys.argv[1])
    else:
        with tempfile.TemporaryDirectory() as tmp:
            strokes, reads, count = build(fetch_db(tmp))
    write(strokes, reads, count)
    print(f'寫入 {OUT}：{count} 字、最多 {len(strokes) - 1} 畫、讀音 {len(reads)} 字元')


if __name__ == '__main__':
    main()
