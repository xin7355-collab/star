// 命盤 → 時辰不確定（13 個時辰對照）：不知道出生時間的人，先看「不管哪個時辰都一樣」的結論，會變的部分並排列出。
// 不幫你猜時辰（理由見 core/hours.js）；家人記得的大概時段可以縮小範圍、存在名單裡。
// 已經填了時間的人也能看：出生證明的時間如果是約略記的，可以看記錯一個時辰會差多少。

import { h, fill } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';

/** 會變的項目：每個時辰都不同就直說（逐一看對照表），否則每種結果一行「值：哪幾個時辰」 */
function varyItem(f, count, slotNames) {
  return h('li', { class: 'tone-info' },
    h('b', { text: `${f.system}・${f.label}` }),
    f.groups.length === count && count > 4
      ? h('div', { class: 'small', text: `${count} 個時辰各不相同（逐一看下面的對照表）。` })
      : f.groups.map((g) => h('div', { class: 'small', text: `${g.value}：${slotNames(g.slots)}` })));
}

export async function drawHours(p, input, opts, { ctx }) {
  const [H, { PLACES }] = await Promise.all([import('../core/hours.js'), import('../core/places.js')]);
  // 上升星座要經緯度：沒填時間的人表單不會帶出生地，改用名單裡選的地點（沒選是台北）
  const raw = p.raw || {};
  const custom = raw.placeId === 'custom' && Number.isFinite(raw.lat) && Number.isFinite(raw.lon) ? { lat: raw.lat, lon: raw.lon, name: '自訂座標' } : null;
  const place = input.place || custom || PLACES[raw.placeId] || PLACES.taipei;
  const cands = H.hourCandidates(input, { gender: p.gender, sect: opts.sect, place, today: opts.today });
  const known = H.knownSlot(input, { solarTime: opts.solarTime });
  const who = p.self ? '你' : p.name;
  const risingOf = H.HOUR_FIELDS.find((f) => f.key === 'rising').get;

  const body = h('div', { class: 'hours-body' });
  let win = known ? '' : p.hourWindow || '';

  // 大概的時段：選了就存（存檔會讓整頁重畫，重畫時從名單讀回來）
  const winSel = known ? null : h('select', {
    'aria-label': '大概的時段',
    onchange: (e) => {
      win = e.target.value;
      paint(); // 先畫：存檔後整頁重排 13 張盤要一點時間
      const res = ctx.savePerson({ ...p, hourWindow: win || undefined });
      if (!res.ok) return ctx.toast(res.error);
      ctx.toast(win ? '已記下大概時段' : '已改回 13 個時辰都看');
    },
  }, H.HOUR_WINDOWS.map((w) => h('option', { value: w.id, text: w.label })));
  if (winSel) winSel.value = win;

  function paint() {
    const window = H.HOUR_WINDOWS.find((w) => w.id === win) || H.HOUR_WINDOWS[0];
    const s = H.summarizeHours(cands, window.slots);
    const shown = cands.filter((c) => window.slots.includes(c.id));
    const row = (c) => h('li', { class: c.id === known ? 'hour-row known' : 'hour-row' },
      h('div', { class: 'hour-head' }, h('b', { text: `${c.name}時` }), h('span', { class: 'muted small', text: c.range }),
        c.id === known ? h('span', { class: 'badge good', text: '你填的時間' }) : null),
      h('div', { class: 'small', text: [c.bazi && `八字時柱 ${c.bazi.hour}`, c.bazi && c.bazi.ys && `喜用 ${c.bazi.ys}`, c.chenggu && `骨重 ${c.chenggu.text}`].filter(Boolean).join('・') }),
      h('div', { class: 'small', text: [c.rising !== null && `上升 ${risingOf(c)}`, c.ziwei && `紫微命宮 ${c.ziwei.ming}`].filter(Boolean).join('・') }));
    fill(body,
      h('section', { class: 'card', id: 'hours-stable' },
        cardHead(h, 'shield', '不管哪個時辰都一樣', s.count === 13 ? '13 個時辰排出來都相同：可以放心看' : `${window.label}的 ${s.count} 個時辰排出來都相同`),
        s.stable.length ? h('ul', { class: 'reasons' }, s.stable.map((f) => h('li', { class: 'tone-good' }, h('b', { text: `${f.system}・${f.label}：` }), h('span', { text: f.value })))) : h('p', { class: 'muted', text: '這幾個時辰之間，排出來的項目都不一樣。' }),
        h('p', { class: 'small', text: '另外，生命靈數、瑪雅曆（銀河印記）、姓名學、血型只看日期或名字，本來就不受時辰影響，照常看。' })),
      h('section', { class: 'card', id: 'hours-vary' },
        cardHead(h, 'clock', '會跟著時辰變的', '這些結論先保留，查到出生時間再看'),
        s.vary.length ? h('ul', { class: 'reasons' }, s.vary.map((f) => varyItem(f, s.count, H.slotNames))) : h('p', { class: 'muted', text: '這個時段裡沒有會變的項目。' }),
        h('details', { class: 'more', id: 'hours-table' },
          h('summary', { text: `${s.count} 個時辰逐一看` }),
          h('ol', { class: 'hour-list' }, shown.map(row)))));
  }

  const intro = h('section', { class: 'card feature', id: 'hours-intro' },
    cardHead(h, 'clock', `${who}的時辰對照`, '不知道出生時間時，先看不受時辰影響的結論'),
    known
      ? h('p', { text: `已經填了出生時間（${cands.find((c) => c.id === known).name}時）。出生證明的時間如果是約略記的，下面看得出記錯一個時辰會差多少。` })
      : h('p', { text: '還沒填出生時間：把 13 個時辰（子時分成 0–1 點和 23–24 點）各排一次，只採用「不管哪個時辰都一樣」的結論。' }),
    winSel ? h('div', { class: 'field' }, h('span', { class: 'field-label', text: '家人記得大概幾點嗎？（選了會存起來，用來縮小範圍）' }), winSel) : null,
    H.isDstDay(input) ? h('p', { class: 'warn', text: '出生那天台灣是日光節約時間：出生證明上的鐘面時間要減 1 小時，才是下面的時辰範圍。' }) : null,
    opts.solarTime === 'true' ? h('p', { class: 'hint', text: '時辰範圍用的是標準時間；你在「排盤設定」選了真太陽時，邊界會前後差幾十分鐘。' }) : null,
    !(p.gender === '男' || p.gender === '女') ? h('p', { class: 'muted small', text: '紫微要有性別才能排：到「我的」補上性別，這裡會多列紫微命宮。' }) : null,
    !input.place ? h('p', { class: 'muted small', text: `上升星座用「${place.name || '台北'}」的位置算。` }) : null);

  const help = h('section', { class: 'card', id: 'hours-help' },
    cardHead(h, 'book', '怎麼找到真正的出生時間', '比任何推算都準'),
    h('ul', { class: 'reasons' },
      h('li', { class: 'tone-good', text: '出生證明書上記到幾點幾分：正本在當初辦出生登記的戶政事務所（查驗後留存），可以向那裡申請影本；也可以問當初接生的醫院。' }),
      h('li', { class: 'tone-info', text: '戶籍謄本、身分證通常只有日期，沒有時間。' }),
      h('li', { class: 'tone-info', text: '只記得大概（早上、半夜）也有用：在上面選時段，可以縮小範圍。' })),
    h('details', { class: 'more' },
      h('summary', { text: '為什麼不用個性或測驗幫我猜時辰？' }),
      h('p', { class: 'small', text: '13 張盤裡總有一張看起來很合：假設每張盤說你 5 句個性、每句有一半機會說中，至少一張說中 4 句以上的機率超過 9 成。挑出來的那張當然像你（是照你挑的），拿去算流年大運也不會因此變準，這叫循環論證；八字、紫微、星盤各自挑出的時辰還可能互相打架。所以這裡只告訴你哪些結論不受時辰影響。' })));

  paint();
  return [intro, body, help];
}
