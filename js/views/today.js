// 「今日」：打開 App 第一眼看到的個人儀表板：今日綜合指數、今天要注意什麼、幾點適合做什麼（吉時表）、
// 偏財指數與今日幸運號碼、幸運色與方位、今天的瑪雅印記、近期重點。全部在手機上計算，不送出任何資料。
// 用到農曆與八字的模組比較大，畫面先顯示骨架，模組載入完再補上內容。

import { h, clear, fill } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { cardHead } from '../ui/icons.js';
import { reveal, ringTo, countUp, playWhenVisible } from '../ui/motion.js';
import { hourTimeline, ballsRow, timelineList, partsList } from '../ui/widgets.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { todayScript } from '../core/speech.js';
import { canSpeak, primeVoices, speak, stopSpeaking, isSpeaking } from '../ui/speak.js';
import { SIGNS, mainSunSign } from '../core/zodiac.js';
import { masterCard } from '../ui/master.js';

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
    import('../core/maya-kin.js'),
    import('../core/maya-texts.js'),
    import('../ui/maya-glyphs.js'),
    import('../core/master-texts.js'),
  ]);
}

export function mountToday(root, ctx) {
  let token = 0;

  async function render() {
    token += 1;
    const my = token;
    // 換人或資料更新會重畫：舊的朗讀停掉，免得唸的是上一個人的內容
    if (isSpeaking()) stopSpeaking();
    primeVoices();
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
    const [{ buildBazi }, T, W, D, CAL, NUM, MK, MT, MG, MS] = mods;
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
    const signIndex = mainSunSign(natal);
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
      birth,
      profile: W.luckyProfile({ bazi, birth, lifePathNumber: birth ? NUM.lifePath(birth).number : null }),
      items: T.upcoming({ from: today, days: 30, bazi, birth, signIndex }),
      signIndex,
    };
    data.hourLines = T.hourSummary(data.hours);
    data.attention = T.attentionSummary(data.items, today);
    // 朗讀稿要的資料（按下朗讀時才組，畫面上看到什麼就唸什麼）
    const dayKin = MK.kinOf(today, ctx.getSettings().mayaCount);
    data.speechInput = () => ({
      title: person ? heroTitle(person) : '今天',
      dateLine: dateLine(data),
      score: data.daily.score,
      level: data.daily.level,
      advice: data.daily.advice,
      attention: attentionLines(data),
      hours: data.hourLines.filter((l) => l.startsWith('好')),
      lucky: { color: data.lucky.color ? data.lucky.color.name : '', numbers: data.lucky.numbers ? data.lucky.numbers.join('、') : '', cai: data.lucky.cai },
      maya: dayKin ? { title: MK.kinInfo(dayKin).title, q: MT.TONE_TEXT[MK.toneOf(dayKin)].q } : null,
    });
    fill(root, ...reveal([
      person ? heroCard(data) : welcomeCard(data),
      // 老師怎麼看今天：有生日才有（八字流日、沖、忌神）；只有星座時分數的原因太少，講不出化解
      person && bazi ? masterOfDay(data, MS) : null,
      attentionCard(data, T),
      hoursCard(data),
      luckCard(data, W),
      luckyCard(data),
      mayaCard(data, MK, MT, MG),
      upcomingCard(data),
    ]));
  }

  function masterOfDay(data, MS) {
    const m = MS.dailyMaster(data.daily, { name: data.person.self ? '你' : data.person.name, lucky: data.lucky, hours: data.hours });
    return masterCard({
      title: '老師怎麼看今天',
      sub: '今天哪裡順、哪裡卡，卡的地方怎麼化解',
      badge: { text: m.badge, cls: data.daily.level === '大吉' || data.daily.level === '小吉' ? 'good' : data.daily.level === '宜守' ? 'danger' : 'alt' },
      verdict: m.verdict,
      why: m.why,
      remedies: m.remedies,
      boosts: m.boosts,
      combos: m.combos,
      onGo: (view, opts) => ctx.go(view, opts),
    });
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
      speakButton(data),
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

  // 朗讀：用手機內建語音唸今天的重點（指數、要注意的、好時辰、幸運色、今天的瑪雅印記）
  function speakButton(data) {
    if (!canSpeak()) return null;
    const btn = h('button', { type: 'button', class: 'btn small ghost', 'aria-pressed': 'false', text: '朗讀今天的重點' });
    const reset = () => {
      btn.textContent = '朗讀今天的重點';
      btn.setAttribute('aria-pressed', 'false');
    };
    btn.addEventListener('click', () => {
      if (isSpeaking()) return stopSpeaking();
      // 一定要在點擊當下直接呼叫（iOS 規定），不能先 await
      const r = speak(todayScript(data.speechInput()), { onEnd: reset });
      if (!r.ok) return ctx.toast(r.error);
      btn.textContent = '停止朗讀';
      btn.setAttribute('aria-pressed', 'true');
      return null;
    });
    return h('div', { class: 'actions' }, btn);
  }

  // 今天要注意的事：卡片和朗讀共用同一份
  function attentionLines(data) {
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
    return lines.slice(0, 6);
  }

  function attentionCard(data) {
    const lines = attentionLines(data);
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'bell', '今天要注意', '綜合八字、農民曆、天象與吉時'),
      h('ul', { class: 'reasons' }, lines.map((t) => h('li', { class: /避開|沖|逆行|忌|緩/.test(t) ? 'tone-bad' : 'tone-good', text: t }))),
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

  // 今天的瑪雅印記：今天的 KIN、今天問自己的問題、今天的圖騰落在你五大神諭的哪個位置、下次銀河生日
  // （算法跟著「排盤設定」的瑪雅曆算法：13 月亮曆或傳統馬雅曆）
  function mayaCard(data, MK, MT, MG) {
    const { today, person } = data;
    const count = ctx.getSettings().mayaCount;
    const dayKin = MK.kinOf(today, count);
    if (dayKin === null) return null;
    const day = MK.kinInfo(dayKin);
    const st = MT.SEAL_TEXT[day.seal.n];
    const mine = person && data.birth ? MK.mayaKin(data.birth, count) : null;
    let relation = null;
    if (mine) {
      const type = MK.dayRelation(day.kin, mine.kin);
      const ct = MT.COLOR_TEXT[mine.seal.color];
      const next = type === 'return' ? null : MK.nextKinDate(today, mine.kin, count);
      const when = next ? `${next.date.y === today.y ? '' : `${next.date.y}/`}${next.date.m}/${next.date.d}` : '';
      relation = h('div', { class: `kin-relation ${type}` },
        h('p', { text: type === 'color' ? `今天和你同屬${ct.name}家族（${ct.key}）：${MT.DAY_RELATION_TEXT.color}` : MT.DAY_RELATION_TEXT[type] }),
        h('p', { class: 'muted small', text: `你的主印記是 KIN ${mine.kin} ${mine.title}${next ? `；下次銀河生日 ${when}（還有 ${next.days} 天）` : ''}` }));
    }
    return h(
      'section',
      { class: 'card', id: 'today-maya' },
      cardHead(h, 'sparkle', '今天的瑪雅印記', `KIN ${day.kin}・${day.title}`),
      h('div', { class: 'kin-hero compact' },
        playWhenVisible(h('div', { class: 'kin-glyph' }, MG.mayaGlyph(day.seal.n, { tone: day.tone.n, animate: true, label: `今天的圖騰與調性：${day.title}（KIN ${day.kin}）` }))),
        h('div', { class: 'kin-meta' },
          h('div', { class: 'chips' }, st.keys.map((k) => h('span', { class: 'chip', text: k }))),
          h('p', {}, h('b', { text: '今天問自己：' }), h('span', { text: MT.TONE_TEXT[day.tone.n].q })))),
      h('p', { class: 'small', text: `今天的小行動：${st.tip}` }),
      relation || h('p', { class: 'hint', text: '填生日後，會看到今天的圖騰和你的主印記是什麼關係。' }),
      mine ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '看我的瑪雅曆', onclick: () => ctx.go('destiny', { tool: 'maya' }) })) : null,
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
