// 「命盤」：選人＋選工具（下拉）：綜合解讀（多系統一起看）、工作與未來方向、開運佈置、家人關係、八字命盤、流年大運太歲、
// 紫微命盤、姓名分析、血型、瑪雅密碼、生命靈數、袁天罡稱骨。各工具的函式庫用到才載入（紫微約 51KB、康熙筆畫約 85KB gzip）。
// 結果可「存到紀錄」（只存在手機）或存成圖卡。多胞胎依「我的」裡填的出生順序套用紫微借宮。

import { h, s as svg, clear, segmented, fill, nextId } from '../ui/dom.js';
import { ALT_NAME_KINDS } from '../core/records.js';
import { load, save } from '../ui/storage.js';
import { zoneToday, DEFAULT_TZ } from '../core/tz.js';
import { cardHead } from '../ui/icons.js';
import { reveal, order, ringTo, playWhenVisible } from '../ui/motion.js';
import { loadProfile } from './profile.js';
import { wuxingWheel, loader } from '../ui/charts.js';

// 匿名試算的名字：只放在這次開著的 App 記憶體裡，不存檔、不進紀錄，換人也保留（不屬於任何人）；重開 App 就清掉
const trial = { names: [], bazi: false };

const TOOLS = [
  { id: 'reading', label: '綜合解讀（多系統一起看）' },
  { id: 'career', label: '工作與未來方向' },
  { id: 'fengshui', label: '開運佈置（財庫、財位、擺設）' },
  { id: 'family', label: '家人關係（誰幫誰、怎麼相處）' },
  { id: 'bazi', label: '八字命盤' },
  { id: 'liunian', label: '人生時間軸・流年・太歲' },
  { id: 'ziwei', label: '紫微命盤' },
  { id: 'name', label: '姓名分析' },
  { id: 'blood', label: '血型' },
  { id: 'maya', label: '瑪雅曆（銀河印記、瑪雅密碼）' },
  { id: 'numerology', label: '生命靈數' },
  { id: 'chenggu', label: '袁天罡稱骨' },
  { id: 'palm', label: '掌紋（含斷掌）' },
];
// 紫微某一宮要看星曜的哪一段白話
const PALACE_FIELD = { 命宮: 'ming', 官祿: 'career', 夫妻: 'love', 財帛: 'wealth' };
const WX_CLASS = { 木: 'wx-wood', 火: 'wx-fire', 土: 'wx-earth', 金: 'wx-metal', 水: 'wx-water' };
const MUTAGEN_CLASS = { 化祿: 'mg-lu', 化權: 'mg-quan', 化科: 'mg-ke', 化忌: 'mg-ji' };
// 干支喜忌的顏色：兩個都忌＝紅、有喜而沒有忌＝綠、其他＝中性
const GEJU_BADGE = { 成格: 'good', 成中帶忌: 'alt', 破格: 'danger', 敗中有救: 'alt', 平常: '' };
const GEJU_TONE = { good: 'tone-good', bad: 'tone-bad', rescue: 'tone-info', note: 'tone-info' };
const PATTERN_TONE = { good: 'tone-good', bad: 'tone-bad', mixed: 'tone-info' };
const toneCls = (t) => (!t ? 'tone-info' : t.gan === '忌' && t.zhi === '忌' ? 'tone-bad' : (t.gan === '喜' || t.zhi === '喜') && t.gan !== '忌' && t.zhi !== '忌' ? 'tone-good' : 'tone-info');

