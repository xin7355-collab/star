#!/usr/bin/env python3
"""產生 js/core/zh-data.js：lunar-typescript 輸出的簡體字 → 台灣繁體。

為什麼：lunar-typescript 只有簡體與英文輸出（例如「纳财 开市」「白蜡金」），App 要顯示台灣繁中。
手機上載入完整 OpenCC 字典太大（數 MB），所以在開發時用 OpenCC 把函式庫裡「實際會輸出的字串」轉好，
只把結果寫成小的對照表。

做法：
1. 從 node_modules/lunar-typescript/dist/index.cjs 抽出所有含中文的字串常數，並依分隔符號切成詞。
2. 每個詞用 OpenCC s2tw（含詞組判斷，例如「干支」不會變「幹支」、「谷雨」→「穀雨」）轉換。
3. CHAR：逐字對照（預設轉法）；PHRASE：只收「逐字轉換」與「詞組轉換」結果不同的詞。
4. 台灣農民曆慣用「沖」（沖煞、沖鼠），覆寫 OpenCC 的「衝」。

用法：pip install -r requirements-dev.txt && python3 scripts/gen-zh-map.py
"""
import json
import os
import re
import sys

from opencc import OpenCC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "node_modules", "lunar-typescript", "dist", "index.cjs")
OUT = os.path.join(ROOT, "js", "core", "zh-data.js")

CJK = re.compile(r"[㐀-鿿]")
LITERAL = re.compile(r'"((?:[^"\\\n]|\\.)*)"|\'((?:[^\'\\\n]|\\.)*)\'|`((?:[^`\\]|\\.)*)`')
SPLIT = re.compile(r"[\s,，;；|:：/、()（）\[\]{}#$%^&*+=<>!?.\-_0-9A-Za-z]+")
# 台灣慣用字覆寫：source 字元 → 轉換後要用的字（只在 OpenCC 轉成左邊第二個字時套用）
OVERRIDES = {"冲": ("衝", "沖")}
# 在命理／農民曆語境本來就是正確繁體、不該被 OpenCC 依其他語境改掉的字：
# 干（干支）、斗（北斗、斗宿）、凶（吉凶）、咸（咸池、蟄蟲咸俯）、回（回歸）、合（合家、六合）
KEEP = set("干斗凶咸回合")

cc = OpenCC("s2tw")


UNI = re.compile(r"\\u\{([0-9a-fA-F]+)\}|\\u([0-9a-fA-F]{4})")


def unescape(lit):
    """打包後的中文是 \\uXXXX 跳脫，先還原成字。"""
    return UNI.sub(lambda m: chr(int(m.group(1) or m.group(2), 16)), lit)


def convert(text):
    out = cc.convert(text)
    if len(out) == len(text):
        chars = list(out)
        for i, ch in enumerate(text):
            if ch in OVERRIDES and chars[i] == OVERRIDES[ch][0]:
                chars[i] = OVERRIDES[ch][1]
            elif ch in KEEP:
                chars[i] = ch
        out = "".join(chars)
    return out


def main():
    if not os.path.exists(SRC):
        sys.exit("找不到 lunar-typescript，請先 npm ci")
    src = open(SRC, encoding="utf-8").read()
    tokens = set()
    for m in LITERAL.finditer(src):
        lit = unescape(next(g for g in m.groups() if g is not None))
        if not CJK.search(lit):
            continue
        for tok in SPLIT.split(lit):
            if CJK.search(tok):
                tokens.add(tok)
    # 逐字預設轉法用「多數決」：看每個字在函式庫所有詞裡被 OpenCC 轉成什麼，取最常見的。
    # 例如「丑」單獨轉會變「醜」，但函式庫裡幾乎都是地支（乙丑、丑時），執行時又常逐字組出干支，
    # 所以預設要保留「丑」；少數例外（若有）交給 PHRASE。
    votes = {}
    for tok in tokens:
        full = convert(tok)
        if len(full) != len(tok):
            continue
        for a, b in zip(tok, full):
            if CJK.match(a):
                votes.setdefault(a, {}).setdefault(b, 0)
                votes[a][b] += 1
    char_map = {}
    for ch, counts in votes.items():
        best = max(sorted(counts), key=lambda k: counts[k])
        if best != ch:
            char_map[ch] = best
    phrase_map = {}
    ambiguous = set()
    for tok in sorted(tokens):
        if len(tok) < 2:
            continue  # 單字沒有上下文（例如地支「丑」），一律用逐字預設轉法
        full = convert(tok)
        charwise = "".join(char_map.get(c, c) for c in tok)
        if full != charwise:
            phrase_map[tok] = full
            for a, b in zip(tok, full):
                if a in char_map and b != char_map[a]:
                    ambiguous.add(a)
    header = (
        "// 由 scripts/gen-zh-map.py 自動產生（OpenCC s2tw，台灣慣用「沖」），請勿手改。\n"
        f"// 來源：lunar-typescript 的字串常數 {len(tokens)} 個詞；逐字 {len(char_map)} 個、詞組 {len(phrase_map)} 個。\n"
    )
    body = (
        "export const CHAR = " + json.dumps(dict(sorted(char_map.items())), ensure_ascii=False, separators=(",", ":")) + ";\n"
        "export const PHRASE = " + json.dumps(dict(sorted(phrase_map.items())), ensure_ascii=False, separators=(",", ":")) + ";\n"
        "// 在不同詞裡轉法不同的字（例如「干」在「干支」不轉）：檢查「畫面不可殘留簡體」時要排除\n"
        "export const AMBIGUOUS = " + json.dumps("".join(sorted(ambiguous)), ensure_ascii=False) + ";\n"
    )
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write(header + body)
    print(f"已寫入 {os.path.relpath(OUT, ROOT)}：詞 {len(tokens)}、逐字 {len(char_map)}、詞組 {len(phrase_map)}、多義字 {len(ambiguous)}")


if __name__ == "__main__":
    main()
