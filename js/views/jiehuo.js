// 「占卜 → 解惑」：選一個困擾、起一卦，再把命盤、時機和具體做法放在一起。
// 問題的文字只在這支手機上（按「存到紀錄」才存進本機紀錄），任何計算都不送出資料。

import { h, fill, segmented } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { cardHead } from '../ui/icons.js';
import { reveal, order } from '../ui/motion.js';
import { partsList } from '../ui/widgets.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { TOPICS, overall } from '../core/jiehuo.js';
import { loadProfile } from './profile.js';

const TONE_CLASS = { good: 'lv-high', mid: 'lv-mid', care: 'lv-poor' };

/** 六爻圖：由上（上爻）畫到下（初爻），動爻標金色 */
function hexaEl(hx, moving = 0, label = '') {
  const lines = [...hx.lower.lines, ...hx.upper.lines];
  const rows = [];
  for (let i = 5; i >= 0; i -= 1) {
    rows.push(h('span', { class: `yao ${lines[i] ? 'yang' : 'yin'}${moving === i + 1 ? ' moving' : ''}` }, h('i'), lines[i] ? null : h('i')));
  }
  order(rows.slice().reverse());
  return h('div', { class: 'hexa-box' }, h('div', { class: 'hexa', role: 'img', 'aria-label': `${label}${hx.name}${moving ? `，第 ${moving} 爻動` : ''}` }, rows), h('b', { text: hx.name }), label ? h('small', { class: 'muted', text: label }) : null);
}