export function mountDestiny(root, ctx) {
  let tool = load('destinyTool', 'reading');
  if (!TOOLS.some((t) => t.id === tool)) tool = 'reading';
  let compareId = null;
  // 瑪雅曆的雙胞胎分流：填了出生順序（多胞胎）就預設打開，手動切換的結果按人記住。
  // 解讀和瑪雅工具共用同一個判斷，避免兩邊結果不一致（之前解讀從來不加時分，雙胞胎的瑪雅一模一樣）。
  const twinOverride = new Map();
  // 瑪雅密碼區塊打開或收起：記在這支手機；勾雙胞胎分流、換合盤對象都會重畫，不記的話一勾就自己關掉
  let mayaCodeOpen = load('mayaCodeOpen', null);
  const mayaTwinTime = (p, input) => (input.time && (twinOverride.has(p.id) ? twinOverride.get(p.id) : !!p.birthOrder) ? input.time : null);
  let token = 0;

  function render() {
    token += 1;
    const my = token;
    clear(root);
    const people = ctx.getPeople();
    if (!people.length) {
      root.append(h('div', { class: 'card tip' }, h('p', { text: '先到「我的」輸入生日，就能排八字、紫微、流年。' }), h('button', { type: 'button', class: 'btn small', text: '去填生日', onclick: () => ctx.go('me') })));
      return;
    }
    // 看誰由頁首的「目前查看的人」決定（全 App 一致），這裡不再自己記一份
    const p = ctx.getActive() || people[0];
    const settings = ctx.getSettings();

    const toolSel = h('select', { 'aria-label': '選擇命理工具', onchange: (e) => { tool = e.target.value; save('destinyTool', tool); render(); } }, TOOLS.map((t) => h('option', { value: t.id, text: t.label })));
    toolSel.value = tool;

    root.append(
      h(
        'section',
        { class: 'card controls' },
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: people.length > 1 ? `工具（正在看：${p.name}，換人在右上角）` : '工具' }), toolSel),
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
      palm: () => import('./tool-palm.js').then((m) => m.drawPalm(p, kit)),
      name: () => drawName(p, input, opts),
      bazi: () => drawBazi(p, input, opts),
      liunian: () => drawLiunian(p, input, opts),
      ziwei: () => drawZiwei(p, input, opts),
      maya: () => drawMaya(p, input),
      numerology: () => drawNumerology(p, input, opts),
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
  // 格局：月令定一生主軸（子平法），和喜用神（五行平衡）分開講；印章在滑到眼前時才蓋下去
  function gejuBlock(g) {
    if (!g) return null;
    const name = `${g.name}${g.use ? `（${g.use}）` : ''}`;
    const toneWord = { 喜: '格局喜歡的', 忌: '格局怕的', 平: '影響不大' };
    return [
      playWhenVisible(h(
        'div',
        { class: 'geju-head' },
        h('div', { class: 'seal', 'aria-hidden': 'true' }, [...g.name].map((ch) => h('span', { text: ch }))),
        h('div', {}, h('h3', {}, `格局：${name} `, h('span', { class: `badge ${GEJU_BADGE[g.status]}`, text: g.status })), h('p', { class: 'muted small', text: `主軸：${g.info.core}` })),
      )),
      h('p', { text: g.info.text }),
      h('p', { class: 'muted small', text: `怎麼取的：${g.how}` }),
      g.items.length ? h('ul', { class: 'reasons' }, g.items.map((x) => h('li', { class: GEJU_TONE[x.tone], text: x.text }))) : null,
      h('p', {}, h('b', { text: `${g.status}：` }), g.statusText),
      h('ul', { class: 'plain' },
        h('li', {}, h('b', { text: '適合：' }), g.info.work),
        h('li', {}, h('b', { text: '要小心：' }), g.info.caution),
        h('li', {}, h('b', { text: '大運流年：' }), `${g.luckBasis}：喜歡遇到${g.likes.join('、')}${g.fears.length ? `，怕遇到${g.fears.join('、')}` : ''}。`),
        g.dayun ? h('li', {}, h('b', { text: `目前大運 ${g.dayun.ganzhi}：` }), `天干${g.dayun.gan.ss}（${toneWord[g.dayun.gan.tone]}），地支本氣${g.dayun.zhi.ss}（${toneWord[g.dayun.zhi.tone]}）。`,
          g.dayun.conflict ? h('div', { class: 'muted small', text: '這步運格局和下面大運列表的喜忌（喜用神）說法相反：格局派看月令的用神、扶抑派看五行平衡，是兩派本來的差異，兩種都列出來參考。' }) : null) : null),
      g.notes.map((t) => h('p', { class: 'hint', text: t })),
      h('p', { class: 'hint', text: '格局看月令（出生月的主氣）在盤中扮演的角色，回答「一生的主軸、靠什麼成事」，依清代《子平真詮》的取格與成敗救應整理成白話；喜用神看五行平衡。兩者角度不同，開運佈置、幸運色仍照喜用神。' }),
    ];
  }

  async function drawBazi(p, input, opts) {
    const [{ buildBazi, WUXING, yongShen, ganzhiTone, shensha }, { dominantShishen }, { DAYMASTER, SHISHEN_GROUPS }, { geju }] = await Promise.all([import('../core/bazi.js'), import('../core/reading.js'), import('../core/reading-texts.js'), import('../core/geju.js')]);
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
      // 會讓柱子不同的提醒（交界、交節氣）用醒目的樣式放在盤面上方；一般說明維持小字
      b.uncertain.map((t) => h('p', { class: 'warn', text: t })),
      b.notes.map((t) => h('p', { class: 'hint', text: t })),
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
      gejuBlock(geju(b)),
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
      actions(p, 'bazi', '八字命盤', `${gz}；日主${b.dayMaster.gan}${b.dayMaster.wx}`, { title: `${p.name}的八字`, subtitle: b.clockText || '未填時間', private: ['subtitle'], lines: [gz, `日主 ${b.dayMaster.gan}${b.dayMaster.wx}`, b.wuxing.missing.length ? `缺 ${b.wuxing.missing.join('、')}` : '五行俱全'] }),
    );
  }

  // ── 流年・大運・太歲
  async function drawLiunian(p, input, opts) {
    const [{ buildBazi, liunian, taiSuiList }, { buildLifeline, monthsAhead, WARN_TAGS, GOOD_TAGS }, { LEVEL_TEXT, LIFELINE_NOTE }] = await Promise.all([
      import('../core/bazi.js'), import('../core/lifeline.js'), import('../core/lifeline-texts.js')]);
    const b = buildBazi(input, opts);
    if (!b.ok) return warnCard(b.error, true);
    const y0 = opts.today.y;
    // ── 人生時間軸：未來 10 年每年的重點（八字、大運、太歲、占星回歸、生命靈數、瑪雅），先講哪幾年要注意、哪幾年順
    const L = buildLifeline({ bazi: b, natal: ctx.natalOf(p), birth: input.date, today: opts.today, gender: p.gender });
    const LV = { 順: 'lv-high', 小順: 'lv-mid', 平: 'lv-flat', 注意: 'lv-low', 小心: 'lv-poor' };
    const barPct = (score) => Math.round(Math.max(6, Math.min(100, ((score + 4) / 7) * 100))); // -4～+3 對到長條長度
    // 注意的年份只講壓力的原因、順的年份只講助力的原因（依重要程度排）；都沒有就講那一年的十神
    const why = (y, keys) => keys.filter((t) => y.tags.includes(t)).slice(0, 2).join('、') || y.tags[0] || y.level;
    const timeline = h('section', { class: 'card feature' },
      cardHead(h, 'calendar', `${p.name}的人生時間軸`, `未來 10 年（${L.years[0].year}～${L.years[L.years.length - 1].year}）每年的重點`),
      h('p', {}, h('b', { text: '最需要注意：' }), h('span', { text: L.watch.length ? L.watch.map((y) => `${y.year}（${why(y, WARN_TAGS)}）`).join('、') : '未來 10 年沒有特別需要小心的年份。' })),
      L.good.length ? h('p', {}, h('b', { text: '比較順：' }), h('span', { text: L.good.map((y) => `${y.year}（${why(y, GOOD_TAGS)}）`).join('、') })) : null,
      h('p', { class: 'muted small', text: '點年份看那一年可能遇到的事（工作、財務、感情）和建議。' }),
      h('div', { class: 'lifeline' }, L.years.map((y) => h('details', { class: 'ly' },
        h('summary', {},
          h('span', { class: 'ly-year' }, h('b', { text: String(y.year) }), h('small', { class: 'muted', text: `${y.age} 歲` })),
          h('span', { class: `ly-bar ${LV[y.level]}`, style: { '--w': `${barPct(y.score)}%` }, 'aria-hidden': 'true' }),
          h('span', { class: `ly-level ${LV[y.level]}`, text: y.level }),
          h('span', { class: 'ly-tags muted small', text: y.tags.slice(0, 4).join('・') })),
        h('p', { class: 'ly-advice', text: LEVEL_TEXT[y.level] }),
        h('ul', { class: 'reasons' }, y.events.map((e) => h('li', { class: `tone-${e.tone}` }, h('span', { class: `sys sys-${e.system}`, text: e.system }), h('span', { text: e.text }))))))),
      h('p', { class: 'hint', text: `${LIFELINE_NOTE}八字流年從立春（約 2/4）起算，流年印記從生日起算，年齡是當年生日過後的實歲。` }));
    // ── 接下來 12 個月（以節氣換月）
    const M = monthsAhead({ bazi: b, today: opts.today });
    const monthsCard = h('section', { class: 'card' },
      cardHead(h, 'bell', '接下來 12 個月', '流月、水星逆行、日月食'),
      h('ol', { class: 'months' }, M.map((m) => h('li', { class: 'mo' },
        h('div', { class: 'mo-head' },
          h('b', { text: `${m.start.m}/${m.start.d}～${m.end.m}/${m.end.d}` }),
          h('span', { class: 'muted small', text: `${m.ganzhi}月${m.shishen ? `・${m.shishen}` : ''}` }),
          h('span', { class: `ly-level ${LV[m.level]}`, text: m.level })),
        m.notes.length ? h('ul', { class: 'reasons small' }, m.notes.map((n) => h('li', { class: `tone-${n.tone}`, text: n.text }))) : null))),
      h('p', { class: 'hint', text: '流月以節氣換月（例如 12/7 大雪起是子月），和國曆、農曆的月份不一樣。「注意」「小心」的月份，重要的決定和簽約可以避開或多準備。' }));
    const years = liunian(b, [y0, y0 + 1, y0 + 2, y0 + 3, y0 + 4]);
    const current = b.yun ? b.yun.list.find((d) => d.current) : null;
    const yearCard = h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的八字流年細節（近 5 年）` }),
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
    return [timeline, monthsCard, yearCard, taiSuiCard];
  }

  // ── 紫微命盤
  async function drawZiwei(p, input, opts) {
    const [{ buildZiwei, STAR_TEXT }, { rotateZiwei, twinsInfo }, { PALACE_TEXT, ZIWEI_STARS, PALACE_DOMAIN, BRIGHTNESS_TEXT, mutagenIn }, { pairText, sanFang, mingPatterns }] = await Promise.all([import('../core/ziwei.js'), import('../core/reading.js'), import('../core/reading-texts.js'), import('../core/ziwei-pattern.js')]);
    const z0 = buildZiwei(input, { gender: p.gender, solarTime: opts.solarTime, at: opts.today });
    if (!z0.ok) return warnCard(z0.error, true);
    const twins = p.birthOrder ? twinsInfo({ birthOrder: p.birthOrder, hasTime: true, method: ctx.getSettings().twinMethod }) : null;
    const z = twins && twins.shift ? rotateZiwei(z0, twins.shift) : z0;
    const detail = h('div', { class: 'palace-detail' });
    const hs = z.horoscope;
    const btnOf = new Map();
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
      btnOf.set(pal.index, el);
      return el;
    }));
    // 三方四正連線：本宮與兩個三合宮連成三角形、本宮再連到對宮。線的端點取每格「朝向中間」那一邊的中點，
    // 線幾乎都走在中央的資料區，不會壓到星曜文字；用實際像素畫（不縮放），pathLength=1 才能從頭畫到尾。
    const lines = svg('svg', { class: 'sf-lines', 'aria-hidden': 'true' });
    const grid = h('div', { class: 'ziwei-grid' }, cells, lines);
    let selected = null;
    function drawLines() {
      if (!selected || !grid.offsetWidth) return;
      // 用 offset* 量版面位置：宮格進場時有位移動畫，getBoundingClientRect 會量到動畫中的位置，線就歪了
      const anchor = (i) => {
        const pal = z.palaces.find((q) => q.index === ((i % 12) + 12) % 12);
        const el = btnOf.get(pal.index);
        const [row, col] = pal.grid;
        const x = el.offsetLeft + (col === 0 ? el.offsetWidth : col === 3 ? 0 : el.offsetWidth / 2);
        const y = el.offsetTop + (row === 0 ? el.offsetHeight : row === 3 ? 0 : el.offsetHeight / 2);
        return [x.toFixed(1), y.toFixed(1)];
      };
      const [a, b, c, d] = [0, 4, 8, 6].map((k) => anchor(selected.index + k));
      lines.setAttribute('viewBox', `0 0 ${grid.offsetWidth} ${grid.offsetHeight}`);
      fill(lines,
        svg('polygon', { points: [a, b, c].map((pt) => pt.join(',')).join(' '), pathLength: 1, class: 'sf-tri' }),
        svg('line', { x1: a[0], y1: a[1], x2: d[0], y2: d[1], pathLength: 1, class: 'sf-opp' }),
        [a, b, c, d].map((pt, i) => svg('circle', { cx: pt[0], cy: pt[1], r: i ? 3 : 4.5, class: i ? 'sf-dot' : 'sf-dot self' })));
    }
    if (typeof ResizeObserver === 'function') new ResizeObserver(drawLines).observe(grid);
    function showPalace(pal, { scroll = true } = {}) {
      selected = pal;
      for (const [idx, el] of btnOf) {
        const k = (((idx - pal.index) % 12) + 12) % 12;
        el.classList.toggle('sf-self', k === 0);
        el.classList.toggle('sf-on', k === 4 || k === 6 || k === 8);
        el.setAttribute('aria-pressed', String(k === 0));
      }
      drawLines();
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
      const pair = pairText(pal.major.length ? pal.major : opp.major);
      const sf = sanFang(z, pal);
      fill(detail,
        h('h3', { text: `${pal.name}（${pal.stem}${pal.branch}）${pal.isBody ? '・身宮' : ''}${pal.originalName ? `・原本的${pal.originalName}` : ''}` }),
        h('p', { class: 'muted', text: PALACE_TEXT[pal.name] || '' }),
        h('p', { class: 'muted small', text: `大限 ${pal.decadal[0]}–${pal.decadal[1]} 歲（虛歲）` }),
        pal.major.length
          ? h('ul', { class: 'plain' }, pal.major.map((st) => starLi(st)))
          : [h('p', { text: `空宮：沒有主星，借對宮（${opp.name}）的${opp.major.length ? opp.major.map((x) => x.name).join('、') : '星曜'}來看，這一宮的事比較受環境影響。` }), opp.major.length ? h('ul', { class: 'plain' }, opp.major.map((st) => starLi(st, opp.name))) : null],
        pal.minor.length ? h('p', { text: `輔星：${pal.minor.map((st) => st.name + (st.mutagen ? `（${st.mutagen}）` : '')).join('、')}` }) : null,
        pal.minor.filter((st) => st.mutagen).map((st) => h('p', { class: 'muted small', text: mutagenIn(st.mutagen, pal.name) })),
        pal.adjective.length ? h('p', { class: 'muted small', text: `雜曜：${pal.adjective.join('、')}` }) : null,
        pair ? h('p', {}, h('b', { text: '雙星組合：' }), pal.name === '命宮' ? pair : `${pair}這組特質會表現在${PALACE_DOMAIN[pal.name] || '這一宮的事'}上。`) : null,
        h('h4', { text: '三方四正（命盤上的連線）' }),
        h('ul', { class: 'plain sf-list' }, sf.list.map((x) => h('li', {}, h('b', { text: `${x.role}・${x.palace.name}` }), `：${x.stars.length ? x.stars.map((st) => st.name).join('、') : '沒有主星'}${x.borrowed && x.stars.length ? '（空宮，借對宮）' : ''}`))),
        h('p', {}, h('b', { text: '四化：' }), sf.mutagens.length ? sf.mutagens.map((m) => `${m.star}${m.mutagen}（${m.palace}）`).join('、') : '三方四正沒有生年四化'),
        h('p', {}, h('b', { text: '吉星：' }), sf.lucky.length ? sf.lucky.map((x) => `${x.star}（${x.palace}）`).join('、') : '沒有'),
        h('p', {}, h('b', { text: '煞星：' }), sf.sha.length ? sf.sha.map((x) => `${x.star}（${x.palace}）`).join('、') : '沒有'),
        h('p', { class: `sf-verdict ${sf.tone}`, text: sf.text }),
        h('p', { class: 'hint', text: '看一宮不能只看本宮：對宮、兩個三合宮的星曜與四化都會影響這一宮。吉凶是把吉星、煞星和四化加總的粗略判斷。' }),
      );
      if (scroll) detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    // 中間資料放在連線上層，文字加底色光暈，線看起來從字後面穿過
    grid.append(center);
    // 一打開就先看命宮（不捲動畫面）：連線、雙星與三方四正都先示範一次
    showPalace(z.palaces.find((q) => q.name === '命宮') || z.palaces[0], { scroll: false });
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的紫微命盤` }),
      z.uncertain.map((t) => h('p', { class: 'warn', text: t })),
      z.notes.map((t) => h('p', { class: 'hint', text: t })),
      twins && twins.shift ? h('p', { class: 'warn', text: `多胞胎第 ${p.birthOrder} 個出生：依「${ctx.getSettings().twinMethod === 'travel' && p.birthOrder === 2 ? '老二借遷移宮' : '弟妹借兄弟宮'}」的看法，宮名已輪轉（點宮位可看原本是哪一宮）。兩派沒有定論，可在上方「排盤設定」切換。` }) : null,
      grid,
      h('div', { class: 'legend small' }, h('span', { class: 'mg mg-lu', text: '祿' }), ' 化祿 ', h('span', { class: 'mg mg-quan', text: '權' }), ' 化權 ', h('span', { class: 'mg mg-ke', text: '科' }), ' 化科 ', h('span', { class: 'mg mg-ji', text: '忌' }), ' 化忌・', h('span', { class: 'legend-box decadal' }), ' 目前大限・', h('span', { class: 'legend-box yearly' }), ' 今年流年'),
      hs ? h('p', { class: 'small', text: `今年流年四化：${hs.yearlyMutagen.map((s, i) => `${s}化${'祿權科忌'[i]}`).join('、')}` }) : null,
      h('p', { class: 'hint', text: '點任一宮：下方顯示星曜解說，命盤上畫出它的三方四正。' }),
      detail,
      h('h3', { text: '命宮格局' }),
      (() => {
        const pats = mingPatterns(z);
        return pats.length
          ? h('ul', { class: 'reasons' }, pats.map((x) => h('li', { class: PATTERN_TONE[x.tone] }, h('b', { text: `${x.name}：` }), h('span', { text: x.text }))))
          : h('p', { text: '命宮沒有符合常見的特殊格局：照主星與三方四正的吉凶看即可，一般格局反而少大起大落。' });
      })(),
      h('p', { class: 'hint', text: '格局取各派共通、條件明確的說法；同一張盤常同時有吉格和凶格，兩邊都要看。' }),
      h('p', { class: 'hint', text: '排盤由 iztro 計算；星曜簡介為本 App 撰寫的一般性描述，僅供參考。' }),
      actions(p, 'ziwei', '紫微命盤', `命宮${z.soulBranch}・${z.fiveElementsClass}・命主${z.soul}`),
    );
  }

  // ── 瑪雅曆：上面是 13 月亮曆銀河印記，下面是瑪雅密碼 A～E（另一套算法，預設收起）
  async function drawMaya(p, input) {
    const [{ computeMaya, compareMaya }, { MAYA_POSITION_TEXT, MAYA_KEYWORD_TEXT }, MK, MT, MG] = await Promise.all([
      import('../core/maya.js'), import('../core/reading-texts.js'), import('../core/maya-kin.js'), import('../core/maya-texts.js'), import('../ui/maya-glyphs.js')]);
    const kinCards = mayaKinCards(p, input, MK, MT, MG);
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
      compareBlock = h('div', { class: 'field' }, h('span', { class: 'field-label', text: '合盤' }), sel,
        h('p', { class: 'hint', text: '合盤是把兩個人的 A～E 並排：數字一樣的位置（有底色），代表你們在那個面向有相同的課題，比較容易懂彼此；不一樣的地方是可以互相學習的部分。' }),
        table ? h('div', { class: 'table-wrap' }, table) : null);
    }
    // 瑪雅密碼是使用者提供的 V1 規則，和上面的 KIN 是不同算法：預設收起來，兩套數字才不會混在一起看。
    // 多胞胎預設打開：只有它能把出生時分加進去、把手足分開。
    const open = mayaCodeOpen === null ? !!p.birthOrder : mayaCodeOpen;
    const codeBox = h('details', { class: 'maya-code', open });
    const summary = h('summary', { onclick: () => { mayaCodeOpen = !codeBox.open; save('mayaCodeOpen', mayaCodeOpen); } },
      h('h2', { text: `${p.name}的瑪雅密碼 A～E` }), h('span', { class: 'muted small', text: '另一套算法（V1 規則）' }));
    return [...kinCards, h(
      'section',
      { class: 'card' },
      fill(codeBox, summary,
        h('p', { class: 'hint', text: '用生日數字加總的另一套算法（你先前提供的 V1 規則），和上面的 13 月亮曆銀河印記不是同一個系統，兩邊的數字不用互相對照。' }),
        h('div', { class: 'maya-grid' }, r.items.map((it) => h('div', { class: `maya-cell${it.key === 'C' ? ' wide' : ''}` }, h('div', { class: 'muted small', text: it.label }), h('div', { class: 'maya-value', text: it.value === null ? '—' : String(it.value) }), h('div', { text: it.keyword ? `${it.value % 10}｜${it.keyword}` : '不適用' })))),
        r.exception ? h('p', { class: 'hint', text: '1910–1921、2010–2021 年出生：依規則 A、B 不適用，C 為 10。' }) : null,
        h('details', { class: 'more', open: true }, h('summary', { text: '白話解說：每個位置代表什麼' }), h('ul', { class: 'plain' }, r.items.map((it) => h('li', {}, h('b', { text: MAYA_POSITION_TEXT[it.key] }), it.keyword ? h('div', { class: 'muted', text: `你的數字 ${it.value}「${it.keyword}」：${MAYA_KEYWORD_TEXT[it.keyword]}` }) : null)))),
        h('label', { class: 'check', for: 'maya-twin' }, twinBox, h('span', { text: input.time ? '雙胞胎分流（加上出生的時＋分）' : '雙胞胎分流需要出生時間' })),
        compareBlock,
        h('p', { class: 'hint', text: '計算規則依你提供的 V1 計算器重寫（規則原始出處沒驗到）；數字的關鍵字依個位數對照，文字為本 App 撰寫，可能與其他老師的版本不同。' }),
        actions(p, 'maya', '瑪雅密碼', r.items.map((it) => `${it.key}=${it.value ?? '—'}`).join(' '), { title: `${p.name}的瑪雅密碼`, lines: r.items.map((it) => `${it.label}：${it.value ?? '—'}${it.keyword ? `（${it.keyword}）` : ''}`) })),
    )];
  }

  // ── 瑪雅曆（13 月亮曆）銀河印記：圖騰＋調性、五大神諭、波符與 260 格卓爾金曆、20 圖騰總覽
  function mayaKinCards(p, input, MK, MT, MG) {
    const mine = MK.mayaKin(input.date);
    if (!mine) return [warnCard('生日不在 1800～2200 年之間，算不出瑪雅曆。')];
    const { kin, seal, tone, oracle } = mine;
    const ST = MT.SEAL_TEXT[seal.n];
    const TT = MT.TONE_TEXT[tone.n];
    const CT = MT.COLOR_TEXT[seal.color];
    const name = (k) => MK.kinInfo(k).title;
    const hero = h('section', { class: 'card feature maya-kin' },
      cardHead(h, 'sparkle', `${p.name}的瑪雅銀河印記`, '13 月亮曆・20 圖騰 × 13 調性'),
      h('div', { class: 'kin-hero' },
        playWhenVisible(h('div', { class: 'kin-glyph' }, MG.mayaGlyph(seal.n, { tone: tone.n, animate: true, label: `${mine.title}（KIN ${kin}）的圖騰與調性` }))),
        h('div', { class: 'kin-meta' },
          h('div', { class: 'kin-no', text: `KIN ${kin}` }),
          h('h3', { class: 'kin-title', text: mine.title }),
          h('div', { class: 'muted small', text: `圖騰 ${seal.n}・${seal.name}（${seal.maya}）　調性 ${tone.n}・${tone.name}` }),
          h('div', { class: 'chips' }, ST.keys.map((k) => h('span', { class: 'chip', text: k }))))),
      mine.leapDay ? h('p', { class: 'hint', text: `2 月 29 日在 13 月亮曆不算日子（0.0 Hunab Ku），這裡用 2 月 28 日的 KIN；也有人用 3 月 1 日的 KIN ${mine.altKin}（${name(mine.altKin)}），兩個都可以參考。` }) : null,
      h('p', { text: ST.gist }),
      h('ul', { class: 'reasons' },
        h('li', { class: 'tone-good' }, h('b', { text: '天賦：' }), h('span', { text: ST.gift })),
        h('li', { class: 'tone-info' }, h('b', { text: '容易卡住：' }), h('span', { text: ST.shadow })),
        h('li', { class: 'tone-info' }, h('b', { text: '小行動：' }), h('span', { text: ST.tip }))),
      h('div', { class: 'kin-tone' }, MG.toneGlyph(tone.n),
        h('div', {}, h('b', { text: `調性 ${tone.n}・${tone.name}：${TT.key}` }), h('div', { class: 'muted small', text: `問自己：${TT.q}` }), h('p', { text: TT.text }))),
      h('p', {}, h('b', { text: `${CT.name}家族（${CT.key}）：` }), h('span', { text: CT.text })),
      actions(p, 'maya', `瑪雅曆 KIN ${kin}`, `KIN ${kin} ${mine.title}`, {
        title: `${p.name}的瑪雅銀河印記`,
        big: `KIN ${kin}`,
        bigLabel: mine.title,
        lines: [`${seal.name}：${ST.keys.join('、')}`, `調性 ${tone.n} ${tone.name}：${TT.key}`, `引導 ${name(oracle.guide.kin)}・支持 ${name(oracle.analog.kin)}`, `挑戰 ${name(oracle.antipode.kin)}・隱藏推動 ${name(oracle.occult.kin)}`],
      }));

    // 五大神諭：十字排開（上引導、右支持、左挑戰、下隱藏推動），每張從中間飛到自己的位置
    const POS = [['guide', 'top'], ['antipode', 'left'], ['destiny', 'center'], ['analog', 'right'], ['occult', 'bottom']];
    const cross = playWhenVisible(h('div', { class: 'oracle-cross' }, POS.map(([key, area], i) => {
      const x = oracle[key];
      return h('figure', { class: `oracle-cell ${area}`, style: { '--i': String(i) } },
        MG.mayaGlyph(x.seal, { tone: x.tone, label: `${MT.ORACLE_TEXT[key].label}：KIN ${x.kin} ${name(x.kin)}` }),
        h('figcaption', {}, h('b', { text: MT.ORACLE_TEXT[key].label }), h('span', { text: name(x.kin) })));
    })));
    // 銀河印記合盤：和瑪雅密碼的合盤共用「和誰合盤」（compareId），換一個人兩邊一起換
    const others = ctx.getPeople().filter((x) => x.id !== p.id);
    let pairCard = null;
    if (others.length) {
      const sel = h('select', { 'aria-label': '和誰合盤（銀河印記）', onchange: (e) => { compareId = e.target.value || null; render(); } }, h('option', { value: '', text: '和誰合盤？' }), others.map((x) => h('option', { value: x.id, text: x.name })));
      sel.value = compareId && others.some((x) => x.id === compareId) ? compareId : '';
      const other = others.find((x) => x.id === sel.value);
      const oi = other ? ctx.inputOf(other) : null;
      const theirs = oi ? MK.mayaKin(oi.date) : null;
      let body = h('p', { class: 'muted small', text: '選一個人：看你們的圖騰落在彼此五大神諭的哪個位置，也就是對方常在你生活裡扮演什麼角色。' });
      if (theirs) {
        const r = MK.pairRelation(theirs.kin, kin);
        const ROLES = ['analog', 'antipode', 'occult', 'guide'];
        const say = (type, who) => (type === 'color' ? `同屬${MT.COLOR_TEXT[who.seal.color].name}家族：${MT.PAIR_RELATION_TEXT.color}` : MT.PAIR_RELATION_TEXT[type]);
        const figure = (x, label) => h('figure', { class: 'pair-kin' }, MG.mayaGlyph(x.seal.n, { tone: x.tone.n, label: `${label}：KIN ${x.kin} ${x.title}` }), h('figcaption', {}, h('b', { text: label }), h('span', { text: `KIN ${x.kin} ${x.title}` })));
        body = [
          h('div', { class: 'pair-row' }, figure(mine, p.name), figure(theirs, other.name)),
          h('ul', { class: 'reasons' },
            // 位置類（支持、挑戰、隱藏推動、引導）說「誰落在誰的哪個位置」；同 KIN、同圖騰、同色、沒有連結是兩個人一起的狀態
            r.otherInMine === r.mineInOther
              ? h('li', { class: 'tone-good' }, h('b', { text: ROLES.includes(r.otherInMine) ? '你們互相落在對方的' : '你們兩個：' }), h('span', { text: say(r.otherInMine, mine) }))
              : [
                ROLES.includes(r.otherInMine) ? h('li', { class: 'tone-good' }, h('b', { text: `${other.name}落在你的` }), h('span', { text: say(r.otherInMine, mine) })) : null,
                ROLES.includes(r.mineInOther) ? h('li', { class: 'tone-good' }, h('b', { text: `你落在${other.name}的` }), h('span', { text: say(r.mineInOther, theirs) })) : null,
                r.otherInMine === 'color' || r.mineInOther === 'color' ? h('li', { class: 'tone-good' }, h('b', { text: '你們兩個：' }), h('span', { text: say('color', mine) })) : null,
              ],
            r.sameTone ? h('li', { class: 'tone-info', text: `同調性「${tone.name}」：做事的節奏相近，${MT.TONE_TEXT[tone.n].key}是你們共同的功課。` }) : null,
            r.sameWavespell ? h('li', { class: 'tone-info', text: `出生在同一個波符（${mine.wavespell.seal.name}波符）：人生大方向的主題相似。` }) : null),
          h('p', { class: 'hint', text: MT.PAIR_NOTE }),
        ];
      } else if (other) {
        body = h('p', { class: 'warn', text: `${other.name}的生日資料不完整，算不出瑪雅曆；請到「我的」編輯重新儲存。` });
      }
      pairCard = h('section', { class: 'card' },
        cardHead(h, 'heart', '銀河印記合盤', '你們落在彼此五大神諭的哪個位置'),
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: '和誰合盤' }), sel),
        body);
    }

    const oracleCard = h('section', { class: 'card' },
      cardHead(h, 'compass', '五大神諭', '中間是你，上引導、右支持、左挑戰、下隱藏推動'),
      cross,
      h('ul', { class: 'plain oracle-list' }, ['guide', 'analog', 'antipode', 'occult'].map((key) => {
        const x = oracle[key];
        const xt = MT.SEAL_TEXT[x.seal];
        return h('li', {},
          h('b', { text: `${MT.ORACLE_TEXT[key].label}（${MT.ORACLE_TEXT[key].pos}）：KIN ${x.kin} ${name(x.kin)}` }),
          h('div', { class: 'muted small', text: MT.ORACLE_TEXT[key].text }),
          h('div', { text: `關鍵字：${xt.keys.join('、')}。${xt.gift}` }));
      })),
      h('details', { class: 'more' }, h('summary', { text: '五大神諭怎麼算' }),
        h('p', { class: 'small', text: '引導：同調性、同顏色，依調性的點數決定是哪一個（調性 1、6、11 的引導就是自己）。支持：同調性，兩個圖騰號碼相加是 19。挑戰：同調性，圖騰號碼差 10。隱藏推動：兩個 KIN 相加是 261（圖騰 21 減、調性 14 減）。' })));

    // 波符與卓爾金曆：你的 KIN 金框、今天虛線框、你的波符 13 天顏色深一點
    const today = MK.kinOf(zoneToday(DEFAULT_TZ));
    const ws = mine.wavespell;
    const wsEnd = ((ws.kin + 11) % 260) + 1;
    const wst = MT.SEAL_TEXT[ws.seal.n];
    const gridCard = h('section', { class: 'card' },
      cardHead(h, 'calendar', '波符與卓爾金曆', '260 天一輪的節奏'),
      h('p', {}, h('b', { text: `你在「${ws.seal.name}波符」的第 ${ws.day} 天` }), h('span', { text: `（第 ${ws.index} 個波符：KIN ${ws.kin}～${wsEnd}）` })),
      h('p', { text: `波符的主題是${ws.seal.name}（${wst.keys.join('、')}）：${wst.gist}` }),
      h('p', { class: 'muted small', text: MT.WAVESPELL_TEXT }),
      playWhenVisible(h('div', { class: 'tz-wrap' }, MG.tzolkinGrid({ kin, today, label: `卓爾金曆 260 格：你的 KIN ${kin} 在第 ${Math.ceil(kin / 20)} 欄第 ${((kin - 1) % 20) + 1} 列；今天是 KIN ${today}` }))),
      h('div', { class: 'tz-legend small' },
        h('span', { class: 'k-me', text: `你：KIN ${kin}` }),
        h('span', { class: 'k-today', text: `今天：KIN ${today} ${name(today)}` }),
        h('span', { class: 'k-ws', text: '你的波符' })),
      h('p', { class: 'hint', text: '一欄 20 天、共 13 欄，由上往下、由左往右數；顏色是圖騰的顏色。' }));

    // 20 圖騰與 13 調性總覽：點圖騰看說明（先打開自己的）
    const detail = h('div', { class: 'seal-detail', 'aria-live': 'polite' });
    const btns = [];
    function showSeal(n) {
      const sd = MK.SEALS[n - 1];
      const t = MT.SEAL_TEXT[n];
      btns.forEach((b, i) => b.setAttribute('aria-pressed', i + 1 === n ? 'true' : 'false'));
      fill(detail,
        h('h3', { text: `${n}. ${sd.name}（${sd.maya}）${n === seal.n ? '・你的圖騰' : ''}` }),
        h('div', { class: 'chips' }, t.keys.map((k) => h('span', { class: 'chip', text: k }))),
        h('p', { text: t.gist }),
        h('ul', { class: 'reasons' },
          h('li', { class: 'tone-good' }, h('b', { text: '天賦：' }), h('span', { text: t.gift })),
          h('li', { class: 'tone-info' }, h('b', { text: '容易卡住：' }), h('span', { text: t.shadow })),
          h('li', { class: 'tone-info' }, h('b', { text: '小行動：' }), h('span', { text: t.tip }))));
    }
    const gallery = h('div', { class: 'seal-gallery' }, MK.SEALS.map((sd) => {
      const b = h('button', { type: 'button', class: 'seal-btn', 'aria-pressed': 'false', onclick: () => showSeal(sd.n) }, MG.mayaGlyph(sd.n), h('span', { text: `${sd.n}. ${sd.name}` }));
      btns.push(b);
      return b;
    }));
    showSeal(seal.n);
    const allCard = h('section', { class: 'card' },
      cardHead(h, 'book', '20 圖騰與 13 調性', '點圖騰看說明'),
      gallery,
      detail,
      h('details', { class: 'more' }, h('summary', { text: '13 個調性（瑪雅數字：一條線＝5、一個點＝1）' }),
        h('ul', { class: 'plain tone-list' }, MK.TONES.map((t) => h('li', {}, MG.toneGlyph(t.n),
          h('div', {}, h('b', { text: `${t.n}・${t.name}：${MT.TONE_TEXT[t.n].key}` }), h('div', { class: 'muted small', text: `${MT.TONE_TEXT[t.n].q}${MT.TONE_TEXT[t.n].text}` })))))),
      h('details', { class: 'more' }, h('summary', { text: '四種顏色' }),
        h('ul', { class: 'plain' }, Object.values(MT.COLOR_TEXT).map((c) => h('li', {}, h('b', { text: `${c.name}（${c.key}）：` }), h('span', { text: c.text }))))),
      h('p', { class: 'hint', text: MT.MAYA_NOTE }));
    return [hero, oracleCard, pairCard, gridCard, allCard].filter(Boolean);
  }

  // ── 生命靈數
  async function drawNumerology(p, input, opts) {
    const [{ lifePath, grid, gridWithTalent, MEANINGS, MISSING_TEXT, MANY_TEXT }, { LIFEPATH_DETAIL }, { personalYearNumber, PERSONAL_YEAR }] = await Promise.all([import('../core/numerology.js'), import('../core/reading-texts.js'), import('../core/reading.js')]);
    const lp = lifePath(input.date);
    const g = grid(input.date);
    const alt = gridWithTalent(input.date);
    const year = opts.today.y;
    const py = personalYearNumber(input.date, year);
    const LAYOUT = [3, 6, 9, 2, 5, 8, 1, 4, 7];
    // 連線疊在九宮格後面：格子 64px、間距 8px，第 i 格的中心在 (32 + 72×欄, 32 + 72×列)
    const POS = Object.fromEntries(LAYOUT.map((n, i) => [n, [32 + (i % 3) * 72, 32 + Math.floor(i / 3) * 72]]));
    const lines = svg('svg', { viewBox: '0 0 208 208', class: 'nine-lines', 'aria-hidden': 'true' },
      g.lines.map((l, i) => svg('line', { x1: POS[l.nums[0]][0], y1: POS[l.nums[0]][1], x2: POS[l.nums[2]][0], y2: POS[l.nums[2]][1], pathLength: 1, class: 'nine-line', style: { '--i': String(i) } })));
    const extraLines = alt.lines.filter((l) => !g.lines.includes(l));
    return h(
      'section',
      { class: 'card' },
      h('h2', { text: `${p.name}的生命靈數` }),
      // 圓環只放主命數（最多兩位數）：整串「32／5」在 iPhone 的字型下比圓環內徑寬，會超出去
      h('div', { class: 'score-hero' }, ringTo(h('div', { class: 'score-ring lv-mid', role: 'img', 'aria-label': `主命數 ${lp.number}` }, h('b', { text: String(lp.number) }), h('small', { text: '主命數' })), 100),
        h('div', {}, h('h3', { text: lp.title }), h('p', { class: 'muted small', text: `生日數字加總：${lp.label}` }), h('p', { text: lp.text }))),
      h('ul', { class: 'reasons' },
        h('li', { class: 'tone-info', text: `事業：${LIFEPATH_DETAIL[lp.number].career}` }),
        h('li', { class: 'tone-info', text: `感情：${LIFEPATH_DETAIL[lp.number].love}` }),
        lp.talent.length ? h('li', { class: 'tone-good', text: `天賦數 ${lp.total}（${lp.talent.map((n) => `${n} ${MEANINGS[n].title}`).join('、')}）：生日加總的兩位數，代表天生帶來、比較不費力的能力。` }) : null,
        h('li', { class: 'tone-info', text: `${year} 年的流年數是 ${py}：${PERSONAL_YEAR[py]}` })),
      h('h3', { text: '九宮格' }),
      playWhenVisible(h('div', { class: 'nine-wrap' }, lines,
        h('div', { class: 'nine-grid', role: 'img', 'aria-label': `九宮格：有 ${LAYOUT.filter((n) => g.counts[n]).join('、')}；空缺 ${g.missing.join('、') || '沒有'}` },
          LAYOUT.map((n) => h('div', { class: `nine-cell${g.counts[n] ? ' on' : ''}${g.counts[n] >= 3 ? ' many' : ''}` }, h('b', { text: String(n) }), g.counts[n] > 1 ? h('small', { text: `×${g.counts[n]}` }) : null))))),
      h('p', { class: 'muted small center', text: '圈起來的是生日出現的數字；金線是完整的連線（三個數字都有）。' }),
      g.lines.length
        ? h('ul', { class: 'reasons' }, g.lines.map((l) => h('li', { class: 'tone-good' }, h('b', { text: `${l.nums.join('-')} ${l.name}：` }), h('span', { text: l.text }))))
        : h('p', { text: '沒有完整的連線：特質比較分散、不偏向某一種，彈性大，也比較需要自己找方向。' }),
      g.missing.length ? [h('h3', { text: `空缺數：${g.missing.join('、')}` }), h('ul', { class: 'reasons' }, g.missing.map((n) => h('li', { class: 'tone-info' }, h('b', { text: `缺 ${n}：` }), h('span', { text: MISSING_TEXT[n] }))))] : h('p', { text: '1 到 9 都有：沒有空缺數，各方面的特質都具備。' }),
      g.many.length ? h('ul', { class: 'reasons' }, g.many.map((n) => h('li', { class: 'tone-bad' }, h('b', { text: `${n} 出現 ${g.counts[n]} 次：` }), h('span', { text: MANY_TEXT[n] })))) : null,
      lp.talent.length
        ? h('details', { class: 'more' },
          h('summary', { text: '另一派：天賦數、生命數也圈進去' }),
          h('p', { text: `有些老師會把天賦數 ${lp.talent.join('、')} 和生命數 ${lp.number} 也圈進九宮格。這樣算的話：${extraLines.length ? `多了${extraLines.map((l) => l.name).join('、')}` : '連線沒有變多'}；空缺數${alt.missing.length ? `剩 ${alt.missing.join('、')}` : '全部補齊'}。` }),
          h('p', { class: 'hint', text: '兩種圈法各有老師採用，沒有定論；App 以只圈生日數字為主，這裡列出來給你對照。' }))
        : null,
      h('p', { class: 'hint', text: '以西元生日計算；連線名稱為台灣常見說法，各派略有不同。解說為本 App 撰寫，僅供參考。' }),
      actions(p, 'numerology', '生命靈數', `${lp.label} ${lp.title}`, { title: `${p.name}的生命靈數`, big: lp.label, bigLabel: lp.title, lines: [lp.text, g.lines.length ? `連線：${g.lines.map((l) => l.name).join('、')}` : '', g.missing.length ? `空缺數：${g.missing.join('、')}` : ''].filter(Boolean) }),
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
    const { missing, edgeNote } = prof;
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
        a.points.map((pt) => h('div', { class: 'point' }, h('span', { class: `sys sys-${pt.system}`, text: pt.system }), h('span', { text: pt.text }))),
        // 今年只是一年：要看哪幾年要注意、哪幾年順，直接跳到人生時間軸
        a.id === 'year' ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn small', text: '看未來 10 年的人生時間軸', onclick: () => { tool = 'liunian'; save('destinyTool', tool); render(); window.scrollTo(0, 0); } })) : null,
        a.id === 'career' ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn small', text: '看工作與未來方向（含新興產業）', onclick: () => { tool = 'career'; save('destinyTool', tool); render(); window.scrollTo(0, 0); } })) : null),
    ));
    const cards = [
      h(
        'section',
        { class: 'card feature' },
        cardHead(h, 'book', `${p.name}的綜合解讀`, '星座・八字・紫微・生命靈數・瑪雅・姓名・稱骨・血型'),
        edgeNote ? h('p', { class: 'warn', text: edgeNote }) : null,
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

    // ── 比較表：綜合分、人格、總格、三才（分數不含八字，不同名字可以直接比；分數最高的標 ★）
    const showFull = (name) => {
      nameInput.value = name;
      surSel.value = '0';
      analyze();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const cmpTable = (items, { baziCol = false } = {}) => {
      const best = Math.max(...items.filter((x) => x.r.ok).map((x) => x.r.score));
      return h('div', { class: 'table-wrap' }, h('table', { class: 'compare name-cmp' },
        h('thead', {}, h('tr', {}, ['名字', '綜合分', '人格', '總格', '三才', baziCol ? '補到喜用' : null].filter(Boolean).map((t) => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, items.map(({ label, name, r, tools }) => h('tr', { class: r.ok && r.score === best && items.length > 1 ? 'best' : '' },
          h('th', { scope: 'row' }, h('div', { text: name }), label ? h('div', { class: 'muted small', text: label }) : null, tools ? h('div', { class: 'cmp-tools' }, tools) : null),
          ...(r.ok
            ? [
              h('td', { text: `${r.score}${r.score === best && items.length > 1 ? ' ★' : ''}` }),
              h('td', { text: `${r.grids.人格.value}・${r.grids.人格.gradeText}` }),
              h('td', { text: `${r.grids.總格.value}・${r.grids.總格.gradeText}` }),
              h('td', { text: `${r.sancai.elements}・${r.sancai.gradeText}` }),
              baziCol ? h('td', { text: r.bazi && r.bazi.helps.length ? r.bazi.helps.join('、') : '沒有' }) : null,
            ]
            : [h('td', { colspan: baziCol ? 5 : 4, class: 'muted small', text: '有罕用字查不到筆畫：按「看完整分析」補筆畫' })]))))));
    };

    // ── 藝名、筆名：存在這個人底下，和本名並排比較
    const alts = p.altNames || [];
    const kindSel = h('select', { 'aria-label': '名字種類' }, ALT_NAME_KINDS.map((k) => h('option', { value: k, text: k })));
    const altInput = h('input', { type: 'text', maxlength: 6, 'aria-label': '藝名或筆名', placeholder: '例如：王明星' });
    const saveAlts = (list, msg) => {
      const saved = ctx.savePerson({ ...p, altNames: list });
      ctx.toast(saved.ok ? msg : saved.error || '儲存失敗');
    };
    const altItems = [
      ...(p.fullName ? [{ label: '本名', name: p.fullName, r: NM.analyzeName(p.fullName, data, { bazi }), tools: [h('button', { type: 'button', class: 'link', text: '看完整分析', onclick: () => showFull(p.fullName) })] }] : []),
      ...alts.map((a) => ({
        label: a.kind,
        name: a.name,
        r: NM.analyzeName(a.name, data, { bazi }),
        tools: [
          h('button', { type: 'button', class: 'link', text: '看完整分析', onclick: () => showFull(a.name) }),
          h('button', { type: 'button', class: 'link', text: '移除', 'aria-label': `移除${a.kind}「${a.name}」`, onclick: () => saveAlts(alts.filter((x) => x.name !== a.name), `已移除${a.kind}「${a.name}」`) }),
        ],
      })),
    ];
    const altCard = h('section', { class: 'card' },
      cardHead(h, 'pen', '藝名、筆名', '和本名並排比較，存在這支手機'),
      alts.length ? cmpTable(altItems) : h('p', { class: 'muted', text: p.fullName ? '還沒有加藝名或筆名。加了會和本名並排比較。' : '還沒有加藝名或筆名；在上面設好本名，就能一起比較。' }),
      alts.length < 3
        ? [
          h('div', { class: 'row2' }, h('div', { class: 'field' }, h('span', { class: 'field-label', text: '種類' }), kindSel), h('div', { class: 'field' }, h('span', { class: 'field-label', text: '名字' }), altInput)),
          h('div', { class: 'actions' }, h('button', {
            type: 'button',
            class: 'btn',
            text: '加入比較',
            onclick: () => {
              const v = altInput.value.trim();
              if (!/^\p{Script=Han}{2,6}$/u.test(v)) return ctx.toast('請輸入 2～6 個中文字');
              if (v === p.fullName || alts.some((a) => a.name === v)) return ctx.toast('這個名字已經在表上了');
              saveAlts([...alts, { kind: kindSel.value, name: v }], `已加入${kindSel.value}「${v}」（只在這支手機）`);
            },
          })),
        ]
        : h('p', { class: 'hint', text: '最多 3 個；要換的話先移除一個。' }),
      h('p', { class: 'hint', text: '常被叫的名字（藝名、筆名、大家平常叫的名字）姓名學一樣可以看，分數高低參考就好。' }),
    );

    // ── 匿名試算：幫朋友看、取名時比較候選名字；不存、不進紀錄
    const trialBox = h('div', { 'aria-live': 'polite' });
    const trialInput = h('input', { type: 'text', maxlength: 6, 'aria-label': '要試算的名字', placeholder: '例如：林小雨', enterkeyhint: 'done', onkeydown: (e) => { if (e.key === 'Enter') addTrial(); } });
    const baziId = nextId('trial-bazi');
    function paintTrial() {
      const items = trial.names.map((n) => ({
        name: n,
        r: NM.analyzeName(n, data, { bazi: trial.bazi ? bazi : null }),
        tools: [
          h('button', { type: 'button', class: 'link', text: '看完整分析', onclick: () => showFull(n) }),
          h('button', { type: 'button', class: 'link', text: '移除', 'aria-label': `移除「${n}」`, onclick: () => { trial.names = trial.names.filter((x) => x !== n); paintTrial(); } }),
        ],
      }));
      fill(trialBox, items.length ? cmpTable(items, { baziCol: trial.bazi && !!bazi }) : h('p', { class: 'muted', text: '還沒有加名字。一次可以比 6 個。' }));
    }
    function addTrial() {
      const v = trialInput.value.trim();
      if (!/^\p{Script=Han}{2,6}$/u.test(v)) return ctx.toast('請輸入 2～6 個中文字');
      if (trial.names.includes(v)) return ctx.toast('這個名字已經在表上了');
      if (trial.names.length >= 6) return ctx.toast('一次最多比 6 個，先移除一個');
      trial.names = [...trial.names, v];
      trialInput.value = '';
      paintTrial();
    }
    paintTrial();
    const trialCard = h('section', { class: 'card' },
      cardHead(h, 'pen', '匿名試算', '不儲存：幫朋友看、比較候選名字'),
      h('div', { class: 'field' }, h('span', { class: 'field-label', text: '名字（含姓氏）' }), trialInput),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn', text: '加入比較', onclick: addTrial })),
      bazi ? h('label', { class: 'check', for: baziId }, h('input', { type: 'checkbox', id: baziId, checked: trial.bazi, onchange: (e) => { trial.bazi = e.target.checked; paintTrial(); } }), h('span', { text: `配合${p.name}的八字，看名字補不補得到喜用五行（取名時用）` })) : null,
      trialBox,
      h('p', { class: 'hint', text: '這裡的名字不會存檔、不會進紀錄，重新開啟 App 就清掉；分數不含八字，可以直接比較。' }),
    );
    return [card, altCard, trialCard];
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
