import test from 'node:test';
import assert from 'node:assert/strict';
import { WAGE_ROWS, WAGE_FOR, NO_WAGE, WAGE_SOURCE } from '../js/core/wages.js';
import { SOC_NAMES } from '../js/core/occupations.js';
import { jobOf, wageText, JOB_GROUPS } from '../js/core/jobs.js';

const OFFICIAL = [...SOC_NAMES.keys()].filter((c) => c.length === 4).map((c) => jobOf(c));
const CURATED = JOB_GROUPS.flatMap((g) => g.jobs).map((x) => jobOf(x.id)).filter((x) => x && !x.status);

test('薪資表：職類不重複、數字在合理範圍、對到的官方代碼都存在而且只屬於一個職類', () => {
  assert.ok(WAGE_ROWS.length >= 150);
  assert.equal(new Set(WAGE_ROWS.map((r) => r[0])).size, WAGE_ROWS.length, '職類名稱重複');
  const owner = new Map();
  for (const [name, month, year, codes] of WAGE_ROWS) {
    // 最高是航空駕駛員 297,880（調查原文）
    assert.ok(Number.isInteger(month) && month >= 25000 && month <= 320000, `${name} 月薪 ${month}`);
    assert.ok(year >= 25 && year <= 400, `${name} 年薪 ${year}`);
    // 年薪含年終，至少要接近 12 個月的經常性薪資（年份差一年，留 15% 誤差）；抽錯欄位會在這裡現形
    const ratio = (year * 10000) / (month * 12);
    assert.ok(ratio > 0.85 && ratio < 2, `${name} 年薪／月薪比例 ${ratio.toFixed(2)}`);
    for (const c of codes.split(' ').filter(Boolean)) {
      assert.ok(SOC_NAMES.has(c), `${name} 的代碼 ${c} 不在官方分類`);
      assert.ok(!owner.has(c), `代碼 ${c} 同時對到「${owner.get(c)}」和「${name}」`);
      owner.set(c, name);
    }
  }
  for (const name of Object.values(WAGE_FOR).filter(Boolean)) assert.ok(WAGE_ROWS.some((r) => r[0] === name), `WAGE_FOR 的「${name}」不在表裡`);
  assert.match(WAGE_SOURCE, /勞動部 114 年職類別薪資調查/);
});

test('照調查原文抽查：電信工程師、機車送件、電信技術員；越細的代碼優先', () => {
  assert.deepEqual(jobOf('2153').wage, { name: '電信工程師', month: 97195, year: 182.8 });
  assert.equal(jobOf('8321').wage.month, 36536);
  assert.equal(jobOf('3522').wage.name, '電信技術員');
  // 6010 只有小類 601 對到「園藝及農牧業生產人員」
  assert.equal(jobOf('6010').wage.name, '園藝及農牧業生產人員');
  assert.equal(wageText(jobOf('2153')), '月薪約 9.7 萬、年薪約 183 萬（電信工程師）');
  // 收入高中低改用真實月薪：4 萬以下低、5.5 萬以上高
  assert.equal(jobOf('8321').pay, 1);
  assert.equal(jobOf('2153').pay, 3);
  assert.equal(jobOf('operator').wage.name, '半導體製品產線作業人員');
});

test('沒有資料的照實寫原因，不拿別的職類硬套：軍職、公職、公立老師、接案、範圍太廣', () => {
  assert.equal(jobOf('mil_comm').wage.none, NO_WAGE.mil);
  assert.equal(jobOf('0100').wage.none, NO_WAGE.mil);
  assert.equal(jobOf('5402').wage.none, NO_WAGE.gov);
  assert.equal(jobOf('cga_police').wage.none, NO_WAGE.gov);
  assert.equal(jobOf('2612').wage.none, NO_WAGE.gov, '法官');
  assert.equal(jobOf('teacher').wage.none, NO_WAGE.teacher);
  assert.equal(jobOf('2310').wage.none, NO_WAGE.teacher);
  assert.equal(jobOf('creator').wage.none, NO_WAGE.self);
  assert.equal(jobOf('researcher').wage.none, NO_WAGE.broad);
  // 5409 有救生員這類民間工作，不說成公職
  assert.equal(jobOf('5409').wage.none, NO_WAGE.none);
  // 沒有數字時附上本 App 估計的高中低；接案、創業差太多，不估
  assert.match(wageText(jobOf('mil_comm')), /^軍職依俸額表.*（本 App 估計收入(偏低|中等|偏高)）$/);
  assert.equal(wageText(jobOf('creator')), NO_WAGE.self);
  // 沒有數字時保留本 App 原本判斷的收入高中低（排序和「你在意的」還用得到）
  assert.ok([1, 2, 3].includes(jobOf('mil_comm').pay));
});

test('每個工作都有薪資或原因；官方 380 細類至少 85% 有數字', () => {
  for (const x of [...OFFICIAL, ...CURATED]) {
    assert.ok(x.wage && (x.wage.month || Object.values(NO_WAGE).includes(x.wage.none)), `${x.id}${x.name} 沒有薪資也沒有原因`);
    assert.ok(wageText(x).length > 0);
  }
  const withData = OFFICIAL.filter((x) => x.wage.month).length;
  assert.ok(withData / OFFICIAL.length >= 0.85, `有數字的只有 ${withData}／${OFFICIAL.length}`);
});
