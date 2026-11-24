// 樂透選號（在「占卜」分頁裡）：未來 7 天偏財走勢、三種彩券的今日幸運號碼與隨機一組、選號依據、真實中獎機率。
// 號碼只在手機上產生，不會送出；中獎機率不會因為「幸運號碼」改變，畫面上一定要講清楚。

import { h, clear, scoreClass, fill } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { cardHead } from '../ui/icons.js';
import { order, reveal } from '../ui/motion.js';
import { ballsRow, partsList } from '../ui/widgets.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { mainSunSign } from '../core/zodiac.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function mountLotto(root, ctx) {
  let token = 0;

  async function render() {
    token += 1;
    const my = token;
    clear(root);
    root.append(h('section', { class: 'card' }, h('div', { class: 'skeleton', style: { height: '90px' } })));
    let mods;
    try {
      mods = await Promise.all([import('../core/bazi.js'), import('../core/windfall.js'), import('../core/numerology.js')]);
    } catch {
      if (my === token) fill(root, h('section', { class: 'card' }, h('p', { class: 'warn', text: '選號元件載入失敗，請確認網路後重新開啟 App。' })));
      return;
    }
    if (my !== token) return;
    const [{ buildBazi }, W, NUM] = mods;
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
    const profile = W.luckyProfile({ bazi, birth, lifePathNumber: birth ? NUM.lifePath(birth).number : null });
    const outlook = W.windfallOutlook(today, 7, { bazi, signIndex, birth });
    fill(root, ...reveal([outlookCard(outlook), pickCard(W, person, today, profile), oddsCard(W)]));
  }

  function outlookCard({ list, best }) {
    const rows = list.map((d) => {
      const wd = WEEKDAYS[new Date(Date.UTC(d.date.y, d.date.m - 1, d.date.d)).getUTCDay()];
      return h(
        'li',
        { class: scoreClass(d.score) },
        h('span', { class: 'day-label', text: `${d.date.m}/${d.date.d}（${wd}）` }),
        h('span', { class: 'day-track' }, h('span', { class: 'day-fill', style: { width: `${d.score}%` } })),
        h('b', { text: String(d.score) }),
      );
    });
    order(rows);
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'coin', '偏財走勢・未來 7 天', `最好的一天：${best.date.m}/${best.date.d}（${best.level}）`),
      h('ol', { class: 'days' }, rows),
      h('p', { class: 'summary', text: best.advice }),
      best.parts.length ? h('details', { class: 'more' }, h('summary', { text: `${best.date.m}/${best.date.d} 的依據` }), partsList(best.parts)) : h('p', { class: 'hint', text: '填上生日後會加入八字、星座與生命靈數的看法。' }),
      h('p', { class: 'hint', text: '偏財＝薪水以外的錢（獎金、中獎、投資、副業）。指數是命理推算，不是投資建議。' }),
    );
  }

  function pickCard(W, person, today, profile) {
    let game = load('lottoGame', 'lotto649');
    if (!W.GAMES[game]) game = 'lotto649';
    const ballsBox = h('div', { 'aria-live': 'polite' });
    const reasons = h('ul', { class: 'reasons' });
    const meta = h('p', { class: 'muted small' });
    let last = null;
    const draw = (random) => {
      const r = W.luckyNumbers(game, { seedKey: person ? person.id : 'guest', date: today, profile, random });
      last = r;
      fill(ballsBox, ballsRow(r));
      meta.textContent = `${r.game.rule}。${random ? '這組是用手機加密亂數另外抽的。' : '這是你今天固定的幸運號碼，重新整理也不會變。'}`;
      fill(reasons, ...(r.reasons.length ? r.reasons : ['目前沒有生日資料，號碼沒有加權。']).map((t) => h('li', { class: 'tone-info', text: t })));
    };
    const sel = h('select', { 'aria-label': '選擇彩券', onchange: (e) => { game = e.target.value; save('lottoGame', game); draw(false); } }, Object.values(W.GAMES).map((g) => h('option', { value: g.id, text: g.name })));
    sel.value = game;
    draw(false);
    return h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'balls', '幸運號碼', person ? `${person.name}的今日號碼` : '填生日後會依你的命盤加權'),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '彩券' }), sel),
      ballsBox,
      meta,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', text: '隨機抽一組', onclick: () => draw(true) }),
        h('button', { type: 'button', class: 'btn', text: '今日號碼', onclick: () => draw(false) }),
        h('button', {
          type: 'button',
          class: 'btn ghost',
          text: '存到紀錄',
          onclick: () => {
            ctx.addHistory({ type: 'lottery', title: `${last.game.name}幸運號碼`, summary: `${last.main.join(' ')}${last.second ? ` ＋ ${last.second}` : ''}` });
            ctx.toast('已存到「我的」的查詢紀錄（只在這支手機）');
          },
        })),
      h('h3', { text: '號碼怎麼選的' }),
      reasons,
      h('p', { class: 'hint', text: '依你的幸運五行（河圖數：水 1、6，火 2、7，木 3、8，金 4、9，土 5、0）、生日與生命靈數，提高那些號碼被抽到的權重，再隨機抽出。' }),
    );
  }

  function oddsCard(W) {
    return h(
      'section',
      { class: 'card' },
      cardHead(h, 'shield', '真實中獎機率', '先知道機率，再決定要不要買'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'compare' },
        h('thead', {}, h('tr', {}, h('th', { text: '彩券' }), h('th', { text: '玩法' }), h('th', { text: '頭獎機率' }))),
        h('tbody', {}, Object.values(W.GAMES).map((g) => h('tr', {}, h('th', { scope: 'row', text: g.name }), h('td', { style: { whiteSpace: 'normal' }, text: g.rule }), h('td', { text: `1/${g.odds.toLocaleString('en-US')}` })))))),
      h('p', { class: 'warn', text: '任何一組號碼中獎的機率都一樣，幸運號碼只是好玩，不會提高中獎機率。' }),
      h('p', { class: 'hint', text: '未滿 18 歲不得購買彩券。請量力而為，把買彩券當娛樂，不要當投資。' }),
    );
  }

  ctx.onProfile(render);
  return { refresh: render };
}
