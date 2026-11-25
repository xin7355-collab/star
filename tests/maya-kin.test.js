// 13 月亮曆 KIN：查證過的日期、2 月 29 日、五大神諭的規則（每個 KIN 都檢查）。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kinOf, kinInfo, kinFrom, oracleOf, mayaKin, validDate, toneBarsDots, sealOf, toneOf, yearKin, dayRelation, nextKinDate, pairRelation, SEALS, TONES } from '../js/core/maya-kin.js';
import { DAY_RELATION_TEXT, PAIR_RELATION_TEXT } from '../js/core/maya-texts.js';

test('查證過的日期：年名、yokai.jp 的 KIN 34、2012 冬至', () => {
  const name = (date) => kinInfo(kinOf(date)).title;
  assert.equal(kinOf({ y: 2013, m: 7, d: 26 }), 164);
  assert.equal(name({ y: 2013, m: 7, d: 26 }), '銀河黃種子');
  assert.equal(name({ y: 2014, m: 7, d: 26 }), '太陽紅月'); // 紅色太陽月亮年 2014-2015
  assert.equal(kinOf({ y: 2017, m: 6, d: 26 }), 34); // 白巫師、銀河調性、藍手波符
  assert.equal(kinInfo(34).wavespell.seal.name, '藍手');
  assert.equal(name({ y: 2024, m: 7, d: 26 }), '韻律藍風暴');
  assert.equal(name({ y: 2025, m: 7, d: 26 }), '共振黃種子');
  assert.equal(kinOf({ y: 2012, m: 12, d: 21 }), 207);
  assert.equal(name({ y: 2012, m: 12, d: 21 }), '水晶藍手');
  // 每年 7/26 往前進 105 個 KIN（365 除以 260 的餘數），往回推也一樣
  assert.equal(kinOf({ y: 1987, m: 7, d: 26 }), 34);
  for (let y = 1950; y < 2060; y += 1) assert.equal((kinOf({ y: y + 1, m: 7, d: 26 }) - kinOf({ y, m: 7, d: 26 }) + 260) % 260, 105);
});

test('2 月 29 日不算日子：和 2/28 同一個 KIN，3/1 接著下一個；畫面另外列出 3/1 的說法', () => {
  const feb28 = kinOf({ y: 2024, m: 2, d: 28 });
  assert.equal(kinOf({ y: 2024, m: 2, d: 29 }), feb28);
  assert.equal(kinOf({ y: 2024, m: 3, d: 1 }), (feb28 % 260) + 1);
  const r = mayaKin({ y: 2024, m: 2, d: 29 });
  assert.ok(r.leapDay);
  assert.equal(r.altKin, (feb28 % 260) + 1);
  assert.equal(mayaKin({ y: 2024, m: 3, d: 1 }).leapDay, false);
  assert.equal(kinOf({ y: 2023, m: 2, d: 29 }), null); // 不是閏年
  assert.equal(mayaKin({ y: 2023, m: 13, d: 1 }), null);
  assert.ok(validDate({ y: 2000, m: 2, d: 29 }));
  assert.ok(!validDate({ y: 1900, m: 2, d: 29 }));
});

test('五大神諭：每個 KIN 都符合規則（引導同色同調性、支持相加 19、挑戰差 10、隱藏相加 261）', () => {
  const color = (s) => SEALS[s - 1].color;
  for (let k = 1; k <= 260; k += 1) {
    const o = oracleOf(k);
    const s = sealOf(k);
    const t = toneOf(k);
    assert.equal(kinFrom(s, t), k);
    for (const pos of ['guide', 'analog', 'antipode']) {
      assert.equal(o[pos].tone, t, `${k} ${pos} 同調性`);
      assert.equal(sealOf(o[pos].kin), o[pos].seal);
    }
    assert.equal(color(o.guide.seal), color(s), `${k} 引導同顏色`);
    assert.equal((o.analog.seal + s) % 20, 19, `${k} 支持`);
    assert.equal(Math.abs(o.antipode.seal - s), 10, `${k} 挑戰`);
    assert.equal(o.occult.kin + k, 261, `${k} 隱藏`);
    assert.equal(o.occult.tone, 14 - t);
  }
  // 調性 1、6、11 的引導是自己；2、7、12 加 12（兩點家族）
  assert.equal(oracleOf(1).guide.kin, 1);
  assert.equal(oracleOf(kinFrom(2, 2)).guide.seal, 14); // 月亮白風 → 白巫師
  assert.deepEqual([oracleOf(1).analog.kin, oracleOf(1).antipode.kin, oracleOf(1).occult.kin], [118, 131, 260]);
});

test('波符、名稱、瑪雅數字：KIN 1 是磁性紅龍、KIN 260 是宇宙黃太陽', () => {
  assert.equal(kinInfo(1).title, '磁性紅龍');
  assert.equal(kinInfo(260).title, '宇宙黃太陽');
  assert.deepEqual([kinInfo(13).wavespell.kin, kinInfo(13).wavespell.day, kinInfo(14).wavespell.kin], [1, 13, 14]);
  assert.equal(kinInfo(14).wavespell.seal.name, '白巫師');
  assert.equal(kinInfo(260).wavespell.index, 20);
  assert.deepEqual(toneBarsDots(8), { bars: 1, dots: 3 });
  assert.deepEqual(toneBarsDots(13), { bars: 2, dots: 3 });
  assert.deepEqual(toneBarsDots(5), { bars: 1, dots: 0 });
  assert.equal(SEALS.length, 20);
  assert.equal(TONES.length, 13);
});

