// 「命盤」：選人＋選工具（下拉）：綜合解讀（多系統一起看）、工作與未來方向、開運佈置、家人關係、八字命盤、流年大運太歲、
// 紫微命盤、姓名分析、血型、瑪雅密碼、生命靈數、袁天罡稱骨。各工具的函式庫用到才載入（紫微約 51KB、康熙筆畫約 85KB gzip）。
// 結果可「存到紀錄」（只存在手機）或存成圖卡。多胞胎依「我的」裡填的出生順序套用紫微借宮。

import { h, clear, segmented, fill } from '../ui/dom.js';
import { load, save } from '../ui/storage.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { cardHead } from '../ui/icons.js';
import { reveal, order, ringTo, playWhenVisible } from '../ui/motion.js';
import { loadProfile } from './profile.js';
import { wuxingWheel, loader } from '../ui/charts.js';

const TOOLS = [
  { id: 'reading', label: '綜合解讀（多系統一起看）' },
  { id: 'career', label: '工作與未來方向' },
  { id: 'fengshui', label: '開運佈置（財庫、財位、擺設）' },
  { id: 'family', label: '家人關係（誰幫誰、怎麼相處）' },
  { id: 'bazi', label: '八字命盤' },
  { id: 'liunian', label: '流年・大運・太歲' },
  { id: 'ziwei', label: '紫微命盤' },
  { id: 'name', label: '姓名分析' },
  { id: 'blood', label: '血型' },
  { id: 'maya', label: '瑪雅密碼' },
  { id: 'numerology', label: '生命靈數' },
  { id: 'chenggu', label: '袁天罡稱骨' },
];
// 紫微某一宮要看星曜的哪一段白話
const PALACE_FIELD = { 命宮: 'ming', 官祿: 'career', 夫妻: 'love', 財帛: 'wealth' };
const WX_CLASS = { 木: 'wx-wood', 火: 'wx-fire', 土: 'wx-earth', 金: 'wx-metal', 水: 'wx-water' };
const MUTAGEN_CLASS = { 化祿: 'mg-lu', 化權: 'mg-quan', 化科: 'mg-ke', 化忌: 'mg-ji' };
// 干支喜忌的顏色：兩個都忌＝紅、有喜而沒有忌＝綠、其他＝中性
const toneCls = (t) => (!t ? 'tone-info' : t.gan === '忌' && t.zhi === '忌' ? 'tone-bad' : (t.gan === '喜' || t.zhi === '喜') && t.gan !== '忌' && t.zhi !== '忌' ? 'tone-good' : 'tone-info');

