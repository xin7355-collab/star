// 紫微：雙主星組合、三方四正、命宮格局。真實命盤驗證接得上 buildZiwei，手排的盤逐條檢查格局條件。離線可跑。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildZiwei } from '../js/core/ziwei.js';
import { PAIR_TEXT, pairText, sanFang, mingPatterns } from '../js/core/ziwei-pattern.js';

const ZW = buildZiwei({ date: { y: 1990, m: 8, d: 15 }, time: { h: 6, mi: 20 }, tz: 'Asia/Taipei', place: { lat: 25.04, lon: 121.5 } }, { gender: '男', at: { y: 2026, m: 11, d: 24 } });
const palace = (z, name) => z.palaces.find((p) => p.name === name);

// 手排命盤：命宮放在某個地支，其他宮名依逆時針排；spec 是 地支 → { major, minor, mut }
const ZHI = '寅卯辰巳午未申酉戌亥子丑'; // iztro 的宮位序號從寅開始
const NAMES = ['命宮', '兄弟', '夫妻', '子女', '財帛', '疾厄', '遷移', '僕役', '官祿', '田宅', '福德', '父母'];
function fakeZ(mingBranch, spec) {
  const mi = ZHI.indexOf(mingBranch);
  const palaces = [...ZHI].map((branch, index) => {
    const sp = spec[branch] || {};
    const star = (name) => ({ name, brightness: '', mutagen: (sp.mut || {})[name] || '' });
    return { index, branch, name: NAMES[(mi - index + 12) % 12], major: (sp.major || []).map(star), minor: (sp.minor || []).map(star) };
  });
  return { ok: true, palaces };
}
const names = (z) => mingPatterns(z).map((p) => p.name);

test('雙主星：24 種同宮組合都有文案，真實命盤裡每個雙星宮都查得到', () => {
  assert.equal(Object.keys(PAIR_TEXT).length, 24);
  assert.match(pairText([{ name: '天梁' }, { name: '天機' }]), /^「機梁同宮」/); // 順序顛倒也查得到
  assert.equal(pairText([{ name: '紫微' }]), null);
  for (let y = 1970; y <= 2000; y += 6) {
    for (let m = 1; m <= 12; m += 1) {
      for (const h of [1, 7, 13, 19]) {
        const z = buildZiwei({ date: { y, m, d: 10 }, time: { h, mi: 0 }, tz: 'Asia/Taipei', place: null }, { gender: m % 2 ? '男' : '女' });
        for (const p of z.palaces.filter((q) => q.major.length === 2)) assert.ok(pairText(p.major), p.major.map((s) => s.name).join(''));
      }
    }
  }
});

test('三方四正：本宮、對宮、兩個三合宮；空宮借對宮主星，四化與吉煞只算真正所在的宮', () => {
  // 1990-08-15 06:20 男：命宮在辰（天機天梁），對宮戌遷移空宮、三合申官祿空宮、子財帛（天同化忌、太陰化科）
  const sf = sanFang(ZW, palace(ZW, '命宮'));
  assert.deepEqual(sf.list.map((x) => [x.role, x.palace.name]), [['本宮', '命宮'], ['對宮', '遷移'], ['三合', '官祿'], ['三合', '財帛']]);
  assert.deepEqual(sf.list[1].stars.map((s) => s.name), ['天機', '天梁']); // 遷移空宮借命宮
  assert.equal(sf.list[1].borrowed, true);
  assert.deepEqual(sf.mutagens.map((m) => `${m.star}${m.mutagen}${m.palace}`), ['天同化忌財帛', '太陰化科財帛']);
  assert.deepEqual(sf.lucky.map((x) => x.star), ['祿存']);
  assert.deepEqual(sf.sha.map((x) => x.star).sort(), ['地空', '火星'].sort());
  // 吉 1 − 煞 2 + 化科 1 − 化忌 2 = −2 → 凶多於吉
  assert.deepEqual([sf.score, sf.tone], [-2, 'bad']);
  assert.match(sf.text, /凶多於吉/);
});

test('命宮格局：真實命盤是機月同梁、祿馬交馳、祿逢空劫', () => {
  assert.deepEqual(names(ZW), ['機月同梁', '祿馬交馳', '祿逢空劫']);
  for (const p of mingPatterns(ZW)) assert.ok(p.text.length > 15 && ['good', 'bad', 'mixed'].includes(p.tone));
});

