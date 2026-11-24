// 「占卜 → 解惑」：選一個困擾、起一卦，梅花看大勢、六爻看事情本身和應期，再把命盤、時機和具體做法放在一起。
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
const LINE_NAME = ['初', '二', '三', '四', '五', '上'];
const CHANGE_TONE = { 回頭生: 'tone-good', 化進: 'tone-good', 回頭剋: 'tone-bad', 化退: 'tone-bad', 化墓: 'tone-bad', 化絕: 'tone-bad' };
const TIMING = { key: { cls: 'tone-info', tag: '應期' }, good: { cls: 'tone-good', tag: '轉機' }, bad: { cls: 'tone-bad', tag: '小心' } };

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

/** 起卦當下的台灣時間（農曆日期、時辰、月建日辰都以台灣為準） */
function taiwanNow() {
  const t = new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const get = (k) => Number(t.find((x) => x.type === k).value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute') };
}

/** 六爻排盤表：上爻在上；用神那一行加底色，動爻標 ○（陽變陰）或 ×（陰變陽） */
function liuyaoTable(ly) {
  const yongPos = ly.yong.source ? 0 : ly.yong.pos;
  const rows = [...ly.rows].reverse().map((r) => h(
    'tr',
    { class: r.pos === yongPos ? 'yong' : null },
    h('td', { text: r.shen }),
    h('td', { text: `${r.qin} ${r.zhi}${r.wx}` }),
    h('td', {}, h('span', { class: `ly-line ${r.yang ? 'yang' : 'yin'}${r.moving ? ' moving' : ''}`, role: 'img', 'aria-label': `${LINE_NAME[r.pos - 1]}爻${r.yang ? '陽' : '陰'}${r.moving ? '，動' : ''}` }, h('i'), r.yang ? null : h('i')), r.moving ? h('b', { class: 'ly-mark', text: r.yang ? '○' : '×' }) : null),
    h('td', { class: 'ly-sy', text: r.shi ? '世' : r.ying ? '應' : '' }),
    h('td', { text: r.change ? `${r.change.qin} ${r.change.zhi}${r.change.wx}` : '' }),
  ));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'liuyao' },
    h('thead', {}, h('tr', {}, ['六神', '六親', '爻', '世應', '變出'].map((t) => h('th', { scope: 'col', text: t })))),
    h('tbody', {}, rows)));
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
      cardHead(h, 'sparkle', '遇到困難？問一卦', '梅花看大勢、六爻看細節，再對照你的命盤與時機'),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '困擾的類型' }), topicSel),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '想問的事（可不填）' }), question),
      h('p', { class: 'field-label', text: '起卦方式' }),
      methodSeg,
      numBox,
      h('div', { class: 'actions' }, castBtn),
      h('details', { class: 'more' }, h('summary', { text: '怎麼問比較準' }),
        h('p', { class: 'hint', text: '一次只問一件事，心裡想清楚再按。同一件事不要一直重抽，第一次的結果最有參考價值。「用現在的時間」依農曆年、月、日、時起卦；「三個數字」是第一個取上卦、第二個取下卦、第三個取動爻。問感情時，到「我的」填上性別，六爻才知道對方要看哪一爻。' })),
    ),
    out,
  );

  async function run() {
    castBtn.disabled = true;
    castBtn.textContent = '起卦中…';
    try {
      const [I, L] = await Promise.all([import('../core/iching.js'), import('../core/liuyao.js')]);
      const when = taiwanNow();
      let cast;
      if (method === 'numbers') {
        cast = I.castByNumbers(...nums.map((x) => x.value), when);
        if (!cast.ok) {
          ctx.toast(cast.error);
          return;
        }
      } else {
        cast = I.castByTime(when);
      }
      const topic = TOPICS.find((x) => x.id === topicId);
      const active = ctx.getActive();
      const ly = L.analyzeLiuyao(cast, { when, topic: topic.id, gender: active ? active.gender || null : null });
      const extra = await personal(topic);
      const verdict = overall(cast, extra ? extra.yearTone : 'mid');
      fill(out, ...reveal(render(topic, cast, verdict, ly, extra)));
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

  function meihuaCard(topic, cast, verdict, q) {
    return h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'sparkle', `${topic.label}：${cast.base.name} → ${cast.bian.name}`, cast.basis),
      q ? h('p', { class: 'muted', text: `你問：${q}` }) : null,
      h('div', { class: 'hexa-row' }, hexaEl(cast.base, cast.moving, '本卦（現況）'), h('span', { class: 'hexa-arrow', 'aria-hidden': 'true', text: '→' }), hexaEl(cast.bian, 0, '變卦（結果）')),
      h('div', { class: 'score-hero' }, h('div', { class: `verdict ${TONE_CLASS[cast.verdict.tone]}` }, h('b', { text: cast.verdict.level }), h('small', { text: cast.verdict.title })), h('p', { class: 'summary', text: verdict.text })),
      h('ul', { class: 'reasons' },
        h('li', { class: 'tone-info', text: `現況（${cast.base.name}）：${cast.base.now}${cast.base.advice}` }),
        h('li', { class: 'tone-info', text: cast.position }),
        h('li', { class: cast.stages[0].good ? 'tone-good' : 'tone-bad', text: `前段（用卦${cast.yong.name}）：${cast.start}` }),
        h('li', { class: 'tone-info', text: `中段（互卦${cast.hu.name}）：${cast.hu.now}` }),
        h('li', { class: cast.stages[3].good ? 'tone-good' : 'tone-bad', text: `後段（變卦${cast.bian.name}）：${cast.bian.now}${cast.outcome}` }),
        h('li', { class: cast.verdict.tone === 'care' ? 'tone-bad' : 'tone-good', text: `${cast.verdict.title}：${cast.verdict.text}` }),
        cast.season ? h('li', { class: 'tone-info', text: cast.season.text }) : null,
        cast.party ? h('li', { class: 'tone-info', text: cast.party }) : null),
      h('details', { class: 'more' }, h('summary', { text: `體用四個階段（${cast.flow.replace('走勢：', '')}）` }),
        h('ul', { class: 'reasons' }, cast.stages.map((s) => h('li', { class: s.good ? 'tone-good' : 'tone-bad', text: `${s.phase}・${s.label}${s.trigram.name}（${s.trigram.wx}）：${s.relation}，${s.effect}` }))),
        h('p', { class: 'hint', text: `體卦${cast.ti.name}（${cast.ti.wx}）代表你，用卦${cast.yong.name}（${cast.yong.wx}）代表這件事。先看互卦、變卦是不是一起生你或剋你，再看剋你的有沒有兩個以上卻沒有幫你的，最後看開頭（用卦）和結尾（變卦）。卦象是幫你整理思緒的工具，不是命令。` })),
    );
  }

  function liuyaoCard(cast, ly) {
    const y = ly.yong;
    const where = y.source === 'fu' ? `伏在${LINE_NAME[y.pos - 1]}爻下面` : y.source === 'changed' ? `${LINE_NAME[y.pos - 1]}爻變出` : `${LINE_NAME[y.pos - 1]}爻`;
    const same = ly.tone === cast.verdict.tone;
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'clock', '六爻細看：事情本身和應期', `${ly.palace.name}宮${ly.palace.orderName}・${ly.monthZhi}月 ${ly.day}日・旬空${ly.kong}`),
      liuyaoTable(ly),
      h('p', { class: 'muted small', text: y.source ? `用神不在本卦上（${where}），表格沒有標底色。` : '左邊有金線、有底色的那一行是用神（代表你問的事）。' }),
      h('h3', { text: `用神：${y.qin} ${y.zhi}${y.wx}（${where}）・${y.level}` }),
      h('p', { class: 'muted', text: `${ly.target.why}。${ly.pickNote}` }),
      h('ul', { class: 'reasons' },
        h('li', { class: y.j.level === 2 ? 'tone-good' : y.j.level === 0 ? 'tone-bad' : 'tone-info', text: `旺衰：${y.j.notes.join('；')}` }),
        y.change ? h('li', { class: CHANGE_TONE[y.change.type] || 'tone-info', text: `動變：變出${y.change.qin}${y.change.zhi}${y.change.wx}，${y.change.text}` }) : null,
        ly.godNotes.map((n) => h('li', { class: `tone-${n.tone}`, text: n.text })),
        h('li', { class: 'tone-info', text: ly.shiYing }),
        ly.shape ? h('li', { class: 'tone-info', text: ly.shape }) : null),
      h('p', { class: ly.tone === 'care' ? 'warn' : 'gold', text: ly.verdict }),
      h('p', { class: 'hint', text: same ? '梅花（大勢）和六爻（事情本身）的結論一致，參考價值比較高。' : '梅花（大勢）和六爻（事情本身）的結論不同：事情有變數，照下面的步驟穩著走，留意應期。' }),
      h('h3', { text: '應期：接下來 30 天比較可能有消息的日子' }),
      h('ul', { class: 'reasons' }, ly.timing.map((c) => h('li', { class: TIMING[c.kind].cls },
        h('b', { text: `${TIMING[c.kind].tag}　` }),
        h('span', { text: c.why }),
        h('div', { class: 'gold small', text: c.dates.length ? `→ ${c.dates.map((d) => d.label).join('、')}` : '→ 30 天內沒有，要看更長的時間' })))),
      h('details', { class: 'more' }, h('summary', { text: '六爻怎麼看' }),
        h('p', { class: 'hint', text: '六爻用的是同一卦，照京房八宮配上地支（納甲）和六親：父母是文書、房子、長輩；兄弟是同輩、競爭、花錢；子孫是福氣、醫藥、晚輩；妻財是錢和對象；官鬼是工作、壓力、病。依你選的困擾取「用神」，看它在起卦的月份、日子有沒有力，有沒有旬空、月破，動了之後變好還是變壞。應期是它比較可能有消息的日子：近的事看日，遠的事要看月或年。' })),
    );
  }

  function render(topic, cast, verdict, ly, extra) {
    const q = question.value.trim();
    const cards = [meihuaCard(topic, cast, verdict, q), liuyaoCard(cast, ly)];
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
          ctx.addHistory({ type: 'jiehuo', personId: extra ? extra.p.id : null, title: `${topic.label}・${cast.base.name}→${cast.bian.name}`, summary: `${cast.verdict.level}（${cast.verdict.title}）${q ? `。問：${q.slice(0, 80)}` : ''}。${verdict.text}六爻用神${ly.yong.qin}${ly.yong.level}。` });
          ctx.toast('已存到「我的」的查詢紀錄（只在這支手機）');
        },
      })),
      extra ? null : h('p', { class: 'hint', text: '到「我的」填生日，解惑會加上你的命盤、今年運勢和適合的日子。' }),
    ));
    return cards;
  }

  return {};
}
