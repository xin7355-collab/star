// 瑪雅密碼 A～E：依使用者提供的 V1（rita860503-sketch/-V1）計算器的程式行為重寫。
// V1 沒有授權檔，所以這裡沒有複製它的程式或文字，只實作同一套計算規則；規則的原始出處沒驗到。
// 與 V1 的差異：生日以字串拆解（V1 用 new Date 解析，海外時區會少一天）。
//
// 規則（與 V1 相同）：
//   A＝西元年十位數、B＝個位數、C＝A＋B；1910–1921 與 2010–2021 年為例外：A、B 不適用，C＝10。
//   N＝年＋月＋日（雙胞胎可加上出生的「時＋分」區分），S＝N 各位數字相加；
//   S < 22：D＝E＝S；否則 D＝S−22、E＝S 各位數字相加。
//   每個數字的關鍵字依「個位數」對照（V1 的作法：例如 18 看 8）。

export const POSITIONS = [
  { key: 'A', label: '前世 A' },
  { key: 'B', label: '今生 B' },
  { key: 'C', label: '潛意識 C' },
  { key: 'D', label: '表象系統 D' },
  { key: 'E', label: '小宇宙 E' },
];

// 關鍵字為本 App 撰寫，與其他老師的版本可能不同
export const KEYWORDS = ['本源', '開創', '協調', '表達', '穩固', '變化', '承擔', '洞察', '力量', '圓滿'];

export function digitSum(n) {
  return String(Math.abs(n)).split('').reduce((acc, c) => acc + (parseInt(c, 10) || 0), 0);
}

export function isExceptionYear(y) {
  return (y >= 1910 && y <= 1921) || (y >= 2010 && y <= 2021);
}

/**
 * @param {{y:number,m:number,d:number}} date
 * @param {{h:number, mi:number}|null} twinTime 雙胞胎分流用的出生時間（沒有就不加）
 */
export function computeMaya({ y, m, d }, twinTime = null) {
  const exception = isExceptionYear(y);
  const tens = Math.floor((y % 100) / 10);
  const ones = y % 10;
  const A = exception ? null : tens;
  const B = exception ? null : ones;
  const C = exception ? 10 : tens + ones;
  const extra = twinTime ? twinTime.h + twinTime.mi : 0;
  const N = y + m + d + extra;
  const S = digitSum(N);
  const D = S < 22 ? S : S - 22;
  const E = S < 22 ? S : digitSum(S);
  const values = { A, B, C, D, E };
  return {
    exception,
    twin: !!twinTime,
    sum: N,
    digitTotal: S,
    items: POSITIONS.map((p) => {
      const v = values[p.key];
      return { ...p, value: v, keyword: v === null ? null : KEYWORDS[v % 10] };
    }),
  };
}

/** 兩人合盤：並列，並找出相同的數字位置 */
export function compareMaya(a, b) {
  return POSITIONS.map((p, i) => {
    const va = a.items[i].value;
    const vb = b.items[i].value;
    return { label: p.label, a: va, b: vb, same: va !== null && va === vb };
  });
}