test('流年印記：從今年生日那天起算（還沒過生日看去年）；2/29 生的人平年用 2/28', () => {
  const b = { y: 1990, m: 8, d: 15 };
  // 1990/8/15＝KIN 109，每年 +105：2026/8/15＝109＋36×105≡249（月亮紅月）
  const now = yearKin(b, { y: 2026, m: 11, d: 25 });
  assert.deepEqual(now.from, { y: 2026, m: 8, d: 15 });
  assert.equal(now.kin, 249);
  assert.equal(now.title, '月亮紅月');
  assert.deepEqual(yearKin(b, { y: 2026, m: 8, d: 15 }).from, { y: 2026, m: 8, d: 15 }); // 生日當天就換
  assert.deepEqual(yearKin(b, { y: 2026, m: 8, d: 14 }).from, { y: 2025, m: 8, d: 15 });
  const leap = { y: 2000, m: 2, d: 29 };
  assert.deepEqual(yearKin(leap, { y: 2027, m: 2, d: 28 }).from, { y: 2027, m: 2, d: 28 });
  assert.deepEqual(yearKin(leap, { y: 2027, m: 2, d: 27 }).from, { y: 2026, m: 2, d: 28 });
  assert.deepEqual(yearKin(leap, { y: 2028, m: 2, d: 29 }).from, { y: 2028, m: 2, d: 29 });
  assert.equal(yearKin({ y: 1990, m: 2, d: 30 }, { y: 2026, m: 1, d: 1 }), null);
});

test('今天和你的關係：銀河生日、同圖騰、支持、挑戰、隱藏推動、引導、同色、沒有連結，每個 KIN 都分得出來', () => {
  // KIN 109 超頻紅月：支持白狗（10）、挑戰藍風暴（19）、隱藏推動黃人（12）、引導紅地球（17）
  const at = (seal, tone = 1) => kinFrom(seal, tone);
  assert.equal(dayRelation(109, 109), 'return');
  assert.equal(dayRelation(at(9, 2), 109), 'seal');
  assert.equal(dayRelation(at(10), 109), 'analog');
  assert.equal(dayRelation(at(19), 109), 'antipode');
  assert.equal(dayRelation(at(12), 109), 'occult');
  assert.equal(dayRelation(at(17), 109), 'guide');
  assert.equal(dayRelation(at(1), 109), 'color'); // 紅龍：同是紅色家族
  assert.equal(dayRelation(91, 109), 'none'); // 2026/11/25 宇宙藍猴
  // 全部 260×260 組合都有結果，而且都有說明文字
  for (let me = 1; me <= 260; me += 1) {
    for (let day = 1; day <= 260; day += 1) assert.ok(DAY_RELATION_TEXT[dayRelation(day, me)], `${day}/${me}`);
  }
});

test('下次銀河生日：今天就是回傳 0 天；260 天一輪，中間遇到 2/29 晚一天', () => {
  assert.deepEqual(nextKinDate({ y: 2026, m: 11, d: 25 }, 91), { date: { y: 2026, m: 11, d: 25 }, days: 0 });
  assert.deepEqual(nextKinDate({ y: 2026, m: 11, d: 25 }, 109), { date: { y: 2026, m: 12, d: 13 }, days: 18 });
  // 隔天起算：下一次是 260 天後（扣掉已經過的 1 天＝259）
  assert.equal(nextKinDate({ y: 2026, m: 11, d: 26 }, 91).days, 259);
  // 2027/9/1 的下一輪會跨過 2028/2/29（2/29 和 2/28 同一個 KIN），整輪變 261 天：隔天起算是 260
  const k = kinOf({ y: 2027, m: 9, d: 1 });
  assert.deepEqual(nextKinDate({ y: 2027, m: 9, d: 2 }, k), { date: { y: 2028, m: 5, d: 19 }, days: 260 });
  for (let i = 0; i < 400; i += 7) {
    const t = new Date(Date.UTC(2026, 0, 1 + i));
    const from = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
    for (const kin of [1, 109, 260]) {
      const r = nextKinDate(from, kin);
      assert.ok(r && r.days >= 0 && r.days <= 261 && kinOf(r.date) === kin, `${JSON.stringify(from)} → ${kin}`);
    }
  }
});

test('合盤：支持、挑戰、隱藏推動、同圖騰、沒有連結都是雙向一樣；引導只算單向；同調性、同波符', () => {
  // KIN 70 白狗（調性 5）和 KIN 109 超頻紅月互為支持；KIN 57 紅地球是紅月的引導，反過來只是同色
  assert.deepEqual(pairRelation(70, 109), { otherInMine: 'analog', mineInOther: 'analog', sameTone: true, sameWavespell: false });
  assert.deepEqual(pairRelation(57, 109), { otherInMine: 'guide', mineInOther: 'color', sameTone: true, sameWavespell: false });
  assert.deepEqual(pairRelation(126, 109), { otherInMine: 'none', mineInOther: 'none', sameTone: false, sameWavespell: false });
  assert.equal(pairRelation(105, 109).sameWavespell, true); // 紅蛇波符：KIN 105～117
  for (let a = 1; a <= 260; a += 1) {
    for (let b = 1; b <= 260; b += 1) {
      const r = pairRelation(a, b);
      if (['return', 'seal', 'analog', 'antipode', 'occult', 'none'].includes(r.otherInMine)) assert.equal(r.mineInOther, r.otherInMine, `${a}/${b}`);
      assert.ok(PAIR_RELATION_TEXT[r.otherInMine] && PAIR_RELATION_TEXT[r.mineInOther], `${a}/${b}`);
    }
  }
});
