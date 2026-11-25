// 「塔羅」（在「占卜」分頁裡）：今日一張、問的主題、牌陣（下拉，標出各主題推薦）、全螢幕抽牌儀式或直接抽、
// 華麗牌面（點牌放大、手指拖曳 3D 傾斜）、凱爾特十字排成真正的十字、逆位三讀法、自訂牌組。
// 抽牌用裝置加密亂數；問題和二選一的選項名稱只留在畫面上，不儲存、不上傳。

import { h, clear, fill, segmented } from '../ui/dom.js';
import { drawSpread, shuffleDeck, fromPicks, dailyCard, SPREADS, TOPIC_SPREAD } from '../core/tarot.js';
import { readCard, readSpread, cardMark, TOPICS } from '../core/tarot-reading.js';
import { load, save } from '../ui/storage.js';
import { order, motionLevel, reducedMotion } from '../ui/motion.js';
import { tarotCard, openCardView } from '../ui/tarot-art.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';

const NOTE_KEEP = 60; // 今日一張的心得最多留幾天
const dateKey = () => {
  const t = zoneToday(DEFAULT_TZ);
  return `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;
};

export function mountTarot(root, ctx) {
  let spread = load('tarotSpread', 'three');
  if (!SPREADS.some((s) => s.id === spread)) spread = 'three';
  let topic = load('tarotTopic', 'general');
  if (!TOPICS.some((t) => t.id === topic)) topic = 'general';
  let ritualOn = load('tarotRitual', true) !== false;
  let images = new Map(); // 自訂牌組：牌 id → 圖（object URL）
  let lastResult = null;
  let shownDate = dateKey();

  const question = h('textarea', { rows: 2, maxlength: 200, placeholder: '想問的事（可不填，只留在畫面上，不會儲存或上傳）', 'aria-label': '想問的事' });
  const optA = h('input', { type: 'text', maxlength: 20, placeholder: '例如：留在現在的公司', 'aria-label': '選擇 A 是什麼' });
  const optB = h('input', { type: 'text', maxlength: 20, placeholder: '例如：換工作', 'aria-label': '選擇 B 是什麼' });
  const dailyBox = h('div', {});
  const controls = h('div', {});
  const resultBox = h('div', {});
  const deckBox = h('div', {});

  const faceOf = (c) => ({ major: c.major, index: c.index, suit: c.suit, rank: c.rank, element: c.element, mark: cardMark(c), name: c.card, image: images.get(c.id) || null });
  const useRitual = () => ritualOn && motionLevel() === 'full' && !reducedMotion();
  const optionName = (pos) => (pos === '選擇 A' && optA.value.trim() ? `選擇 A（${optA.value.trim()}）` : pos === '選擇 B' && optB.value.trim() ? `選擇 B（${optB.value.trim()}）` : pos);

  /** 一張牌放大時下面的解讀 */
  function zoomBody(c) {
    return [
      h('div', { class: 'tarot-name' }, h('span', { class: 'badge', text: c.orientation }), c.major ? h('span', { class: 'badge alt', text: '大牌' }) : null, h('span', { class: 'muted small', text: `${c.element}元素` })),
      h('p', { class: 'muted', text: c.keywords }),
      c.position ? h('p', {}, h('b', { text: `${optionName(c.position)}：` }), h('span', { text: c.frame })) : null,
      c.topicText ? h('p', { class: 'tarot-topic', text: c.topicText }) : null,
      revBlock(c),
      c.person ? h('p', { class: 'muted small', text: c.person }) : null,
    ];
  }
  function zoom(c) {
    openCardView({ face: faceOf(c), reversed: c.orientation === '逆位', title: `${c.card}（${c.orientation}）`, body: zoomBody(c) });
  }
  /** 逆位三種讀法：受阻、過度、轉向內在 */
  function revBlock(c) {
    if (!c.revWays || !c.revWays.length) return null;
    return h('details', { class: 'more rev-ways' }, h('summary', { text: '逆位的三種讀法' }),
      h('ul', { class: 'reasons' }, c.revWays.map((w) => h('li', { class: 'tone-info' }, h('b', { text: `${w.name}：` }), h('span', { text: w.text })))),
      h('p', { class: 'hint', text: '同一張逆位牌可以這三種方向讀，選最貼近你處境的那一種。' }));
  }
  const cardButton = (c, i, extra = '') => {
    const btn = h('button', { type: 'button', class: `tc-btn${extra}`, 'aria-label': `放大看${c.card}（${c.orientation}）`, onclick: () => zoom(c) }, tarotCard(faceOf(c), { reversed: c.orientation === '逆位' }));
    btn.style.setProperty('--i', String(i));
    return btn;
  };

  // ── 今日一張：同一個人同一天固定同一張
  function renderDaily() {
    shownDate = dateKey();
    const p = ctx.getActive();
    const key = `${shownDate}|${p ? p.id : ''}`;
    const c = readCard(dailyCard(shownDate, p ? p.id : ''), 'general');
    const notes = load('tarotDailyNotes', {}) || {};
    const note = h('input', { type: 'text', maxlength: 60, value: typeof notes[key] === 'string' ? notes[key] : '', placeholder: '今天的心得（可不填，只存在這支手機）', 'aria-label': '今日一張的心得' });
    fill(dailyBox, h('section', { class: 'card daily-tarot' },
      h('div', { class: 'daily-row' },
        cardButton(c, 0),
        h('div', {},
          h('h2', { text: `今日一張${p ? `・${p.name}` : ''}` }),
          h('div', { class: 'tarot-name' }, h('b', { text: c.card }), h('span', { class: 'badge', text: c.orientation })),
          h('p', { class: 'small', text: c.frame }))),
      h('div', { class: 'row-input' }, note, h('button', {
        type: 'button',
        class: 'btn small',
        text: '存心得',
        onclick: () => {
          const all = load('tarotDailyNotes', {}) || {};
          const v = note.value.trim();
          if (v) all[key] = v;
          else delete all[key];
          // 只留最近的幾十天
          const kept = Object.fromEntries(Object.entries(all).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, NOTE_KEEP));
          ctx.toast(save('tarotDailyNotes', kept) ? '心得已存在這支手機' : '手機儲存空間不足，心得沒有存成功');
        },
      })),
      h('p', { class: 'hint', text: '每天依日期和人固定配一張（不是隨機抽），當作今天的提醒；明天會換一張。點牌可以放大看。' })));
  }

  // ── 主題、牌陣、問題、抽牌
  function renderControls() {
    const rec = TOPIC_SPREAD[topic];
    const sel = h('select', {
      'aria-label': '牌陣',
      onchange: (e) => {
        spread = e.target.value;
        save('tarotSpread', spread);
        clear(resultBox);
        renderControls();
      },
    }, SPREADS.map((s) => h('option', { value: s.id, text: `${s.label}${s.id === rec ? '（推薦）' : ''}` })));
    sel.value = spread;
    const recSpread = SPREADS.find((s) => s.id === rec);
    fill(controls, h('section', { class: 'card' },
      segmented({
        name: 'tarot-topic',
        label: '問的主題',
        value: topic,
        options: TOPICS.map((t) => ({ value: t.id, label: t.label })),
        onChange: (next) => {
          topic = next;
          save('tarotTopic', topic);
          clear(resultBox);
          renderControls();
        },
      }),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '牌陣' }), sel),
      spread !== rec ? h('p', { class: 'small muted' }, `問${TOPICS.find((t) => t.id === topic).label}推薦用「${recSpread.label}」。`, h('button', { type: 'button', class: 'link', text: '改用推薦', onclick: () => { spread = rec; save('tarotSpread', spread); clear(resultBox); renderControls(); } })) : null,
      spread === 'choice' ? h('div', { class: 'row2' }, h('div', { class: 'field' }, h('span', { class: 'field-label', text: '選擇 A' }), optA), h('div', { class: 'field' }, h('span', { class: 'field-label', text: '選擇 B' }), optB)) : null,
      question,
      motionLevel() === 'full' && !reducedMotion()
        ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ritualOn, onchange: (e) => { ritualOn = e.target.checked; save('tarotRitual', ritualOn); } }), h('span', { text: '抽牌時進入儀式畫面（洗牌、攤牌、自己挑牌）' }))
        : null,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', text: '洗牌並抽牌', onclick: draw })),
      h('p', { class: 'hint', text: '使用手機的加密亂數洗整副牌：78 張每張機率相同、同一次不會重複，正逆位各半；儀式裡挑哪一張都一樣公平。抽到的牌會存進「我的」查詢紀錄（只在這支手機），問題不會存。' })));
  }

  async function draw() {
    const sp = SPREADS.find((s) => s.id === spread);
    const topicLabel = TOPICS.find((t) => t.id === topic).label;
    let r;
    if (useRitual()) {
      const deck = shuffleDeck();
      const { runRitual } = await import('../ui/tarot-ritual.js');
      const picks = await runRitual({
        title: `${sp.short}・${topicLabel}`,
        positions: sp.positions.map(optionName),
        reveal: (k) => {
          const c = readCard(fromPicks('single', deck, [k]).cards[0], topic);
          return { face: faceOf(c), reversed: c.orientation === '逆位' };
        },
      });
      if (!picks) return; // 關掉儀式＝不抽
      r = fromPicks(spread, deck, picks);
    } else {
      r = drawSpread(spread);
    }
    lastResult = { r, topic, q: question.value.trim() };
    renderResult();
    // 存進本機紀錄：只存牌與主題，不存問題（畫面上承諾問題不儲存）
    ctx.addHistory({ type: 'tarot', title: `${r.label}牌陣・${topicLabel}`, summary: r.cards.map((c) => `${c.position}：${c.card}（${c.orientation}）`).join('；') });
    resultBox.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function renderResult() {
    if (!lastResult) return;
    const { r, q } = lastResult;
    const cards = r.cards.map((c) => readCard(c, lastResult.topic));
    const sp = readSpread(cards, r.spread);
    const topicLabel = TOPICS.find((t) => t.id === lastResult.topic).label;
    const list = h('ol', { class: 'tarot-list' }, order(cards.map((c, i) => h(
      'li',
      { class: c.orientation === '逆位' ? 'rev' : '' },
      cardButton(c, i),
      h('div', { class: 'tarot-body' },
        h('span', { class: 'pos', text: r.spread === 'celtic' ? `${i + 1}．${c.position}` : optionName(c.position) }),
        h('div', { class: 'tarot-name' }, h('b', { text: c.card }), h('span', { class: 'badge', text: c.orientation }), c.major ? h('span', { class: 'badge alt', text: '大牌' }) : null),
        h('p', { class: 'muted small', text: c.keywords }),
        h('p', { text: c.frame }),
        c.topicText ? h('p', { class: 'tarot-topic', text: c.topicText }) : null,
        revBlock(c),
        c.person ? h('p', { class: 'muted small', text: c.person }) : null),
    ))));
    fill(resultBox, h(
      'section',
      { class: 'card' },
      h('h2', { text: `${r.label}牌陣・${topicLabel}` }),
      q ? h('p', { class: 'muted', text: `問題：${q}` }) : null,
      r.spread === 'celtic' ? celticLayout(cards) : null,
      list,
      cards.length >= 3
        ? [
          h('h3', { text: '整副牌怎麼看' }),
          h('p', { class: 'tarot-summary', text: sp.summary }),
          sp.insights.length ? h('ul', { class: 'reasons' }, sp.insights.map((x) => h('li', { class: 'tone-info' }, h('b', { text: `${x.title}：` }), h('span', { text: x.text })))) : null,
        ]
        : null,
      h('p', { class: 'hint', text: '同一張牌放在不同位置、問不同的事，意思會不一樣：牌位決定怎麼讀（例如好牌落在「阻力」，是提醒你別太樂觀），主題決定看哪個面向。點牌可以放大看。' }),
      h('div', { class: 'actions' }, h('button', {
        type: 'button',
        class: 'btn',
        text: '存成圖卡',
        onclick: () => ctx.share({
          title: `塔羅・${r.label}牌陣・${topicLabel}`,
          subtitle: q ? `問題：${q}` : '',
          lines: [...cards.map((c) => `${c.position}｜${c.card}（${c.orientation}）：${c.keywords}`), cards.length >= 3 ? sp.summary : ''].filter(Boolean),
        }, 'tarot.png'),
      })),
    ));
  }

  /** 凱爾特十字：中間的十字（第 2 張橫壓在第 1 張上）＋右邊一柱（由下往上 7～10） */
  function celticLayout(cards) {
    const SLOT = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'];
    return h('div', { class: 'celtic', role: 'group', 'aria-label': '凱爾特十字牌陣' }, cards.map((c, i) => {
      const btn = cardButton(c, i, ` celtic-card ${SLOT[i]}`);
      btn.setAttribute('aria-label', `第 ${i + 1} 張「${c.position}」：${c.card}（${c.orientation}），點一下放大`);
      btn.append(h('span', { class: 'celtic-no', 'aria-hidden': 'true', text: String(i + 1) }));
      return btn;
    }));
  }

  // ── 自訂牌組
  async function refreshImages() {
    try {
      const store = await import('../ui/deck-store.js');
      images = await store.loadDeck();
    } catch {
      images = new Map(); // 私密瀏覽等不能用 IndexedDB 時，照常用內建牌面
    }
    renderDeck();
    renderDaily();
    if (lastResult) renderResult();
  }
  function renderDeck(message = null) {
    const count = [...images.keys()].filter((k) => k !== 'back').length;
    const input = h('input', {
      type: 'file',
      accept: 'image/*',
      multiple: true,
      class: 'visually-hidden',
      'aria-hidden': 'true',
      tabindex: '-1',
      onchange: async (e) => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        const status = h('p', { class: 'small', 'aria-live': 'polite', text: '處理中…' });
        fill(deckBox, status);
        try {
          const store = await import('../ui/deck-store.js');
          const res = await store.importFiles(files, { onProgress: (i, n) => { status.textContent = `處理中 ${i}／${n}…（一張一張縮小再存，不會上傳）`; } });
          images = await store.loadDeck();
          const parts = [`已匯入 ${res.saved} 張`];
          if (res.unknown.length) parts.push(`${res.unknown.length} 個檔名對不到牌：${res.unknown.slice(0, 5).join('、')}${res.unknown.length > 5 ? '…' : ''}（請照下面的命名方式改名）`);
          if (res.failed.length) parts.push(`${res.failed.length} 張讀不進來：${res.failed.slice(0, 3).map((x) => `${x.name}（${x.reason}）`).join('、')}`);
          renderDeck(parts.join('；'));
          renderDaily();
          if (lastResult) renderResult();
        } catch (err) {
          renderDeck(err.message || '匯入失敗');
        }
      },
    });
    fill(deckBox,
      h('p', { text: count ? `目前用自訂牌組：已匯入 ${count}／78 張，缺的牌用內建牌面。` : '目前用內建牌面（金框、星芒與每張牌的圖騰都是本 App 自己畫的）。' }),
      message ? h('p', { class: /失敗|讀不進來|不能|拒絕|空間不足/.test(message) ? 'warn' : 'small', text: message }) : null,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn', text: '匯入牌圖', onclick: () => input.click() }),
        count ? h('button', {
          type: 'button',
          class: 'btn ghost',
          text: '移除自訂牌組',
          onclick: async () => {
            if (!window.confirm('匯入的牌圖會從這支手機刪除，改回內建牌面，確定？')) return;
            const store = await import('../ui/deck-store.js');
            await store.clearDeck();
            images = new Map();
            renderDeck('已移除，改回內建牌面');
            renderDaily();
            if (lastResult) renderResult();
          },
        }) : null,
        input),
      h('details', { class: 'more' }, h('summary', { text: '檔名怎麼取？' }),
        h('p', { class: 'small', text: '一次可以選很多張。App 看檔名認牌，中文或英文都可以：' }),
        h('ul', { class: 'plain small' },
          h('li', { text: '大牌：愚者.jpg、魔術師.jpg…世界.jpg，或 00.jpg～21.jpg、the-fool.jpg' }),
          h('li', { text: '小牌：權杖王牌.jpg、聖杯三.jpg、寶劍侍者.jpg、錢幣國王.jpg，或 cups-03.jpg、ace-of-wands.jpg、Pents14.jpg' }),
          h('li', { text: '牌背：back.jpg 或 牌背.jpg（選用）' })),
        h('p', { class: 'small', text: '對不到的檔名會列出來，不會亂配到別張牌。' })),
      h('p', { class: 'hint', text: '只匯入你有權使用的圖。圖片縮小後只存在這支手機，不會上傳，也不會放進備份檔；換手機要重新匯入。' }));
  }

  // 第二天再打開（App 一直開著）時換今日一張
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && dateKey() !== shownDate) renderDaily();
  });
  ctx.onProfile(() => {
    renderDaily();
    renderControls(); // 動畫強度改了，儀式開關要跟著顯示或隱藏
  });

  root.append(dailyBox, controls, resultBox, h('section', { class: 'card' }, h('details', { class: 'more first' }, h('summary', { text: '牌組：內建牌面或自訂（例如動漫風牌圖）' }), deckBox)));
  renderDaily();
  renderControls();
  renderDeck();
  refreshImages();
}