export function mountDestiny(root, ctx) {
  let tool = load('destinyTool', 'reading');
  if (!TOOLS.some((t) => t.id === tool)) tool = 'reading';
  let personId = null;
  let compareId = null;
  // 瑪雅曆的雙胞胎分流：填了出生順序（多胞胎）就預設打開，手動切換的結果按人記住。
  // 解讀和瑪雅工具共用同一個判斷，避免兩邊結果不一致（之前解讀從來不加時分，雙胞胎的瑪雅一模一樣）。
  const twinOverride = new Map();
  const mayaTwinTime = (p, input) => (input.time && (twinOverride.has(p.id) ? twinOverride.get(p.id) : !!p.birthOrder) ? input.time : null);
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
          h('p', { class: 'field-label', text: '多胞胎的紫微借宮看法（在「我的」填出生順序才會用到）' }),
          segmented({ name: 'twin', label: '借宮看法', value: settings.twinMethod, options: [{ value: 'sibling', label: '弟妹借兄弟宮' }, { value: 'travel', label: '老二借遷移宮' }], onChange: (v) => ctx.saveSettings({ twinMethod: v }) }),
        ),
      ),
    );
    const out = h('div', { class: 'destiny-out' }, h('div', { class: 'loader' }, loader('排盤中…'), h('span', { text: '排盤中…' })));
    root.append(out);
    const input = ctx.inputOf(p);
    if (!input) {
      fill(out, warnCard('這個人的生日資料不完整，請到「我的」編輯後重新儲存。'));
      return;
    }
    const opts = { gender: p.gender || null, sect: settings.sect, solarTime: settings.solarTime, today: zoneToday(DEFAULT_TZ) };
    // 新工具放在各自的檔案，用到才載入；共用存紀錄按鈕與多胞胎瑪雅設定
    const kit = { ctx, actions, mayaTime: mayaTwinTime(p, input) };
    const draw = {
      reading: () => drawReading(p, input, opts),
      career: () => import('./tool-career.js').then((m) => m.drawCareer(p, input, opts, kit)),
      fengshui: () => import('./tool-fengshui.js').then((m) => m.drawFengshui(p, input, opts, kit)),
      family: () => import('./tool-family.js').then((m) => m.drawFamily(p, input, opts, kit)),
      blood: () => import('./tool-blood.js').then((m) => m.drawBlood(p, kit)),
      name: () => drawName(p, input, opts),
      bazi: () => drawBazi(p, input, opts),
      liunian: () => drawLiunian(p, input, opts),
      ziwei: () => drawZiwei(p, input, opts),
      maya: () => drawMaya(p, input),
      numerology: () => drawNumerology(p, input),
      chenggu: () => drawChenggu(p, input, opts),
    }[tool];
    draw()
      .then((nodes) => {
        if (my === token) fill(out, ...reveal([].concat(nodes)));
      })
      .catch((err) => {
        if (my === token) fill(out, warnCard(`計算失敗：${err && err.message ? err.message : '請確認網路後重新開啟 App'}`));
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
    const [{ buildBazi, WUXING, yongShen, ganzhiTone, shensha }, { dominantShishen }, { DAYMASTER, SHISHEN_GROUPS }] = await Promise.all([import('../core/bazi.js'), import('../core/reading.js'), import('../core/reading-texts.js')]);
    const b = buildBazi(input, opts);
    if (!b.ok) return warnCard(b.error, true);
    const dom = dominantShishen(b);
    const ys = yongShen(b);
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
        h('tr', { class: 'small' }, h('th', { scope: 'row', text: '十二長生' }), cols.map((c, i) => h('td', {}, c ? b.extra.changSheng[i] : '—'))),
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
        h('ol', { class: 'dayun' }, b.yun.list.map((d) => h('li', { class: d.current ? 'current' : '' }, h('b', { text: d.ganzhi }), h('span', { text: ` ${d.startAge}–${d.endAge} 歲（虛歲，${d.startYear}–${d.endYear}）` }), h('span', { class: 'badge', text: d.shishen }), (() => { const t = ganzhiTone(b, d.ganzhi); return t ? h('span', { class: `badge ${t.gan === '忌' && t.zhi === '忌' ? 'danger' : 'alt'}`, text: `干${t.gan}・支${t.zhi}` }) : null; })(), d.current ? h('span', { class: 'badge alt', text: '目前' }) : null))),
        h('p', { class: 'hint', text: `歲數是傳統的虛歲（出生就算 1 歲，比實歲多 1）；起運是出生後實際經過的時間。${b.yun.approx ? '沒有出生時間，起運歲數可能差幾個月。' : ''}` }),
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
      h('p', { text: DAYMASTER[b.dayMaster.gan].text }),
      h('p', { class: 'muted', text: b.dayMaster.text }),
      h('h3', { text: `十神分布：${dom.group}最多` }),
      h('p', { text: SHISHEN_GROUPS[dom.group].text }),
      h('p', { class: 'muted small', text: `天干算 1、藏干算 0.5：${Object.entries(dom.score).map(([k, v]) => `${k} ${v}`).join('、')}。` }),
      h('h3', { text: '五行（八字字面）' }),
      wxBars,
      h('p', { text: b.wuxing.missing.length ? `字面上缺：${b.wuxing.missing.join('、')}` : '五行俱全' }),
      ys ? h('h3', { text: `喜用神：${ys.primary}（${ys.roles.primary}），其次${ys.secondary}` }) : null,
      ys ? playWhenVisible(wuxingWheel(ys, b.dayMaster.wx)) : null,
      ys ? h('p', { class: 'muted small center', text: '外圈箭頭是相生、內圈的線是相剋；圈越大，這個五行在命盤裡的份量越重（月令加三倍）。綠底是喜用，紅底是忌神。' }) : null,
      ys ? h('ul', { class: 'reasons' }, [...ys.reasons, ys.tiaohou].filter(Boolean).map((t) => h('li', { class: 'tone-info', text: t }))) : null,
      h('p', { class: 'hint', text: '字面上缺的五行不一定要補；喜用神看的是日主強弱（扶抑法），開運佈置、幸運色、姓名搭配都用這個結果。' }),
      h('h3', { text: '命盤上的其他記號' }),
      h('ul', { class: 'plain' },
        h('li', { text: `空亡（日柱旬空）：${b.extra.kong}${b.extra.kongPillars.length ? `，落在${b.extra.kongPillars.join('、')}：這一柱代表的人事力量比較虛，常是「看得到、抓不牢」` : '，其他柱沒有落空'}。` }),
        h('li', { text: `胎元：${b.extra.taiYuan}（受孕的月份，傳統用來看先天體質與根基）` }),
        b.extra.mingGong ? h('li', { text: `命宮：${b.extra.mingGong}（先天的格局與一生的主軸）・身宮：${b.extra.shenGong}（後天努力的方向）` }) : h('li', { class: 'muted', text: '命宮、身宮需要出生時間。' }),
        h('li', { text: `十二長生：日主在四柱地支的狀態，長生、臨官、帝旺代表有力，衰、病、死、墓、絕代表較弱。` })),
      (() => {
        const ss = shensha(b);
        return [
          h('h3', { text: `神煞（${ss.length ? ss.map((x) => x.name).join('、') : '沒有常見的神煞'}）` }),
          ss.length ? h('ul', { class: 'reasons' }, ss.map((x) => h('li', { class: x.name === '羊刃' || x.name === '魁罡' ? 'tone-info' : 'tone-good' }, h('b', { text: `${x.name}（${x.at.join('、')}）：` }), h('span', { text: x.text })))) : null,
          h('p', { class: 'hint', text: '神煞是輔助參考：天乙貴人、文昌看日干（貴人也看年干），桃花、驛馬、華蓋看年支和日支。吉凶還是以日主強弱和喜用神為主，有吉神不代表一定好、有羊刃也不代表一定壞。' }),
        ];
      })(),
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
          h('div', { class: 'ln-head' }, h('b', { text: `${ln.year} ${ln.ganzhi}（${ln.animal}）年` }), h('span', { class: 'badge', text: ln.shishen }), ln.tone ? h('span', { class: 'badge alt', text: `干${ln.tone.gan}・支${ln.tone.zhi}` }) : null, ln.taisui.map((t) => h('span', { class: 'badge danger', text: t })), ln.triggers.map((t) => h('span', { class: 'badge danger', text: t.type }))),
          ln.tone ? h('p', { class: toneCls(ln.tone), text: `天干${ln.tone.ganWx}、地支${ln.tone.zhiWx}，對你：${ln.tone.text}` }) : null,
          h('p', { text: ln.shishenText }),
          ln.triggers.length ? h('ul', { class: 'reasons' }, ln.triggers.map((t) => h('li', { class: 'tone-bad', text: t.text }))) : null,
          ln.relations.length ? h('ul', { class: 'plain small' }, ln.relations.map((r) => h('li', { text: r.text }))) : null,
          ln.dayun ? h('p', { class: 'muted small', text: `所在大運：${ln.dayun.ganzhi}` }) : null,
        )),
      ),
      h('p', { class: 'hint', text: '流年以立春為界（每年約 2/4 起算）。「干喜・支忌」是流年的天干、地支各自對照你的喜用神（扶抑法）：喜是助力、忌是壓力、平是不偏不倚，這比只看十神名稱更準。十神看日主與流年天干的關係，地支看與四柱的沖合刑害破；伏吟是流年和某一柱完全相同，天剋地沖（反吟）是天干相沖（甲庚、乙辛、丙壬、丁癸）、地支又相沖，歲運並臨是流年和大運相同。皆為傳統說法，僅供參考。' }),
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
    const [{ buildZiwei, STAR_TEXT }, { rotateZiwei, twinsInfo }, { PALACE_TEXT, ZIWEI_STARS, PALACE_DOMAIN, BRIGHTNESS_TEXT, mutagenIn }] = await Promise.all([import('../core/ziwei.js'), import('../core/reading.js'), import('../core/reading-texts.js')]);
    const z0 = buildZiwei(input, { gender: p.gender, solarTime: opts.solarTime, at: opts.today });
    if (!z0.ok) return warnCard(z0.error, true);
    const twins = p.birthOrder ? twinsInfo({ birthOrder: p.birthOrder, hasTime: true, method: ctx.getSettings().twinMethod }) : null;
    const z = twins && twins.shift ? rotateZiwei(z0, twins.shift) : z0;
    const detail = h('div', { class: 'palace-detail' }, h('p', { class: 'hint', text: '點命盤上任一宮看詳細星曜。' }));
    const hs = z.horoscope;
    const cells = order(z.palaces.map((pal) => {
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
    }));
    function showPalace(pal) {
      // 命宮、官祿、夫妻、財帛有專屬文案；其他宮用「星的特質表現在這一宮管的事上」，不套命宮的個性
      const field = PALACE_FIELD[pal.name];
      const starText = (st) => (field && ZIWEI_STARS[st.name]?.[field]) || `${STAR_TEXT[st.name] || ''}落在${pal.name}，這些特質會表現在${PALACE_DOMAIN[pal.name] || '這一宮的事'}上。`;
      // 借對宮的星：星的特質看這一宮的事，但四化留在它真正所在的對宮（不能寫成「化忌在福德」）
      const starLi = (st, mutPalace = pal.name) => h('li', {},
        h('b', { text: `${st.name}${st.brightness ? `（${st.brightness}）` : ''}${st.mutagen ? ` ${st.mutagen}` : ''}` }),
        h('span', { text: `：${starText(st)}` }),
        st.brightness && BRIGHTNESS_TEXT[st.brightness] ? h('div', { class: 'muted small', text: `亮度${BRIGHTNESS_TEXT[st.brightness]}。` }) : null,
        st.mutagen ? h('div', { class: 'muted small', text: `${mutagenIn(st.mutagen, mutPalace)}${mutPalace !== pal.name ? `（四化在對宮${mutPalace}，這裡是借來看）` : ''}` }) : null);
      const opp = z.palaces.find((q) => q.index === (pal.index + 6) % 12);
      fill(detail,
        h('h3', { text: `${pal.name}（${pal.stem}${pal.branch}）${pal.isBody ? '・身宮' : ''}${pal.originalName ? `・原本的${pal.originalName}` : ''}` }),
        h('p', { class: 'muted', text: PALACE_TEXT[pal.name] || '' }),
        h('p', { class: 'muted small', text: `大限 ${pal.decadal[0]}–${pal.decadal[1]} 歲（虛歲）` }),
        pal.major.length
          ? h('ul', { class: 'plain' }, pal.major.map(starLi))
          : [h('p', { text: `空宮：沒有主星，借對宮（${opp.name}）的${opp.major.length ? opp.major.map((x) => x.name).join('、') : '星曜'}來看，這一宮的事比較受環境影響。` }), opp.major.length ? h('ul', { class: 'plain' }, opp.major.map((st) => starLi(st, opp.name))) : null],
        pal.minor.length ? h('p', { text: `輔星：${pal.minor.map((st) => st.name + (st.mutagen ? `（${st.mutagen}）` : '')).join('、')}` }) : null,
        pal.minor.filter((st) => st.mutagen).map((st) => h('p', { class: 'muted small', text: mutagenIn(st.mutagen, pal.name) })),
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
      twins && twins.shift ? h('p', { class: 'warn', text: `多胞胎第 ${p.birthOrder} 個出生：依「${ctx.getSettings().twinMethod === 'travel' && p.birthOrder === 2 ? '老二借遷移宮' : '弟妹借兄弟宮'}」的看法，宮名已輪轉（點宮位可看原本是哪一宮）。兩派沒有定論，可在上方「排盤設定」切換。` }) : null,
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
    const [{ computeMaya, compareMaya }, { MAYA_POSITION_TEXT, MAYA_KEYWORD_TEXT }] = await Promise.all([import('../core/maya.js'), import('../core/reading-texts.js')]);
    const r = computeMaya(input.date, mayaTwinTime(p, input));
    const others = ctx.getPeople().filter((x) => x.id !== p.id);
    const twinBox = h('input', { type: 'checkbox', id: 'maya-twin', checked: r.twin, disabled: !input.time, onchange: (e) => { twinOverride.set(p.id, e.target.checked); render(); } });
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
      h('details', { class: 'more', open: true }, h('summary', { text: '白話解說：每個位置代表什麼' }), h('ul', { class: 'plain' }, r.items.map((it) => h('li', {}, h('b', { text: MAYA_POSITION_TEXT[it.key] }), it.keyword ? h('div', { class: 'muted', text: `你的數字 ${it.value}「${it.keyword}」：${MAYA_KEYWORD_TEXT[it.keyword]}` }) : null)))),
      h('label', { class: 'check', for: 'maya-twin' }, twinBox, h('span', { text: input.time ? '雙胞胎分流（加上出生的時＋分）' : '雙胞胎分流需要出生時間' })),
      compareBlock,
      h('p', { class: 'hint', text: '計算規則依你提供的 V1 計算器重寫（規則原始出處沒驗到）；數字的關鍵字依個位數對照，文字為本 App 撰寫，可能與其他老師的版本不同。' }),
      actions(p, 'maya', '瑪雅密碼', r.items.map((it) => `${it.key}=${it.value ?? '—'}`).join(' '), { title: `${p.name}的瑪雅密碼`, lines: r.items.map((it) => `${it.label}：${it.value ?? '—'}${it.keyword ? `（${it.keyword}）` : ''}`) }),
    );
  }

  // ── 生命靈數
  async function drawNumerology(p, input) {
    const [{ lifePath, grid }, { LIFEPATH_DETAIL }] = await Promise.all([import('../core/numerology.js'), import('../core/reading-texts.js')]);
    const lp = lifePath(input.date);
    const g = grid(input.date);
    const LAYOUT = [3, 6, 9, 2, 5, 8, 1, 4, 7];
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的生命靈數` }),
      h('div', { class: 'score-hero' }, ringTo(h('div', { class: 'score-ring lv-mid' }, h('b', { text: lp.label }), h('small', { text: '主命數' })), 100), h('div', {}, h('h3', { text: lp.title }), h('p', { text: lp.text }))),
      h('ul', { class: 'reasons' }, h('li', { class: 'tone-info', text: `事業：${LIFEPATH_DETAIL[lp.number].career}` }), h('li', { class: 'tone-info', text: `感情：${LIFEPATH_DETAIL[lp.number].love}` })),
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
    const [{ buildBazi, baziClock }, { solarToLunar }, { chengGu }, { CHENGGU_PLAIN }] = await Promise.all([import('../core/bazi.js'), import('../core/calendar.js'), import('../core/chenggu.js'), import('../core/reading-texts.js')]);
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
      CHENGGU_PLAIN[r.total] ? h('p', {}, h('b', { text: '白話：' }), h('span', { text: CHENGGU_PLAIN[r.total] })) : null,
      h('p', { class: 'hint', text: '民俗娛樂，不代表命運。年份以立春為界、閏月以本月計、23 點後日期以當天計（各家規則不同，結果可能和其他網站不一樣）。' }),
      actions(p, 'chenggu', '稱骨', `${r.text}：${r.poem}`, { title: `${p.name}的稱骨`, big: r.text, lines: [r.poem] }),
    );
  }

  // ── 綜合解讀：星座、八字、紫微、生命靈數、瑪雅、姓名、稱骨一起看
  async function drawReading(p, input, opts) {
    const prof = await loadProfile(ctx, p, input, opts, { mayaTime: mayaTwinTime(p, input) });
    const r = prof.reading;
    const { missing } = prof;
    const traitList = h('div', { class: 'traits' }, r.traits.map((t) => h(
      'div',
      { class: 'trait' },
      h('div', { class: 'trait-head' }, h('b', { text: t.label }), h('span', { class: 'count', text: `${t.count} 個系統` })),
      h('div', { class: 'muted small', text: t.sources.join('・') }),
    )));
    const areas = r.areas.map((a, i) => h(
      'details',
      { class: 'area', open: i === 0 },
      h('summary', { text: a.title }),
      h('div', { class: 'area-body' },
        a.summary ? h('p', { class: 'gold', text: a.summary }) : null,
        a.points.map((pt) => h('div', { class: 'point' }, h('span', { class: `sys sys-${pt.system}`, text: pt.system }), h('span', { text: pt.text })))),
    ));
    const cards = [
      h(
        'section',
        { class: 'card feature' },
        cardHead(h, 'book', `${p.name}的綜合解讀`, '星座・八字・紫微・生命靈數・瑪雅・姓名・稱骨・血型'),
        h('h3', { text: '各系統的共同點' }),
        r.traits.length ? traitList : h('p', { class: 'muted', text: '資料還不夠多，補上出生時間與性別會更準。' }),
        h('p', { class: 'hint', text: '同一個特質被兩個以上的系統提到，代表比較可信；只出現一次的看法列在各面向裡當參考。' }),
        missing.length ? h('p', { class: 'warn', text: `補上這些資料會更完整：${missing.join('、')}。` }) : null,
        missing.length ? h('button', { type: 'button', class: 'btn small', text: '到「我的」補資料', onclick: () => ctx.go('me') }) : null,
      ),
      h('section', { class: 'card' }, cardHead(h, 'star', '七個面向', '點開看各系統怎麼說'), areas, h('p', { class: 'hint', text: '解讀文字由本 App 撰寫，命理與星座僅供參考；健康相關請以醫師意見為準。' }),
        actions(p, 'reading', '綜合解讀', r.traits.map((t) => `${t.label}（${t.count} 系統）`).join('、') || '綜合解讀', { title: `${p.name}的綜合解讀`, subtitle: '多個命理系統的共同點', lines: [...r.traits.map((t) => `${t.label}｜${t.sources.join('、')}`), ...r.areas.slice(1, 4).map((a) => `${a.title}：${a.summary}`)] })),
    ];
    if (r.twins) {
      cards.push(h('section', { class: 'card' }, cardHead(h, 'twins', '多胞胎怎麼看', `第 ${p.birthOrder} 個出生`), h('ul', { class: 'reasons' }, r.twins.lines.map((t) => h('li', { class: 'tone-info', text: t })))));
    }
    return cards;
  }

  // ── 姓名分析（熊崎式五格＋三才＋81 數理＋唸法＋與八字搭配）
  async function drawName(p, input, opts) {
    const [NM, B] = await Promise.all([import('../core/name.js'), import('../core/bazi.js')]);
    // 暱稱像「媽媽」不是本名；看起來像 2～4 字中文姓名才拿來預填
    const looksLikeName = /^\p{Script=Han}{2,4}$/u.test(p.name) && !/^(媽媽|爸爸|阿公|阿嬤|哥哥|姊姊|姐姐|弟弟|妹妹|老公|老婆|寶貝|兒子|女兒)$/.test(p.name);
    const nameInput = h('input', { type: 'text', maxlength: 6, value: p.fullName || (looksLikeName ? p.name : ''), 'aria-label': '姓名（含姓氏）', placeholder: '例如：王小明' });
    const surSel = h('select', { 'aria-label': '姓氏字數' }, h('option', { value: '0', text: '姓氏：自動判斷' }), h('option', { value: '1', text: '單姓（1 個字）' }), h('option', { value: '2', text: '複姓／雙姓（2 個字）' }));
    const out = h('div', {});
    const overrides = {};
    const bz = B.buildBazi(input, opts);
    const bazi = bz.ok ? bz : null;
    let data;
    try {
      data = await NM.loadNameData();
    } catch {
      return warnCard('康熙筆畫資料載入失敗，請確認網路後重新開啟 App。');
    }
    const analyze = () => {
      const r = NM.analyzeName(nameInput.value, data, { surnameLength: Number(surSel.value), bazi, overrides });
      if (!r.ok) {
        fill(out, h('p', { class: 'warn', text: r.error }), r.needStrokes ? h('div', {}, r.needStrokes.map((ch) => {
          const box = h('input', { type: 'text', inputmode: 'numeric', maxlength: 2, 'aria-label': `「${ch}」的康熙筆畫`, placeholder: `「${ch}」幾畫`, onchange: (e) => { const n = parseInt(e.target.value, 10); if (n > 0) overrides[ch] = n; } });
          return h('div', { class: 'field' }, h('span', { class: 'field-label', text: `「${ch}」的康熙筆畫（可查教育部異體字字典）` }), box);
        }), h('button', { type: 'button', class: 'btn small', text: '用這些筆畫分析', onclick: analyze })) : null);
        return;
      }
      fill(out, ...reveal(nameResult(p, r)));
    };
    const card = h(
      'section',
      { class: 'card feature' },
      cardHead(h, 'pen', '姓名分析', '康熙筆畫・五格・三才・81 數理・唸法'),
      h('div', { class: 'row2' }, h('div', { class: 'field' }, h('span', { class: 'field-label', text: '姓名' }), nameInput), h('div', { class: 'field' }, h('span', { class: 'field-label', text: '姓氏' }), surSel)),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', text: '分析', onclick: analyze }),
        h('button', {
          type: 'button',
          class: 'btn',
          text: '設為本名',
          onclick: () => {
            const v = nameInput.value.trim();
            if (!/^\p{Script=Han}{2,6}$/u.test(v)) return ctx.toast('本名請輸入 2～6 個中文字');
            const saved = ctx.savePerson({ ...p, fullName: v });
            ctx.toast(saved.ok ? '已存成本名（只在這支手機），綜合解讀會一起分析' : saved.error);
          },
        })),
      h('p', { class: 'hint', text: '多胞胎、同生日的人，命盤可能一樣，但名字一定不同，姓名學是最能區分的一項。' }),
      out,
    );
    if (nameInput.value) analyze();
    return card;
  }

  function nameResult(p, r) {
    const chars = order(r.surname.concat(r.given).map((c) => h('div', { class: 'name-char' }, h('div', { class: 'zy', text: c.zhuyin || '—' }), h('div', { class: 'hz', text: c.char }), h('div', { class: 'st', text: `${c.strokes} 畫` }))));
    const gridOrder = ['天格', '人格', '地格', '外格', '總格'];
    const ring = ringTo(h('div', { class: `score-ring ${r.score >= 80 ? 'lv-high' : r.score >= 65 ? 'lv-mid' : 'lv-low'}` }, h('b', { text: String(r.score) }), h('small', { text: '綜合' })), r.score);
    const gridCards = h('div', { class: 'grids' }, gridOrder.map((k) => h('div', { class: `grid-cell ${r.grids[k].grade}` }, h('div', { class: 'gv', text: String(r.grids[k].value) }), h('div', { class: 'gl', text: k }), h('div', { class: 'gl', text: `${r.grids[k].element}・${r.grids[k].gradeText}` }))));
    const gridDetails = h('ul', { class: 'plain' }, gridOrder.map((k) => {
      const g = r.grids[k];
      return h('li', {}, h('b', { text: `${k} ${g.value}${g.n81 !== g.value ? `（${g.n81}）` : ''}・${g.title}・${g.gradeText}` }), h('div', { class: 'muted small', text: `${g.scope}。${g.note}` }), h('div', { text: g.text }), g.disputed ? h('div', { class: 'muted small', text: '這個數各家書籍的吉凶說法不一，參考就好。' }) : null);
    }));
    return [
      h('section', { class: 'card' },
        h('div', { class: 'name-chars' }, chars),
        h('div', { class: 'score-hero' }, ring, h('ul', { class: 'reasons' }, r.summary.slice(0, 3).map((t) => h('li', { class: 'tone-info', text: t })))),
        gridCards),
      h('section', { class: 'card' }, cardHead(h, 'book', '五格白話', '人格最重要，天格由姓氏決定、不計分'), gridDetails),
      h('section', { class: 'card' },
        cardHead(h, 'compass', `三才「${r.sancai.elements}」・${r.sancai.gradeText}`, '天格、人格、地格的五行生剋'),
        h('p', { text: r.sancai.summary }),
        h('ul', { class: 'reasons' }, r.sancai.lines.map((t) => h('li', { class: 'tone-info', text: t }))),
        h('p', { class: 'hint', text: '三才依五行生剋推算，和部分書上的固定表會有出入（例如有的派別把「木剋土」當成「樹種在土裡」的好搭配）。' })),
      h('section', { class: 'card' },
        cardHead(h, 'star', '唸法與音律', r.phonetics.ok ? `平仄：${r.phonetics.pattern}` : ''),
        h('ul', { class: 'reasons' }, (r.phonetics.ok ? r.phonetics.notes : [r.phonetics.text]).map((t) => h('li', { class: 'tone-info', text: t }))),
        r.bazi ? h('h3', { text: '和八字五行的搭配' }) : null,
        r.bazi ? h('ul', { class: 'reasons' }, r.bazi.lines.map((t) => h('li', { class: 'tone-info', text: t }))) : null,
        r.bazi ? h('p', { class: 'hint', text: '喜用五行依日主強弱判斷（扶抑法），怎麼算的在「開運佈置」有完整說明。' }) : null,
        h('details', { class: 'more' }, h('summary', { text: '計算規則' }), h('ul', { class: 'plain small' },
          h('li', { text: '台灣最常見的熊崎式：筆畫用康熙字典筆畫（部首還原本字：氵4、扌4、忄4、艹6、阝左 8 右 7、王字旁 5）。' }),
          h('li', { text: '國字數字一～十以數值計（「四」算 4 畫）。罕用字查不到時可以手動輸入筆畫。' }),
          h('li', { text: '天格＝單姓＋1（複姓兩字相加）；人格＝姓末字＋名首字；地格＝單名＋1（複名相加）；總格＝全部相加；外格＝天格＋地格－人格。' }),
          h('li', { text: '超過 81 減 80；五行看個位數：1、2 木，3、4 火，5、6 土，7、8 金，9、0 水。' }),
          h('li', { text: '筆畫資料由 Unicode Unihan 換算；約 1% 的字各家筆畫不同（多為異體字）。' }))),
        actions(p, 'name', `姓名分析（${r.fullName}）`, `人格${r.grids.人格.value}${r.grids.人格.gradeText}、總格${r.grids.總格.value}${r.grids.總格.gradeText}、三才${r.sancai.elements}${r.sancai.gradeText}`, { title: `${r.fullName}・姓名分析`, big: String(r.score), bigScore: r.score, bigLabel: '綜合分', lines: r.summary.slice(0, 4) })),
    ];
  }

  ctx.onProfile(render);
  render();
  return {
    // 其他分頁可以直接跳到某個工具（例如今日的「財位與開運擺設」）
    open(o) {
      if (o && o.tool && TOOLS.some((t) => t.id === o.tool) && o.tool !== tool) {
        tool = o.tool;
        save('destinyTool', tool);
        render();
      }
    },
  };
}