export function mountJiehuo(root, ctx) {
  let topicId = load('jiehuoTopic', 'work');
  if (!TOPICS.some((t) => t.id === topicId)) topicId = 'work';
  let method = 'time';
  const out = h('div', {});
  const topicSel = h('select', { 'aria-label': '困擾的類型', onchange: (e) => { topicId = e.target.value; save('jiehuoTopic', topicId); } }, TOPICS.map((t) => h('option', { value: t.id, text: t.label })));
  topicSel.value = topicId;
  const question = h('textarea', { rows: 2, maxlength: 200, 'aria-label': '想問的事（可不填）', placeholder: '例如：要不要接下新的主管職？（可不填，只存在這支手機）' });
  const nums = [1, 2, 3].map((i) => h('input', { type: 'number', inputmode: 'numeric', min: 1, max: 9999, 'aria-label': `第 ${i} 個數字`, placeholder: String([3, 8, 5][i - 1]) }));
  const numBox = h('div', { class: 'num-row', hidden: true }, nums);
  const methodSeg = segmented({
    name: 'jiehuo-method',
    label: '起卦方式',
    value: method,
    options: [{ value: 'time', label: '用現在的時間' }, { value: 'numbers', label: '自己選三個數字' }],
    onChange: (v) => { method = v; numBox.hidden = v !== 'numbers'; },
  });
  const castBtn = h('button', { type: 'button', class: 'btn primary', text: '起卦', onclick: () => run() });

  root.append(
    h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'sparkle', '遇到困難？問一卦', '梅花易數起卦，再對照你的命盤與時機'),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '困擾的類型' }), topicSel),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '想問的事（可不填）' }), question),
      h('p', { class: 'field-label', text: '起卦方式' }),
      methodSeg,
      numBox,
      h('div', { class: 'actions' }, castBtn),
      h('details', { class: 'more' }, h('summary', { text: '怎麼問比較準' }),
        h('p', { class: 'hint', text: '一次只問一件事，心裡想清楚再按。同一件事不要一直重抽，第一次的結果最有參考價值。「用現在的時間」依農曆年、月、日、時起卦；「三個數字」是第一個取上卦、第二個取下卦、第三個取動爻。' })),
    ),
    out,
  );

  async function run() {
    castBtn.disabled = true;
    castBtn.textContent = '起卦中…';
    try {
      const I = await import('../core/iching.js');
      const now = new Date();
      let cast;
      if (method === 'numbers') {
        cast = I.castByNumbers(...nums.map((x) => x.value));
        if (!cast.ok) {
          ctx.toast(cast.error);
          return;
        }
      } else {
        // 起卦用台灣時間（農曆日期和時辰以台灣為準）
        const t = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
        const get = (k) => Number(t.find((x) => x.type === k).value);
        cast = I.castByTime({ y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute') });
      }
      const topic = TOPICS.find((x) => x.id === topicId);
      const extra = await personal(topic);
      const verdict = overall(cast, extra ? extra.yearTone : 'mid');
      fill(out, ...reveal(render(topic, cast, verdict, extra)));
      out.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (err) {
      fill(out, h('section', { class: 'card' }, h('p', { class: 'warn', text: `起卦失敗：${err && err.message ? err.message : '請確認網路後重新開啟 App'}` })));
    } finally {
      castBtn.disabled = false;
      castBtn.textContent = '起卦';
    }
  }

  /** 有填生日才加上命盤、今年運勢與近期好日子 */
  async function personal(topic) {
    const p = ctx.getActive();
    const input = p ? ctx.inputOf(p) : null;
    if (!input) return null;
    const settings = ctx.getSettings();
    const today = zoneToday(DEFAULT_TZ);
    const opts = { gender: p.gender || null, sect: settings.sect, solarTime: settings.solarTime, today };
    const [prof, { buildCareer }, T, { BLOOD }, F] = await Promise.all([
      loadProfile(ctx, p, input, opts, { withName: false }), import('../core/career.js'), import('../core/timing.js'), import('../core/blood.js'), import('../core/fengshui.js'),
    ]);
    const career = buildCareer({ natal: prof.natal, bazi: prof.bazi, ziwei: prof.ziwei, birth: input.date, bloodType: p.bloodType || '', today, lifePathNumber: prof.lifePathNumber });
    const area = prof.reading.areas.find((a) => a.id === topic.area);
    const signIndex = prof.natal && prof.natal.sun && prof.natal.sun.certain !== false ? prof.natal.sun.sign : null;
    const days = T.chooseDays(topic.activity, { from: today, days: 30, bazi: prof.bazi, signIndex, gender: p.gender || null }).best.slice(0, 3);
    const thisYear = career.future.years[0];
    const ys = prof.bazi ? (await import('../core/bazi.js')).yongShen(prof.bazi) : null;
    return { p, area, days, thisYear, yearTone: thisYear.tone, blood: BLOOD[p.bloodType] || null, ys, items: ys ? F.ELEMENT_ITEMS[ys.primary] : null };
  }

  function render(topic, cast, verdict, extra) {
    const q = question.value.trim();
    const cards = [
      h(
        'section',
        { class: 'card feature' },
        cardHead(h, 'sparkle', `${topic.label}：${cast.base.name} → ${cast.bian.name}`, cast.basis),
        q ? h('p', { class: 'muted', text: `你問：${q}` }) : null,
        h('div', { class: 'hexa-row' }, hexaEl(cast.base, cast.moving, '本卦（現況）'), h('span', { class: 'hexa-arrow', 'aria-hidden': 'true', text: '→' }), hexaEl(cast.bian, 0, '變卦（結果）')),
        h('div', { class: 'score-hero' }, h('div', { class: `verdict ${TONE_CLASS[cast.verdict.tone]}` }, h('b', { text: cast.verdict.level }), h('small', { text: cast.relation })), h('p', { class: 'summary', text: verdict.text })),
        h('ul', { class: 'reasons' },
          h('li', { class: 'tone-info', text: `現況（${cast.base.name}）：${cast.base.now}${cast.base.advice}` }),
          h('li', { class: 'tone-info', text: cast.position }),
          h('li', { class: 'tone-info', text: `過程（互卦${cast.hu.name}）：${cast.hu.now}` }),
          h('li', { class: 'tone-info', text: `結果（變卦${cast.bian.name}）：${cast.bian.now}${cast.outcome}` }),
          h('li', { class: cast.verdict.tone === 'care' ? 'tone-bad' : 'tone-good', text: cast.verdict.text })),
        h('p', { class: 'hint', text: `體卦${cast.ti.name}（${cast.ti.wx}）代表你，用卦${cast.yong.name}（${cast.yong.wx}）代表這件事；兩者的五行生剋決定吉凶。卦象是幫你整理思緒的工具，不是命令。` }),
      ),
    ];
    if (extra) {
      cards.push(h(
        'section',
        { class: 'card' },
        cardHead(h, 'book', '你的命盤怎麼看這件事', `${extra.p.name}・${extra.area ? extra.area.title : ''}`),
        extra.area && extra.area.summary ? h('p', { class: 'gold', text: extra.area.summary }) : null,
        extra.area ? partsList(extra.area.points.slice(0, 4)) : null,
        extra.blood ? h('p', { text: `血型 ${extra.p.bloodType} 型在困境時：${extra.blood.stress}${extra.blood.cope}` }) : null,
      ));
      cards.push(h(
        'section',
        { class: 'card' },
        cardHead(h, 'calendar', '什麼時候比較順', `${extra.thisYear.year} 年：${extra.thisYear.headline}`),
        h('ul', { class: 'reasons' }, extra.thisYear.doList.map((t) => h('li', { class: 'tone-good', text: t })), extra.thisYear.watchList.map((t) => h('li', { class: 'tone-bad', text: t }))),
        extra.days.length ? h('h3', { text: '接下來 30 天適合處理這件事的日子' }) : null,
        extra.days.length ? h('ul', { class: 'reasons' }, extra.days.map((d) => h('li', { class: 'tone-good', text: `${d.label} ${d.score} 分：${d.reasons.filter((x) => x.tone === 'good').slice(0, 2).map((x) => x.text).join('；') || '沒有特別的沖煞'}` }))) : null,
      ));
    }
    const lucky = extra && extra.items && extra.ys
      ? `開運小幫手：你的喜用是「${extra.ys.primary}」，這段時間多用${extra.items.colors}，往${extra.items.direction}方走走；桌上可以放${extra.items.desk.split('、')[0]}。`
      : null;
    cards.push(h(
      'section',
      { class: 'card' },
      cardHead(h, 'shield', '具體怎麼做', '先做得到的事，再談開運'),
      h('ol', { class: 'plan' }, order(topic.steps.map((t) => h('li', { text: t })))),
      lucky ? h('p', { class: 'gold', text: lucky }) : null,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn', text: '財位與開運擺設', onclick: () => ctx.go('destiny', { tool: 'fengshui' }) }),
        h('button', { type: 'button', class: 'btn', text: '工作與未來方向', onclick: () => ctx.go('destiny', { tool: 'career' }) })),
      h('div', { class: 'actions' }, h('button', {
        type: 'button',
        class: 'btn ghost',
        text: '存到紀錄',
        onclick: () => {
          ctx.addHistory({ type: 'jiehuo', personId: extra ? extra.p.id : null, title: `${topic.label}・${cast.base.name}→${cast.bian.name}`, summary: `${cast.verdict.level}（${cast.relation}）${q ? `。問：${q.slice(0, 80)}` : ''}。${verdict.text}` });
          ctx.toast('已存到「我的」的查詢紀錄（只在這支手機）');
        },
      })),
      extra ? null : h('p', { class: 'hint', text: '到「我的」填生日，解惑會加上你的命盤、今年運勢和適合的日子。' }),
    ));
    return cards;
  }

  return {};
}
