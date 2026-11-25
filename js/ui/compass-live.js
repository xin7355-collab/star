// 手機羅盤：要權限、聽方位感測器、在面板裡畫即時羅盤，告訴使用者往哪邊轉才會對準財位或要避開的方位。
// iPhone 的「動作與方向」權限一定要在點擊當下要：orientation.js 的 askOrientation 要在 onclick 裡第一個呼叫，前面不能 await 別的東西。
// 感測器資料只拿來轉動畫面，不存、不送出。

import { h, fill } from './dom.js';
import { screenAngle } from './orientation.js';
import { liveCompass } from './charts.js';
import { headingFromEvent, dirOf, mountainOf, smooth, unwrap, turnHint, isFlat, DIR_DEG } from '../core/compass.js';

/**
 * 開始聽方位，回傳停止函式。Android 會同時發相對、絕對兩種事件：收到過「有資料的」絕對事件後就只用絕對的。
 * 只看事件種類會出錯：沒有磁力計的裝置（和電腦版 Chrome）會發一筆全是 null 的絕對事件，之後的有效事件全被擋掉。
 * @param {(r:{heading:number, accuracy:number|null, beta:number|null, gamma:number|null})=>void} onReading
 */
export function watchHeading(onReading) {
  let absolute = false;
  const handler = (e) => {
    const isAbs = e.type === 'deviceorientationabsolute';
    if (!isAbs && absolute) return;
    const r = headingFromEvent(e, screenAngle());
    if (!r) return;
    if (isAbs) absolute = true;
    onReading({ ...r, beta: typeof e.beta === 'number' ? e.beta : null, gamma: typeof e.gamma === 'number' ? e.gamma : null });
  };
  window.addEventListener('deviceorientationabsolute', handler);
  window.addEventListener('deviceorientation', handler);
  return () => {
    window.removeEventListener('deviceorientationabsolute', handler);
    window.removeEventListener('deviceorientation', handler);
  };
}

/** 沒拿到權限：說清楚能怎麼做（不是只說失敗） */
export function compassDenied(sheet) {
  fill(sheet.body,
    h('p', { class: 'warn', text: '沒有拿到「動作與方向」的權限，指南針沒辦法轉。' }),
    h('p', { text: 'iPhone：關掉這個 App 再打開，按一次「用手機羅盤找方位」，跳出詢問時選「允許」。' }),
    h('p', { text: 'Android：Chrome 右上角「⋮」→「設定」→「網站設定」→「動態感應器」，允許本站。' }),
    h('p', { class: 'hint', text: '也可以用手機內建的「指南針」App，對照方位圖找財位。' }));
  sheet.open(undefined, '手機羅盤');
}

/**
 * 在面板裡打開即時羅盤。
 * @param {{sheet:object, personal:object|null, targets:{id:string,label:string,name?:string,mark:string,dir:string,kind:'good'|'bad',legend?:string}[]}} o
 *   targets 第一個是預設要找的；label 是選單文字，name 是提示句裡的名稱，mark 是盤上的一個字，legend 是圖例（沒給都用 label）
 */
export function openCompass({ sheet, personal, targets }) {
  let target = targets[0] || null;
  const dial = liveCompass(personal, targets.map((t) => ({ id: t.id, dir: t.dir, kind: t.kind, label: t.mark })));
  const now = h('p', { class: 'cp-now', text: '等待指南針…' });
  const guide = h('p', { class: 'cp-guide' });
  // 螢幕閱讀器只在「往左／往右／對準了」改變時唸，不要每一度都唸
  const say = h('p', { class: 'visually-hidden', 'aria-live': 'polite' });
  const warn = h('p', { class: 'warn small', hidden: true });
  let heading = null;
  let cont = null;
  let reading = null;
  let raf = 0;
  let said = '';
  const paint = () => {
    raf = 0;
    if (heading == null) return;
    cont = unwrap(cont, heading);
    dial.setHeading(cont);
    now.textContent = `手機頭朝：${dirOf(heading)}（${mountainOf(heading)}山 ${Math.round(heading) % 360}°）`;
    if (target) {
      const t = turnHint(heading, DIR_DEG[target.dir]);
      const what = `${target.dir}的${target.name || target.label}`;
      guide.textContent = t.onTarget ? `✓ 對準了：前面就是${what}` : `${t.text}，就會對準${what}`;
      guide.classList.toggle('on', t.onTarget);
      const word = t.onTarget ? `對準了，前面就是${what}` : t.side === 'right' ? '往右轉' : '往左轉';
      if (word !== said) {
        said = word;
        say.textContent = word;
        if (t.onTarget && navigator.vibrate) navigator.vibrate(30);
      }
    }
    const flat = isFlat(reading.beta, reading.gamma);
    const shaky = reading.accuracy != null && (reading.accuracy < 0 || reading.accuracy > 25);
    warn.hidden = flat && !shaky;
    warn.textContent = !flat ? '把手機放平（螢幕朝上），方向才準。' : '方向可能不準：離開金屬、磁鐵和電器，拿手機在空中畫幾次 8 字校正。';
  };
  const select = h('select', {
    'aria-label': '要找哪個方位',
    onchange: (e) => {
      target = targets.find((t) => t.id === e.target.value) || null;
      if (target) dial.focusMark(target.id);
      said = '';
      paint();
    },
  }, targets.map((t) => h('option', { value: t.id, text: `${t.label}：${t.dir}` })));
  const stop = watchHeading((r) => {
    reading = r;
    heading = smooth(heading, r.heading);
    if (!raf) raf = requestAnimationFrame(paint);
  });
  // 幾秒都沒有資料：多半是電腦或沒有指南針的平板，給替代做法
  const timer = setTimeout(() => {
    if (reading) return;
    now.textContent = '收不到指南針的資料';
    warn.hidden = false;
    warn.textContent = '這台裝置可能沒有指南針（電腦、部分平板）。可以改用手機打開，或用一般羅盤、iPhone 內建的「指南針」App 對照方位圖。';
  }, 4000);
  // 圖例：同一個記號（例如九紫、八白都是「財」）只列一次
  const keys = new Map();
  for (const t of targets) if (!keys.has(t.mark + t.kind)) keys.set(t.mark + t.kind, t);
  const legend = [...keys.values()].map((t) => h('span', { class: `cp-key ${t.kind}` }, h('b', { text: t.mark }), h('span', { text: t.legend || t.label })));
  if (target) dial.focusMark(target.id);
  // 轉身體時要一直看得到「往哪轉」：提示放在羅盤上面，說明放最後
  fill(sheet.body,
    targets.length ? h('div', { class: 'field' }, h('span', { class: 'field-label', text: '要找' }), select) : null,
    now,
    guide,
    say,
    warn,
    dial,
    legend.length ? h('div', { class: 'cp-legend' }, legend) : null,
    h('p', { class: 'hint', text: '站在家裡的中心點（或你的座位），手機平放、螢幕朝上。轉動身體，讓目標的記號轉到最上面的金色三角形下面。' }),
    h('p', { class: 'hint', text: '用的是磁北，和傳統羅盤一樣。方位感測器的資料只用來轉動畫面，不會存起來或送出去。' }));
  sheet.open(() => {
    stop();
    clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
  }, '手機羅盤');
}
