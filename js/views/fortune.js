// 「時運」：4×3 星座方格（預設選目前查看的人）＋ 今日／明日／本週／本月／今年 切換（固定在拇指位置）
// ＋ 近期提醒（天象、換流月、沖日）＋ 擇日（想做的事挑哪天）＋ 農民曆與時辰吉凶。
// 農曆與八字模組在背景載入，不擋住星座運勢。

import { h, clear, segmented, scoreBar, scoreClass, fill } from '../ui/dom.js';
import { computeFortune, PERIODS, AREAS, periodLabel } from '../core/fortune.js';
import { SIGNS } from '../core/zodiac.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { isoDate, addDays } from '../core/date.js';
import { aiEnabled, getAiFortune } from '../ui/ai.js';
import { load, save } from '../ui/storage.js';
import { cardHead } from '../ui/icons.js';
import { ringTo } from '../ui/motion.js';
import { hourTimeline, timelineList, heatGrid } from '../ui/widgets.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function mountFortune(root, ctx) {
  let selected = null;
  let period = load('period', 'today');
  if (!PERIODS.some((p) => p.id === period)) period = 'today';
  let almanacOffset = 0; // 農民曆看第幾天（0 = 今天）
  let activity = load('pickActivity', 'money');
  let showAllReminders = false;
  const cache = new Map();
  let renderToken = 0;
  let baziMemo = { key: null, value: null };

  /** 目前查看的人的八字（給沖日、流月、擇日用）；同一個人同一組設定只算一次 */
  function activeBazi(buildBazi) {
    const person = ctx.getActive();
    const input = person ? ctx.inputOf(person) : null;
    if (!input) return null;
    const settings = ctx.getSettings();
    const key = `${person.id}|${JSON.stringify(person.raw)}|${person.gender}|${settings.sect}|${settings.solarTime}`;
    if (baziMemo.key !== key) {
      const b = buildBazi(input, { gender: person.gender || null, sect: settings.sect, solarTime: settings.solarTime, today: zoneToday(tz()) });
      baziMemo = { key, value: b.ok ? b : null };
    }
    return baziMemo.value;
  }

  function mySigns() {
    const natal = ctx.getNatal();
    if (!natal) return [];
    return natal.sun.certain ? [natal.sun.sign] : natal.sun.options;
  }

  function defaultSign() {
    const natal = ctx.getNatal();
    if (!natal) return null;
    if (natal.sun.certain) return natal.sun.sign;
    // 換座日：取當天佔比較長的那一座
    return natal.sun.switchLocal >= '12:00' ? natal.sun.options[0] : natal.sun.options[1];
  }

  function tz() {
    return ctx.getNatal()?.tz || DEFAULT_TZ;
  }

  function getFortune(sign) {
    const today = zoneToday(tz());
    const key = `${sign}|${period}|${isoDate(today)}|${tz()}`;
    if (!cache.has(key)) cache.set(key, computeFortune(sign, period, today, tz()));
    return cache.get(key);
  }

  function render() {
    renderToken += 1;
    const token = renderToken;
    clear(root);
    if (selected === null) selected = defaultSign();
    const mine = mySigns();
    const active = ctx.getActive();

    if (!active) {
      root.append(
        h(
          'div',
          { class: 'card tip' },
          h('p', { text: '先到「我的」填生日，之後打開 App 就會直接顯示你的星座。' }),
          h('button', { type: 'button', class: 'btn small', text: '去填生日', onclick: () => ctx.go('me') }),
        ),
      );
    }

    root.append(
      h(
        'div',
        { class: 'sign-grid', role: 'group', 'aria-label': '選擇星座' },
        SIGNS.map((s, i) =>
          h(
            'button',
            {
              type: 'button',
              class: `sign-btn${i === selected ? ' selected' : ''}`,
              'aria-pressed': i === selected ? 'true' : 'false',
              onclick: () => {
                selected = i;
                render();
              },
            },
            h('span', { class: 'sign-glyph', 'aria-hidden': 'true', text: s.glyph }),
            h('span', { text: s.short }),
            mine.includes(i) ? h('span', { class: 'me-badge', text: active?.self ? '我' : '看' }) : null,
          ),
        ),
      ),
    );

    if (selected === null) {
      root.append(h('p', { class: 'hint center', text: '點上方任一星座查看運勢' }), renderAlmanac(token), periodBar());
      return;
    }

    const f = getFortune(selected);
    const sign = SIGNS[selected];
    root.append(
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'fortune-head' }, h('h2', { text: `${sign.glyph} ${sign.name}` }), h('span', { class: 'muted', text: periodLabel(period, f.dates) })),
        h(
          'div',
          { class: 'score-hero' },
          ringTo(h('div', { class: `score-ring ${scoreClass(f.scores.overall)}` }, h('b', { text: String(f.scores.overall) }), h('small', { text: '整體' })), f.scores.overall),
          h('p', { class: 'summary', text: f.summary }),
        ),
        AREAS.map((a) => scoreBar(a.label, f.scores[a.id])),
        f.notes.map((n) => h('p', { class: 'warn', text: n })),
        f.months ? renderMonths(f) : f.days.length > 1 ? renderDays(f) : null,
        h(
          'details',
          { class: 'more' },
          h('summary', { text: '為什麼是這個分數？' }),
          h('ul', { class: 'reasons' }, f.highlights.map((x) => h('li', { class: `tone-${x.tone}`, text: x.text }))),
          h('p', {
            class: 'hint',
            text: period === 'year'
              ? '今年每月取 1、8、15、22 日的正午行星位置估算，看與這個太陽星座的相對角度（相位）。僅供娛樂參考。'
              : '依期間內每天正午的行星位置，與這個太陽星座的相對角度（相位）推算：三分相、六分相加分；四分相、對分相扣分。僅供娛樂參考。',
          }),
        ),
        h(
          'div',
          { class: 'actions' },
          h('button', {
            type: 'button',
            class: 'btn',
            text: '存成圖卡',
            onclick: () => ctx.share({
              title: `${sign.name}・${periodLabel(period, f.dates)}`,
              subtitle: '依實際行星位置推算',
              big: String(f.scores.overall),
              bigScore: f.scores.overall,
              bigLabel: '整體運勢',
              bars: AREAS.map((a) => ({ label: a.label, value: f.scores[a.id] })),
              lines: [f.summary],
            }, `fortune-${sign.id}.png`),
          }),
        ),
      ),
    );

    if (aiEnabled()) root.append(renderAi(sign, token));
    root.append(...renderTiming(token), renderAlmanac(token), periodBar());
  }

  // ── 近期提醒＋擇日
  function renderTiming(token) {
    const remindBody = h('div', {}, h('div', { class: 'skeleton', style: { height: '80px' } }));
    const chooseBody = h('div', {}, h('div', { class: 'skeleton', style: { height: '120px' } }));
    const remind = h('section', { class: 'card', id: 'reminders' }, cardHead(h, 'bell', '近期提醒', '未來 45 天：天象、換流月、沖到你的日子'), remindBody);
    const choose = h('section', { class: 'card', id: 'choose-day' }, cardHead(h, 'calendar', '擇日：想做的事挑哪天', '未來 30 天，越綠越適合'), chooseBody);
    Promise.all([import('../core/timing.js'), import('../core/bazi.js')])
      .then(([T, B]) => {
        if (token !== renderToken) return;
        const person = ctx.getActive();
        const input = person ? ctx.inputOf(person) : null;
        const bazi = activeBazi(B.buildBazi);
        const today = zoneToday(tz());
        const items = T.upcoming({ from: today, days: 45, bazi, birth: input ? input.date : null, tz: tz() });
        const shown = showAllReminders ? items : items.slice(0, 6);
        fill(remindBody, 
          items.length ? timelineList(shown, { withBasis: true }) : h('p', { class: 'muted', text: '最近沒有特別需要注意的天象或沖煞。' }),
          items.length > 6 ? h('button', { type: 'button', class: 'link', text: showAllReminders ? '收起' : `顯示全部 ${items.length} 則`, onclick: () => { showAllReminders = !showAllReminders; render(); } }) : null,
          bazi ? null : h('p', { class: 'hint', text: '填上生日後，會加入換流月對你的意義與沖到你生肖的日子。' }),
        );
        if (!T.ACTIVITIES.some((a) => a.id === activity)) activity = 'money';
        const sel = h('select', { 'aria-label': '想做的事', onchange: (e) => { activity = e.target.value; save('pickActivity', activity); render(); } }, T.ACTIVITIES.map((a) => h('option', { value: a.id, text: a.label })));
        sel.value = activity;
        const sign = defaultSign() ?? selected;
        const r = T.chooseDays(activity, { from: today, days: 30, bazi, signIndex: sign, gender: person ? person.gender : null, tz: tz() });
        const detail = h('div', { class: 'hour-detail', 'aria-live': 'polite' }, h('p', { class: 'muted small', text: '點日期看理由。' }));
        const pick = (d) => fill(detail, 
          h('h3', { text: `${d.label}・${d.ganzhi}日・${d.score} 分` }),
          h('ul', { class: 'reasons' }, d.reasons.map((x) => h('li', { class: `tone-${x.tone}`, text: x.text }))),
        );
        fill(chooseBody, 
          h('div', { class: 'field' }, h('span', { class: 'field-label', text: '想做的事' }), sel),
          h('h3', { text: '最適合的日子' }),
          h('ol', { class: 'pairs' }, r.best.map((d) => h('li', { class: scoreClass(d.score) }, h('span', { text: `${d.label}・${d.reasons.filter((x) => x.tone === 'good').map((x) => x.text).slice(0, 2).join('、') || '沒有特別加分'}` }), h('b', { text: `${d.score}` })))),
          r.excluded ? h('p', { class: 'muted small', text: `30 天裡有 ${r.excluded} 天是歲破、月破或四離四絕日，傳統上不用來辦這件事，已排除在推薦之外（格子裡點開可以看原因）。` }) : null,
          heatGrid(r.days, pick),
          detail,
          h('p', { class: 'hint', text: '分數＝農民曆宜忌＋這天和你八字的沖合與十神＋當天星座分數；歲破、月破、四離四絕日另外排除或扣分。同分時取日期較早的。傳統與占星的推算規則，重要的事仍以實際狀況為準。' }),
        );
      })
      .catch(() => {
        if (token !== renderToken) return;
        fill(remindBody, h('p', { class: 'warn', text: '提醒元件載入失敗，請確認網路後重新開啟 App。' }));
        clear(chooseBody);
      });
    return [remind, choose];
  }

  function renderDays(f) {
    return h(
      'details',
      { class: 'more', open: f.days.length <= 7 },
      h('summary', { text: '每日走勢' }),
      h(
        'ol',
        { class: 'days' },
        f.days.map((d) => {
          const wd = WEEKDAYS[new Date(Date.UTC(d.date.y, d.date.m - 1, d.date.d)).getUTCDay()];
          return trend(`${d.date.m}/${d.date.d}（${wd}）`, d.scores.overall);
        }),
      ),
    );
  }

  function renderMonths(f) {
    return h('details', { class: 'more', open: true }, h('summary', { text: '每月走勢' }), h('ol', { class: 'days' }, f.months.map((mo) => trend(`${mo.m} 月`, mo.scores.overall))));
  }

  function trend(label, s) {
    return h(
      'li',
      { class: scoreClass(s) },
      h('span', { class: 'day-label', text: label }),
      h('span', { class: 'day-track' }, h('span', { class: 'day-fill', style: { width: `${s}%` } })),
      h('b', { text: String(s) }),
    );
  }

  function renderAi(sign, token) {
    const body = h('p', { class: 'muted', text: '載入 AI 短評中…' });
    const card = h('section', { class: 'card' }, h('h3', { text: 'AI 短評' }), body, h('p', { class: 'hint', text: '由 AI 產生的生活建議，與上方分數分開計算，僅供參考。' }));
    getAiFortune(period)
      .then((data) => {
        if (token !== renderToken) return;
        const text = data?.signs?.[sign.id];
        body.className = '';
        body.textContent = typeof text === 'string' && text ? text : '這個期間的短評尚未產生。';
      })
      .catch((err) => {
        if (token !== renderToken) return;
        body.className = 'warn';
        body.textContent = err.message;
        card.append(h('button', { type: 'button', class: 'btn small', text: '再試一次', onclick: () => render() }));
      });
    return card;
  }

  // ── 農民曆
  function renderAlmanac(token) {
    const body = h('div', {}, h('p', { class: 'muted', text: '農民曆載入中…' }));
    const card = h('section', { class: 'card almanac' }, body);
    const day = addDays(zoneToday(tz()), almanacOffset);
    Promise.all([import('../core/calendar.js'), import('../core/timing.js'), import('../core/bazi.js')])
      .then(([{ almanac, folkZodiac }, T, B]) => {
        if (token !== renderToken) return;
        const a = almanac(day);
        const hours = T.hourGuide(day, activeBazi(B.buildBazi));
        const natal = ctx.getNatal();
        const person = ctx.getActive();
        const myZodiac = natal ? folkZodiac(natal.date).name : null;
        const clash = myZodiac && a.chongShengXiao === myZodiac;
        fill(body, 
          h(
            'div',
            { class: 'almanac-head' },
            h('button', { type: 'button', class: 'link', 'aria-label': '前一天', text: '‹ 前一天', onclick: () => { almanacOffset -= 1; render(); } }),
            h('div', { class: 'center' }, h('b', { text: `${a.solar.m}/${a.solar.d}（${a.weekday}）` }), h('div', { class: 'muted small', text: `${a.lunarText}・${a.ganzhi.day}日` })),
            h('button', { type: 'button', class: 'link', 'aria-label': '後一天', text: '後一天 ›', onclick: () => { almanacOffset += 1; render(); } }),
          ),
          almanacOffset !== 0 ? h('div', { class: 'center' }, h('button', { type: 'button', class: 'link', text: '回到今天', onclick: () => { almanacOffset = 0; render(); } })) : null,
          a.festivals.length || a.jieqi ? h('p', { class: 'center festival', text: [a.jieqi, ...a.festivals].filter(Boolean).join('・') }) : null,
          clash ? h('p', { class: 'warn', text: `這天沖${a.chongShengXiao}，${person?.self ? '你' : person?.name || ''}屬${myZodiac}，重要的事多留意、保持低調。` }) : null,
          chipRow('宜', a.yi, 'yi'),
          chipRow('忌', a.ji, 'ji'),
          h('p', { text: `沖煞：沖${a.chong}・煞${a.sha}` }),
          h('h3', { text: '時辰吉凶：這天幾點做什麼' }),
          hourTimeline(hours, { markNow: almanacOffset === 0 }),
          h(
            'details',
            { class: 'more' },
            h('summary', { text: '更多（吉神凶煞、胎神、星宿、節氣、方位、彭祖百忌）' }),
            h('ul', { class: 'plain' },
              h('li', { text: `干支：${a.ganzhi.year}年 ${a.ganzhi.month}月 ${a.ganzhi.day}日` }),
              a.jiShen.length ? h('li', { text: `吉神宜趨：${a.jiShen.join('、')}` }) : null,
              a.xiongSha.length ? h('li', { text: `凶煞宜忌：${a.xiongSha.join('、')}` }) : null,
              h('li', { text: `胎神占方：${a.tai}（家有孕婦，這個位置不要搬動、釘釘子）` }),
              h('li', { text: `二十八宿：${a.xiu}` }),
              h('li', { text: `物候：${a.wuhou}${a.season.length ? `・${a.season.join('・')}` : ''}` }),
              a.nextJieQi ? h('li', { text: `下一個節氣：${a.nextJieQi.name}（${a.nextJieQi.date.m}/${a.nextJieQi.date.d}）` }) : null,
              h('li', { text: `喜神${a.positions.xi}・財神${a.positions.cai}・福神${a.positions.fu}` }),
              h('li', { text: `值星：${a.zhiXing}・值神：${a.tianShen}` }),
              h('li', { text: `彭祖百忌：${a.pengzu.join('；')}` }),
              h('li', { text: `今年農民曆：${a.yearItems.join('・')}` })),
            h('p', { class: 'hint', text: '資料由 lunar-typescript 依傳統曆法推算，與各家農民曆可能略有出入，僅供參考。' }),
          ),
        );
      })
      .catch(() => {
        if (token !== renderToken) return;
        fill(body, h('p', { class: 'warn', text: '農民曆載入失敗，請確認網路後重新開啟 App。' }));
      });
    return card;
  }

  function chipRow(label, items, cls) {
    return h('div', { class: `chip-row ${cls}` }, h('b', { class: 'chip-label', text: label }), items.length ? items.map((t) => h('span', { class: 'chip', text: t })) : h('span', { class: 'muted', text: '—' }));
  }

  function periodBar() {
    return h(
      'div',
      { class: 'period-bar' },
      segmented({
        name: 'period',
        label: '期間',
        value: period,
        options: PERIODS.map((p) => ({ value: p.id, label: p.label })),
        onChange: (next) => {
          period = next;
          save('period', period);
          render();
        },
      }),
    );
  }

  ctx.onProfile(() => {
    selected = null;
    cache.clear();
    render();
  });
  render();
  return { refresh: render };
}
