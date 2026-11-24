// 「命理」：選人＋選工具（下拉），八字命盤、流年大運太歲、紫微命盤、瑪雅密碼、生命靈數、袁天罡稱骨。
// 各工具的函式庫用到才載入（紫微最大，約 51KB gzip）。結果可「存到紀錄」（只存在手機）或存成圖卡。

import { h, clear, segmented } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';

const TOOLS = [
  { id: 'bazi', label: '八字命盤' },
  { id: 'liunian', label: '流年・大運・太歲' },
  { id: 'ziwei', label: '紫微命盤' },
  { id: 'maya', label: '瑪雅密碼' },
  { id: 'numerology', label: '生命靈數' },
  { id: 'chenggu', label: '袁天罡稱骨' },
];
const WX_CLASS = { 木: 'wx-wood', 火: 'wx-fire', 土: 'wx-earth', 金: 'wx-metal', 水: 'wx-water' };
const MUTAGEN_CLASS = { 化祿: 'mg-lu', 化權: 'mg-quan', 化科: 'mg-ke', 化忌: 'mg-ji' };

export function mountDestiny(root, ctx) {
  let tool = load('destinyTool', 'bazi');
  if (!TOOLS.some((t) => t.id === tool)) tool = 'bazi';
  let personId = null;
  let compareId = null;
  let twin = false;
  let token = 0;

  const person = () => ctx.getPeople().find((p) => p.id === personId) || ctx.getActive();

  function render() {
    token += 1;
    const my = token;
    clear(root);
    const people = ctx.getPeople();
    if (!people.length) {
      root.append(h('div', { class: 'card tip' }, h('p', { text: '先到「我的」輸入生日，就能排八字、紫微、流年。' }), h('button', { type: 'button', class: 'btn small', text: '去填生日', onclick: () => ctx.go('me') })));
      return;
    }
    const p = person();
    personId = p.id;
    const settings = ctx.getSettings();

    const personSel = h('select', { 'aria-label': '選擇要看的人', onchange: (e) => { personId = e.target.value; render(); } }, people.map((x) => h('option', { value: x.id, text: x.self ? `${x.name}（我）` : x.name })));
    personSel.value = p.id;
    const toolSel = h('select', { 'aria-label': '選擇命理工具', onchange: (e) => { tool = e.target.value; save('destinyTool', tool); render(); } }, TOOLS.map((t) => h('option', { value: t.id, text: t.label })));
    toolSel.value = tool;

    root.append(
      h(
        'section',
        { class: 'card controls' },
        h('div', { class: 'row2' }, h('div', { class: 'field' }, h('span', { class: 'field-label', text: '看誰' }), personSel), h('div', { class: 'field' }, h('span', { class: 'field-label', text: '工具' }), toolSel)),
        h(
          'details',
          { class: 'more' },
          h('summary', { text: '排盤設定' }),
          h('p', { class: 'field-label', text: '23 點後出生（子時）的日柱' }),
          segmented({ name: 'sect', label: '子時換日', value: String(settings.sect), options: [{ value: '1', label: '23 點換日（預設）' }, { value: '2', label: '0 點換日' }], onChange: (v) => ctx.saveSettings({ sect: Number(v) }) }),
          h('p', { class: 'field-label', text: '時間校正' }),
          segmented({ name: 'solar', label: '時間校正', value: settings.solarTime, options: [{ value: 'standard', label: '標準時間（預設）' }, { value: 'true', label: '真太陽時' }], onChange: (v) => ctx.saveSettings({ solarTime: v }) }),
          h('p', { class: 'hint', text: '日光節約時間出生會自動減回標準時間。真太陽時依出生地經度與均時差調整（需要出生地）。0 點換日時，23 點後的時柱依隔天日干起子時（lunar-typescript 的作法）。' }),
        ),
      ),
    );
    const out = h('div', { class: 'destiny-out' }, h('p', { class: 'muted center', text: '計算中…' }));
    root.append(out);
    const input = ctx.inputOf(p);
    if (!input) {
      out.replaceChildren(warnCard('這個人的生日資料不完整，請到「我的」編輯後重新儲存。'));
      return;
    }
    const opts = { gender: p.gender || null, sect: settings.sect, solarTime: settings.solarTime, today: zoneToday(DEFAULT_TZ) };
    const draw = {
      bazi: () => drawBazi(p, input, opts),
      liunian: () => drawLiunian(p, input, opts),
      ziwei: () => drawZiwei(p, input, opts),
      maya: () => drawMaya(p, input),
      numerology: () => drawNumerology(p, input),
      chenggu: () => drawChenggu(p, input, opts),
    }[tool];
    draw()
      .then((nodes) => {
        if (my === token) out.replaceChildren(...[].concat(nodes));
      })
      .catch((err) => {
        if (my === token) out.replaceChildren(warnCard(`計算失敗：${err && err.message ? err.message : '請確認網路後重新開啟 App'}`));
      });
  }

  function warnCard(text, withEdit = false) {
    return h('section', { class: 'card' }, h('p', { class: 'warn', text }), withEdit ? h('button', { type: 'button', class: 'btn small', text: '到「我的」編輯資料', onclick: () => ctx.go('me') }) : null);
  }

  function actions(p, type, title, summary, poster) {
    return h(
      'div',
      { class: 'actions' },
      h('button', {
        type: 'button',
        class: 'btn',
        text: '存到紀錄',
        onclick: () => {
          ctx.addHistory({ type, personId: p.id, title: `${p.name}・${title}`, summary });
          ctx.toast('已存到「我的」的查詢紀錄（只在這支手機）');
        },
      }),
      poster ? h('button', { type: 'button', class: 'btn', text: '存成圖卡', onclick: () => ctx.share(poster, `${type}.png`) }) : null,
    );
  }

  // ── 八字命盤
  async function drawBazi(p, input, opts) {
    const { buildBazi, WUXING } = await import('../core/bazi.js');
    const b = buildBazi(input, opts);
    if (!b.ok) return warnCard(b.error, true);
    const cols = b.pillars;
    const cell = (fn) => cols.map((c) => h('td', {}, c ? fn(c) : '—'));
    const table = h(
      'table',
      { class: 'pillars' },
      h('thead', {}, h('tr', {}, h('th', { text: '' }), cols.map((c, i) => h('th', { text: ['年柱', '月柱', '日柱', '時柱'][i] })))),
      h(
        'tbody',
        {},
        h('tr', {}, h('th', { scope: 'row', text: '十神' }), cell((c) => c.shishen)),
        h('tr', { class: 'big' }, h('th', { scope: 'row', text: '天干' }), cell((c) => h('span', { class: WX_CLASS[c.ganWx], text: c.gan }))),
        h('tr', { class: 'big' }, h('th', { scope: 'row', text: '地支' }), cell((c) => h('span', { class: WX_CLASS[c.zhiWx], text: c.zhi }))),
        h('tr', { class: 'small' }, h('th', { scope: 'row', text: '藏干' }), cell((c) => c.hidden.map((x) => h('div', { text: `${x.gan}${x.shishen}` })))),
        h('tr', { class: 'small' }, h('th', { scope: 'row', text: '納音' }), cell((c) => c.nayin)),
      ),
    );
    const total = Object.values(b.wuxing.counts).reduce((a, c) => a + c, 0);
    const wxBars = WUXING.map((w) => h(
      'div',
      { class: `wx-row ${WX_CLASS[w]}` },
      h('span', { class: 'wx-name', text: w }),
      h('span', { class: 'day-track' }, h('span', { class: 'day-fill', style: { width: `${(b.wuxing.counts[w] / total) * 100}%` } })),
      h('b', { text: `${b.wuxing.counts[w]}` }),
      h('span', { class: 'muted small', text: `含藏干 ${b.wuxing.withHidden[w]}` }),
    ));
    const yunBlock = b.yun
      ? h(
        'details',
        { class: 'more', open: true },
        h('summary', { text: `大運（${b.yun.forward ? '順行' : '逆行'}，${b.yun.approx ? '約' : ''}${b.yun.start.years} 年 ${b.yun.start.months} 個月後起運）` }),
        h('ol', { class: 'dayun' }, b.yun.list.map((d) => h('li', { class: d.current ? 'current' : '' }, h('b', { text: d.ganzhi }), h('span', { text: ` ${d.startAge}–${d.endAge} 歲（${d.startYear}–${d.endYear}）` }), h('span', { class: 'badge', text: d.shishen }), d.current ? h('span', { class: 'badge alt', text: '目前' }) : null))),
        b.yun.approx ? h('p', { class: 'hint', text: '沒有出生時間，起運歲數可能差幾個月。' }) : null,
      )
      : h('p', { class: 'hint', text: '在「我的」幫這個人選性別，就能排大運。' });
    const gz = cols.filter(Boolean).map((c) => c.gan + c.zhi).join(' ');
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的八字命盤` }),
      b.clockText ? h('p', { class: 'muted small', text: `排盤時間：${b.clockText}${opts.solarTime === 'true' ? '（真太陽時）' : '（標準時間）'}` }) : null,
      [...b.uncertain, ...b.notes].map((t) => h('p', { class: 'hint', text: t })),
      h('div', { class: 'table-wrap' }, table),
      h('h3', { text: `日主：${b.dayMaster.gan}${b.dayMaster.wx}（${b.dayMaster.yinYang}）` }),
      h('p', { text: b.dayMaster.text }),
      h('h3', { text: '五行（八字字面）' }),
      wxBars,
      h('p', { text: b.wuxing.missing.length ? `字面上缺：${b.wuxing.missing.join('、')}` : '五行俱全' }),
      h('p', { class: 'hint', text: '五行數量只看字面，不等於喜用神；喜忌要看整體格局，這裡不做判斷。' }),
      yunBlock,
      actions(p, 'bazi', '八字命盤', `${gz}；日主${b.dayMaster.gan}${b.dayMaster.wx}`, { title: `${p.name}的八字`, subtitle: b.clockText || '未填時間', lines: [gz, `日主 ${b.dayMaster.gan}${b.dayMaster.wx}`, b.wuxing.missing.length ? `缺 ${b.wuxing.missing.join('、')}` : '五行俱全'] }),
    );
  }

  // ── 流年・大運・太歲
  async function drawLiunian(p, input, opts) {
    const { buildBazi, liunian, taiSuiList } = await import('../core/bazi.js');
    const b = buildBazi(input, opts);
    if (!b.ok) return warnCard(b.error, true);
    const y0 = opts.today.y;
    const years = liunian(b, [y0, y0 + 1, y0 + 2, y0 + 3, y0 + 4]);
    const current = b.yun ? b.yun.list.find((d) => d.current) : null;
    const yearCard = h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的流年` }),
      current ? h('p', {}, h('b', { text: `目前大運：${current.ganzhi}（${current.shishen}）` }), h('span', { class: 'muted', text: ` ${current.startYear}–${current.endYear}` })) : h('p', { class: 'hint', text: b.yun ? '' : '在「我的」幫這個人選性別，就能顯示大運。' }),
      h(
        'ol',
        { class: 'liunian' },
        years.map((ln) => h(
          'li',
          {},
          h('div', { class: 'ln-head' }, h('b', { text: `${ln.year} ${ln.ganzhi}（${ln.animal}）年` }), h('span', { class: 'badge', text: ln.shishen }), ln.taisui.map((t) => h('span', { class: 'badge danger', text: t }))),
          h('p', { text: ln.shishenText }),
          ln.relations.length ? h('ul', { class: 'plain small' }, ln.relations.map((r) => h('li', { text: r.text }))) : null,
          ln.dayun ? h('p', { class: 'muted small', text: `所在大運：${ln.dayun.ganzhi}` }) : null,
        )),
      ),
      h('p', { class: 'hint', text: '流年以立春為界（每年約 2/4 起算）。十神看日主與流年天干的關係，地支看與四柱的沖合刑害破；皆為傳統說法，僅供參考。' }),
      actions(p, 'liunian', `${y0} 流年`, `${years[0].ganzhi}年：${years[0].shishen}${years[0].taisui.length ? `、${years[0].taisui.join('、')}` : ''}`),
    );
    const mine = b.zodiac.name;
    const taiSuiCard = h(
      'section',
      { class: 'card' },
      h('h2', { text: '犯太歲' }),
      [y0, y0 + 1].map((y) => {
        const list = taiSuiList(y);
        return h(
          'div',
          { class: 'taisui' },
          h('h3', { text: `${y} 年（${years[y - y0].ganzhi}）` }),
          h('ul', { class: 'plain' }, list.map((x) => h('li', { class: x.animal === mine ? 'mine' : '' }, h('b', { text: `屬${x.animal}` }), h('span', { text: `：${x.types.join('、')}` }), x.animal === mine ? h('span', { class: 'badge danger', text: `${p.self ? '你' : p.name}` }) : null))),
        );
      }),
      h('p', { class: 'hint', text: `${p.name}的生肖：${mine}（以農曆正月初一為界）。犯太歲為民俗說法，可依習俗安太歲祈福，不必過度擔心。` }),
      h('p', { class: 'hint', text: '星座的今年運勢在「運勢」分頁選「今年」。' }),
    );
    return [yearCard, taiSuiCard];
  }

  // ── 紫微命盤
  async function drawZiwei(p, input, opts) {
    const { buildZiwei, STAR_TEXT } = await import('../core/ziwei.js');
    const z = buildZiwei(input, { gender: p.gender, solarTime: opts.solarTime, at: opts.today });
    if (!z.ok) return warnCard(z.error, true);
    const detail = h('div', { class: 'palace-detail' }, h('p', { class: 'hint', text: '點命盤上任一宮看詳細星曜。' }));
    const hs = z.horoscope;
    const cells = z.palaces.map((pal) => {
      const cls = ['palace'];
      if (pal.name === '命宮') cls.push('soul');
      if (hs && pal.index === hs.decadalIndex) cls.push('decadal');
      if (hs && pal.index === hs.yearlyIndex) cls.push('yearly');
      const el = h(
        'button',
        {
          type: 'button',
          class: cls.join(' '),
          style: { gridRow: String(pal.grid[0] + 1), gridColumn: String(pal.grid[1] + 1) },
          'aria-label': `${pal.name}，${pal.major.map((s) => s.name).join('、') || '無主星'}`,
          onclick: () => showPalace(pal),
        },
        h('div', { class: 'pal-name' }, h('b', { text: pal.name }), pal.isBody ? h('span', { class: 'tag', text: '身' }) : null),
        h('div', { class: 'pal-stars' }, pal.major.length ? pal.major.map((s) => h('div', { class: 'major' }, h('span', { text: `${s.name}${s.brightness}` }), s.mutagen ? h('span', { class: `mg ${MUTAGEN_CLASS[s.mutagen] || ''}`, text: s.mutagen.slice(1) }) : null)) : h('div', { class: 'muted', text: '（空宮）' })),
        h('div', { class: 'pal-minor', text: pal.minor.map((s) => s.name + (s.mutagen ? s.mutagen.slice(1) : '')).join(' ') }),
        h('div', { class: 'pal-foot' }, h('span', { text: `${pal.stem}${pal.branch}` }), h('span', { text: `${pal.decadal[0]}–${pal.decadal[1]}` })),
      );
      return el;
    });
    function showPalace(pal) {
      detail.replaceChildren(
        h('h3', { text: `${pal.name}（${pal.stem}${pal.branch}）${pal.isBody ? '・身宮' : ''}` }),
        h('p', { class: 'muted small', text: `大限 ${pal.decadal[0]}–${pal.decadal[1]} 歲` }),
        pal.major.length ? h('ul', { class: 'plain' }, pal.major.map((s) => h('li', {}, h('b', { text: `${s.name}${s.brightness ? `（${s.brightness}）` : ''}${s.mutagen ? ` ${s.mutagen}` : ''}` }), h('span', { text: `：${STAR_TEXT[s.name] || ''}` })))) : h('p', { text: '空宮：借對宮主星來看。' }),
        pal.minor.length ? h('p', { text: `輔星：${pal.minor.map((s) => s.name + (s.mutagen ? `（${s.mutagen}）` : '')).join('、')}` }) : null,
        pal.adjective.length ? h('p', { class: 'muted small', text: `雜曜：${pal.adjective.join('、')}` }) : null,
      );
      detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    const center = h(
      'div',
      { class: 'palace-center' },
      h('b', { text: p.name }),
      h('div', { text: `${z.gender}・${z.fiveElementsClass}` }),
      h('div', { text: `農曆 ${z.lunarDate}` }),
      h('div', { text: z.time }),
      h('div', { text: `命主 ${z.soul}・身主 ${z.body}` }),
      hs ? h('div', { class: 'muted', text: `${opts.today.y} 流年 ${hs.yearlyStemBranch}` }) : null,
    );
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的紫微命盤` }),
      z.notes.map((t) => h('p', { class: 'hint', text: t })),
      h('div', { class: 'ziwei-grid' }, cells, center),
      h('div', { class: 'legend small' }, h('span', { class: 'mg mg-lu', text: '祿' }), ' 化祿 ', h('span', { class: 'mg mg-quan', text: '權' }), ' 化權 ', h('span', { class: 'mg mg-ke', text: '科' }), ' 化科 ', h('span', { class: 'mg mg-ji', text: '忌' }), ' 化忌・', h('span', { class: 'legend-box decadal' }), ' 目前大限・', h('span', { class: 'legend-box yearly' }), ' 今年流年'),
      hs ? h('p', { class: 'small', text: `今年流年四化：${hs.yearlyMutagen.map((s, i) => `${s}化${'祿權科忌'[i]}`).join('、')}` }) : null,
      detail,
      h('p', { class: 'hint', text: '排盤由 iztro 計算；星曜簡介為本 App 撰寫的一般性描述，僅供參考。' }),
      actions(p, 'ziwei', '紫微命盤', `命宮${z.soulBranch}・${z.fiveElementsClass}・命主${z.soul}`),
    );
  }

  // ── 瑪雅密碼
  async function drawMaya(p, input) {
    const { computeMaya, compareMaya } = await import('../core/maya.js');
    const twinTime = twin && input.time ? input.time : null;
    const r = computeMaya(input.date, twinTime);
    const others = ctx.getPeople().filter((x) => x.id !== p.id);
    const twinBox = h('input', { type: 'checkbox', id: 'maya-twin', checked: twin && !!input.time, disabled: !input.time, onchange: (e) => { twin = e.target.checked; render(); } });
    let compareBlock = null;
    if (others.length) {
      const sel = h('select', { 'aria-label': '和誰合盤', onchange: (e) => { compareId = e.target.value || null; render(); } }, h('option', { value: '', text: '和誰合盤？' }), others.map((x) => h('option', { value: x.id, text: x.name })));
      sel.value = compareId && others.some((x) => x.id === compareId) ? compareId : '';
      const other = others.find((x) => x.id === sel.value);
      let table = null;
      if (other) {
        const oi = ctx.inputOf(other);
        if (oi) {
          const rows = compareMaya(r, computeMaya(oi.date));
          table = h('table', { class: 'compare' }, h('thead', {}, h('tr', {}, h('th', { text: '' }), h('th', { text: p.name }), h('th', { text: other.name }))), h('tbody', {}, rows.map((x) => h('tr', { class: x.same ? 'same' : '' }, h('th', { scope: 'row', text: x.label }), h('td', { text: x.a ?? '—' }), h('td', { text: x.b ?? '—' })))));
        }
      }
      compareBlock = h('div', { class: 'field' }, h('span', { class: 'field-label', text: '合盤' }), sel, table ? h('div', { class: 'table-wrap' }, table, h('p', { class: 'hint', text: '底色標示兩人相同的數字。' })) : null);
    }
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的瑪雅密碼` }),
      h('div', { class: 'maya-grid' }, r.items.map((it) => h('div', { class: `maya-cell${it.key === 'C' ? ' wide' : ''}` }, h('div', { class: 'muted small', text: it.label }), h('div', { class: 'maya-value', text: it.value === null ? '—' : String(it.value) }), h('div', { text: it.keyword ? `${it.value % 10}｜${it.keyword}` : '不適用' })))),
      r.exception ? h('p', { class: 'hint', text: '1910–1921、2010–2021 年出生：依規則 A、B 不適用，C 為 10。' }) : null,
      h('label', { class: 'check', for: 'maya-twin' }, twinBox, h('span', { text: input.time ? '雙胞胎分流（加上出生的時＋分）' : '雙胞胎分流需要出生時間' })),
      compareBlock,
      h('p', { class: 'hint', text: '計算規則依你提供的 V1 計算器重寫（規則原始出處沒驗到）；數字的關鍵字依個位數對照，文字為本 App 撰寫，可能與其他老師的版本不同。' }),
      actions(p, 'maya', '瑪雅密碼', r.items.map((it) => `${it.key}=${it.value ?? '—'}`).join(' '), { title: `${p.name}的瑪雅密碼`, lines: r.items.map((it) => `${it.label}：${it.value ?? '—'}${it.keyword ? `（${it.keyword}）` : ''}`) }),
    );
  }

  // ── 生命靈數
  async function drawNumerology(p, input) {
    const { lifePath, grid } = await import('../core/numerology.js');
    const lp = lifePath(input.date);
    const g = grid(input.date);
    const LAYOUT = [3, 6, 9, 2, 5, 8, 1, 4, 7];
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的生命靈數` }),
      h('div', { class: 'score-hero' }, h('div', { class: 'score-ring lv-mid' }, h('b', { text: lp.label }), h('small', { text: '主命數' })), h('div', {}, h('h3', { text: lp.title }), h('p', { text: lp.text }))),
      h('h3', { text: '九宮格' }),
      h('div', { class: 'nine-grid' }, LAYOUT.map((n) => h('div', { class: `nine-cell${g.counts[n] ? ' on' : ''}` }, h('b', { text: String(n) }), g.counts[n] > 1 ? h('small', { text: `×${g.counts[n]}` }) : null))),
      h('p', { text: g.lines.length ? `連線：${g.lines.map((l) => `${l.nums.join('-')} ${l.name}`).join('、')}` : '沒有完整連線' }),
      g.missing.length ? h('p', { class: 'muted', text: `空缺的數字：${g.missing.join('、')}` }) : null,
      h('p', { class: 'hint', text: '以西元生日計算；連線名稱為台灣常見說法，各派略有不同。解說為本 App 撰寫，僅供參考。' }),
      actions(p, 'numerology', '生命靈數', `${lp.label} ${lp.title}`, { title: `${p.name}的生命靈數`, big: lp.label, bigLabel: lp.title, lines: [lp.text] }),
    );
  }

  // ── 袁天罡稱骨
  async function drawChenggu(p, input, opts) {
    if (!input.time) return warnCard('稱骨需要出生時間（時辰）。請到「我的」補上時間。', true);
    const [{ buildBazi, baziClock }, { solarToLunar }, { chengGu }] = await Promise.all([import('../core/bazi.js'), import('../core/calendar.js'), import('../core/chenggu.js')]);
    const clk = baziClock(input, { solarTime: opts.solarTime });
    if (!clk.ok) return warnCard(clk.error, true);
    const b = buildBazi(input, opts);
    const lunar = solarToLunar(clk.clock);
    const yearGz = b.pillars[0].gan + b.pillars[0].zhi;
    const r = chengGu({ yearGanZhi: yearGz, lunarMonth: lunar.month, lunarDay: lunar.day, hour: clk.clock.h });
    if (!r.ok) return warnCard(r.error);
    const w = (q) => `${q} 錢`;
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的稱骨` }),
      h('table', { class: 'compare' }, h('tbody', {},
        h('tr', {}, h('th', { scope: 'row', text: `年（${yearGz}）` }), h('td', { text: w(r.parts.year) })),
        h('tr', {}, h('th', { scope: 'row', text: `月（農曆${lunar.monthName}）` }), h('td', { text: w(r.parts.month) })),
        h('tr', {}, h('th', { scope: 'row', text: `日（${lunar.dayName}）` }), h('td', { text: w(r.parts.day) })),
        h('tr', {}, h('th', { scope: 'row', text: `時（${r.shichen}時）` }), h('td', { text: w(r.parts.hour) })),
        h('tr', { class: 'same' }, h('th', { scope: 'row', text: '合計' }), h('td', {}, h('b', { text: r.text }))))),
      h('blockquote', { class: 'poem', text: r.poem }),
      h('p', { class: 'hint', text: '民俗娛樂，不代表命運。年份以立春為界、閏月以本月計、23 點後日期以當天計（各家規則不同，結果可能和其他網站不一樣）。' }),
      actions(p, 'chenggu', '稱骨', `${r.text}：${r.poem}`, { title: `${p.name}的稱骨`, big: r.text, lines: [r.poem] }),
    );
  }

  ctx.onProfile(render);
  render();
}
