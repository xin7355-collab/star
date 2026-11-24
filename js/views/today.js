// 「今日」：打開 App 第一眼看到的個人儀表板：今日綜合指數、今天要注意什麼、幾點適合做什麼（吉時表）、
// 偏財指數與今日幸運號碼、幸運色與方位、近期重點。全部在手機上計算，不送出任何資料。
// 用到農曆與八字的模組比較大，畫面先顯示骨架，模組載入完再補上內容。

import { h, clear, fill } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { cardHead } from '../ui/icons.js';
import { reveal, ringTo, countUp } from '../ui/motion.js';
import { hourTimeline, ballsRow, timelineList, partsList } from '../ui/widgets.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { SIGNS } from '../core/zodiac.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const LEVEL_CLASS = { 大吉: 'lv-high', 小吉: 'lv-mid', 平: 'lv-low', 宜守: 'lv-poor', 偏財旺: 'lv-high', 小有偏財: 'lv-mid', 平穩: 'lv-low', 保守為宜: 'lv-poor' };

function loadModules() {
  return Promise.all([
    import('../core/bazi.js'),
    import('../core/timing.js'),
    import('../core/windfall.js'),
    import('../core/daily.js'),
    import('../core/calendar.js'),
    import('../core/numerology.js'),
  ]);
}