test('命宮格局：手排的盤逐條檢查條件', () => {
  // 明珠出海：命宮在未無主星，太陽在卯、太陰在亥從三合照入
  const mz = fakeZ('未', { 卯: { major: ['太陽', '天梁'] }, 亥: { major: ['太陰'] }, 丑: { major: ['天同'] } });
  assert.ok(names(mz).includes('明珠出海'));
  assert.ok(names(mz).includes('命無正曜'));
  // 君臣慶會：紫微坐午、左輔右弼在三合的寅、戌
  assert.ok(names(fakeZ('午', { 午: { major: ['紫微'] }, 寅: { minor: ['左輔'] }, 戌: { minor: ['右弼'] } })).includes('君臣慶會'));
  // 左右夾命、空劫夾命（兩側宮位）；只有一邊不算
  assert.deepEqual(names(fakeZ('子', { 子: { major: ['天同', '太陰'] }, 亥: { minor: ['左輔', '地空'] }, 丑: { minor: ['右弼', '地劫'] } })), ['左右夾命', '空劫夾命']);
  assert.deepEqual(names(fakeZ('子', { 子: { major: ['天同', '太陰'] }, 亥: { minor: ['左輔'] } })), []);
  // 羊陀夾忌：命宮有祿存（擎羊、陀羅必在兩側）又有化忌
  assert.ok(names(fakeZ('辰', { 辰: { major: ['廉貞'], minor: ['祿存'], mut: { 廉貞: '化忌' } } })).includes('羊陀夾忌'));
  // 石中隱玉：巨門在子午坐命要見祿權科；沒有就不算
  assert.ok(names(fakeZ('子', { 子: { major: ['巨門'], mut: { 巨門: '化權' } } })).includes('石中隱玉'));
  assert.ok(!names(fakeZ('子', { 子: { major: ['巨門'] } })).includes('石中隱玉'));
  // 府相朝垣：命宮不坐府相，天府、天相都在三方
  assert.ok(names(fakeZ('子', { 子: { major: ['天同'] }, 辰: { major: ['天府'] }, 申: { major: ['天相'] } })).includes('府相朝垣'));
  // 三奇嘉會：祿權科都在三方四正
  assert.ok(names(fakeZ('寅', { 寅: { major: ['武曲'], mut: { 武曲: '化祿' } }, 申: { major: ['天府'], mut: { 天府: '化權' } }, 午: { minor: ['文昌'], mut: { 文昌: '化科' } } })).includes('三奇嘉會'));
  // 殺破狼：命宮坐七殺
  assert.ok(names(fakeZ('寅', { 寅: { major: ['七殺'] } })).includes('殺破狼'));
});

test('審查修正：借來的星不算殺破狼、巨門化忌不是石中隱玉、雙祿同在命宮叫守命、三合宮不借星', () => {
  // 命宮在未空宮、借遷移（丑）的貪狼：七殺破軍不在命宮三方，這時三方是府相 → 只有命無正曜、府相朝垣
  assert.deepEqual(names(fakeZ('未', { 丑: { major: ['貪狼'] }, 卯: { major: ['天府'] }, 亥: { major: ['天相'] } })), ['命無正曜', '府相朝垣']);
  // 巨門化忌與祿存同在午宮坐命：是羊陀夾忌，不能同時說石中隱玉
  const ji = names(fakeZ('午', { 午: { major: ['巨門'], minor: ['祿存'], mut: { 巨門: '化忌' } } }));
  assert.ok(ji.includes('羊陀夾忌') && !ji.includes('石中隱玉'));
  // 祿存、化祿同在命宮
  assert.ok(names(fakeZ('寅', { 寅: { major: ['武曲'], minor: ['祿存'], mut: { 武曲: '化祿' } } })).includes('雙祿守命'));
  // 三合宮是空宮時不借對宮的星：天同太陰在午（不在辰的三方四正），不能湊成機月同梁
  assert.deepEqual(names(fakeZ('辰', { 辰: { major: ['天機', '天梁'] }, 午: { major: ['天同', '太陰'] } })), []);
});
