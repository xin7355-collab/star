// 13 月亮曆 KIN：查證過的日期、2 月 29 日、五大神諭的規則（每個 KIN 都檢查）。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kinOf, kinInfo, kinFrom, oracleOf, mayaKin, validDate, toneBarsDots, sealOf, toneOf, SEALS, TONES } from '../js/core/maya-kin.js';

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