export function mountToday(root, ctx) {
  let token = 0;

  async function render() {
    token += 1;
    const my = token;
    clear(root);
    root.append(
      h('section', { class: 'card feature' }, h('div', { class: 'skeleton', style: { height: '118px' } }), h('div', { class: 'skeleton', style: { width: '70%' } })),
      h('section', { class: 'card' }, h('div', { class: 'skeleton', style: { height: '64px' } })),
      h('p', { class: 'muted center small', text: '計算今天的運勢中…' }),
    );
    let mods;
    try {
      mods = await loadModules();
    } catch {
      if (my === token) fill(root, h('section', { class: 'card' }, h('p', { class: 'warn', text: '今日運勢需要的元件載入失敗，請確認網路後重新開啟 App。' })));
      return;
    }
    if (my !== token) return;
    const [{ buildBazi }, T, W, D, CAL, NUM] = mods;
    const person = ctx.getActive();
    const natal = ctx.getNatal();
    const input = person ? ctx.inputOf(person) : null;
    const settings = ctx.getSettings();
    const today = zoneToday(DEFAULT_TZ);
    let bazi = null;
    if (input) {
      const b = buildBazi(input, { gender: person.gender || null, sect: settings.sect, solarTime: settings.solarTime, today });
      bazi = b.ok ? b : null;
    }
    const signIndex = natal ? (natal.sun.certain ? natal.sun.sign : natal.sun.options[0]) : null;
    const birth = input ? input.date : null;
    const alm = CAL.almanac(today);
    const data = {
      person,
      today,
      alm,
      daily: D.dailyIndex({ date: today, bazi, signIndex, birth }),
      hours: T.hourGuide(today, bazi),
      windfall: W.windfallDay(today, { bazi, signIndex, birth }),
      lucky: D.luckyItems({ date: today, bazi }),
      profile: W.luckyProfile({ bazi, birth, lifePathNumber: birth ? NUM.lifePath(birth).number : null }),
      items: T.upcoming({ from: today, days: 30, bazi, birth }),
      signIndex,
    };
    data.hourLines = T.hourSummary(data.hours);
    data.attention = T.attentionSummary(data.items, today);
    fill(root, ...reveal([
      person ? heroCard(data) : welcomeCard(data),
      attentionCard(data, T),
      hoursCard(data),
      luckCard(data, W),
      luckyCard(data),
      upcomingCard(data),
    ]));
  }

  function dateLine({ today, alm }) {
    const wd = WEEKDAYS[new Date(Date.UTC(today.y, today.m - 1, today.d)).getUTCDay()];
    return `${today.m}/${today.d}（${wd}）・${alm.lunarText}・${alm.ganzhi.day}日`;
  }

  function heroCard(data) {
    const { daily, person } = data;
    const ring = h('div', { class: `score-ring big ${LEVEL_CLASS[daily.level]}`, role: 'img', 'aria-label': `今日指數 ${daily.score} 分，${daily.level}` }, h('b', { text: String(daily.score) }), h('small', { text: daily.level }));
    ringTo(ring, daily.score);
    countUp(ring.querySelector('b'), daily.score);
    const sign = data.signIndex !== null ? SIGNS[data.signIndex] : null;
    return h(
      'section',
      { class: 'card feature', id: 'today-hero' },
      h('div', { class: 'kicker', text: 'TODAY ・ 今日運勢' }),
      h('p', { class: 'muted small', text: dateLine(data) }),
      h('div', { class: 'score-hero' }, ring, h('div', {}, h('h2', { text: heroTitle(person) }), sign ? h('p', { class: 'muted small', text: `${sign.glyph} ${sign.name}` }) : null, h('p', { class: 'summary', text: daily.advice }))),
      h(
        'details',
        { class: 'more' },
        h('summary', { text: '這個分數怎麼來的' }),
        partsList(daily.parts),
        h('p', { class: 'hint', text: '以星座日運為底，再依八字流日、農民曆黃道黑道、生命靈數流日數加減分。娛樂參考，不是科學預測。' }),
      ),
    );
  }

  function welcomeCard(data) {
    return h(
      'section',
      { class: 'card feature' },
      h('div', { class: 'kicker', text: 'WELCOME' }),
      h('p', { class: 'muted small', text: dateLine(data) }),
      h('h2', { text: '輸入生日，打開你的專屬運勢' }),
      h('p', { text: '有了生日，就能看今日指數、什麼時間做什麼、偏財運與幸運號碼。資料只存在這支手機。' }),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', text: '去填生日', onclick: () => ctx.go('me') })),
    );
  }

  // 自己的資料：「午安，小明」（有本名時取名字部分）；家人朋友：「媽媽的今天」
  function heroTitle(person) {
    if (!person.self) return `${person.name}的今天`;
    if (person.fullName) return `${greeting()}，${person.fullName.slice(person.fullName.length >= 3 ? 1 : 0)}`;
    return person.name && person.name !== '我' ? `${greeting()}，${person.name}` : greeting();
  }

  function greeting() {
    const hr = new Date().getHours();
    if (hr < 5) return '夜深了';
    if (hr < 11) return '早安';
    if (hr < 14) return '午安';
    if (hr < 18) return '下午好';
    return '晚安';
  }

  function attentionCard(data) {
    const { daily, alm, attention, hourLines } = data;
    const lines = [];
    const bz = daily.parts.find((p) => p.system === '八字');
    if (bz) lines.push(bz.text);
    if (alm.yi.length) lines.push(`農民曆宜：${alm.yi.slice(0, 5).join('、')}${alm.ji.length ? `；忌：${alm.ji.slice(0, 4).join('、')}` : ''}。`);
    if (alm.chongShengXiao) {
      const gz = (alm.chong.match(/\((..)\)/) || [])[1];
      lines.push(`今天沖${gz ? `${gz}（屬${alm.chongShengXiao}）` : `屬${alm.chongShengXiao}`}，屬${alm.chongShengXiao}的人重要的事緩一緩。`);
    }
    lines.push(...hourLines.filter((l) => l.startsWith('避開')));
    lines.push(...attention.slice(0, 2));
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'bell', '今天要注意', '綜合八字、農民曆、天象與吉時'),
      h('ul', { class: 'reasons' }, lines.slice(0, 6).map((t) => h('li', { class: /避開|沖|逆行|忌|緩/.test(t) ? 'tone-bad' : 'tone-good', text: t }))),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '遇到困難？問一卦', onclick: () => ctx.go('oracle', { panel: 'jiehuo' }) })),
    );
  }

  function hoursCard(data) {
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'clock', '吉時表：什麼時間做什麼', '點一格看那個時段適合做的事'),
      hourTimeline(data.hours, { markNow: true }),
      h('ul', { class: 'reasons' }, data.hourLines.map((t) => h('li', { class: t.startsWith('好') ? 'tone-good' : 'tone-bad', text: t }))),
    );
  }

  function luckCard(data, W) {
    const { windfall, profile, person, today } = data;
    let game = load('lottoGame', 'lotto649');
    if (!W.GAMES[game]) game = 'lotto649';
    const num = h('b', { class: 'gold', style: { fontSize: '40px', lineHeight: '1' } });
    countUp(num, windfall.score);
    const ballsBox = h('div', { 'aria-live': 'polite' });
    const meta = h('p', { class: 'muted small' });
    const drawBalls = (random) => {
      const r = W.luckyNumbers(game, { seedKey: person ? person.id : 'guest', date: today, profile, random });
      fill(ballsBox, ballsRow(r));
      meta.textContent = `${r.game.rule}。${r.odds}。${random ? '（這組是隨機抽的）' : '（今日固定號碼）'}`;
    };
    const gameSel = h('select', { 'aria-label': '選擇彩券', onchange: (e) => { game = e.target.value; save('lottoGame', game); drawBalls(false); } }, Object.values(W.GAMES).map((g) => h('option', { value: g.id, text: g.name })));
    gameSel.value = game;
    drawBalls(false);
    return h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'coin', '偏財運與幸運號碼', `財神方位：${windfall.caiPosition}`),
      h('div', { class: 'score-hero' }, h('div', { class: 'center', style: { minWidth: '92px' } }, num, h('div', { class: `small ${LEVEL_CLASS[windfall.level] || ''}`, text: windfall.level })), h('p', { class: 'summary', text: windfall.advice })),
      windfall.parts.length ? h('details', { class: 'more' }, h('summary', { text: '偏財指數的依據' }), partsList(windfall.parts)) : null,
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '今日幸運號碼' }), gameSel),
      ballsBox,
      meta,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '再換一組', onclick: () => drawBalls(true) }), h('button', { type: 'button', class: 'btn ghost', text: '選號說明', onclick: () => ctx.go('oracle', { panel: 'lotto' }) })),
      h('p', { class: 'hint', text: '任何一組號碼中獎機率都一樣，幸運號碼只是好玩，不會提高中獎機率。未滿 18 歲不得購買彩券，請量力而為。' }),
    );
  }

  function luckyCard(data) {
    const { lucky } = data;
    const stats = [
      lucky.color ? { v: h('span', {}, h('span', { class: 'swatch', style: { background: lucky.color.css } }), lucky.color.name), l: '幸運色' } : null,
      lucky.numbers ? { v: lucky.numbers.join('、'), l: '幸運尾數' } : null,
      { v: lucky.xi, l: '喜神方位' },
      { v: lucky.cai, l: '財神方位' },
      { v: lucky.fu, l: '福神方位' },
    ].filter(Boolean);
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'gem', '今日幸運小物', lucky.element ? `依你的喜用五行「${lucky.element}」` : '填生日後依你的八字推算'),
      h('div', { class: 'stat-row' }, stats.map((s) => h('div', { class: 'stat' }, h('div', { class: 'sv' }, s.v), h('div', { class: 'sl', text: s.l })))),
      h('p', { class: 'hint', text: '幸運色與尾數看你的喜用五行（依日主強弱）；方位取自當天農民曆。' }),
      lucky.element ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '財位與開運擺設', onclick: () => ctx.go('destiny', { tool: 'fengshui' }) })) : null,
    );
  }

  function upcomingCard(data) {
    const items = data.items.slice(0, 5);
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'calendar', '近期重點', '未來 30 天：天象、流月與你的沖合'),
      items.length
        ? timelineList(items)
        : h('p', { class: 'muted', text: '最近沒有特別需要注意的天象或沖煞。' }),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '看全部提醒與擇日', onclick: () => ctx.go('fortune') })),
    );
  }

  ctx.onProfile(render);
  render();
  return { refresh: render };
}
