// 命理 → 掌紋：看圖自選（主要）＋拍照描線（選用）；斷掌、四大線、掌形、厚薄、左右手比較。
// 照片處理與描線畫布在 ui/palm-photo.js；照片只畫在畫面上，不存、不上傳；
// 選好的線形按「存到資料」才寫進名單（records.js 白名單過濾），沒按就只留在這次開著的 App 裡。

import { h, fill, segmented } from '../ui/dom.js';
import { load, save, remove } from '../ui/storage.js';
import { cardHead, icon } from '../ui/icons.js';
import { traitScale } from '../ui/widgets.js';
import { playWhenVisible } from '../ui/motion.js';
import { palmDiagram, palmThumb, diagramFields, traceGuide, photoExamples, practicePalm, PRACTICE_ANSWER } from '../ui/palm-chart.js';
import {
  CALIB, newPhoto, freePhoto, readPhoto, enhancedCanvas, sampleGray, frameOf, uvTraces, copyStrokes, tracedLines, changedLines, photoCanvas,
} from '../ui/palm-photo.js';
import {
  activeFields, sanitizePicks, simplifyStroke, suggestPicks, photoAdvice, compareHands, handRole, mainHand, HAND_SCHOOLS,
  mergeSuggestions, TRACE_LINES,
} from '../core/palm.js';
import { createUndo } from '../core/undo.js';
import { locateHand, TOTAL_MB as MP_MB } from '../ui/hand-detect.js';
import { PALM_TEXT, PALM_HOW, SIMIAN_NOTE, PALM_DISCLAIMER, palmReading, handDiffText, roleText } from '../core/palm-texts.js';

const HAND_NAME = { left: '左手', right: '右手' };
const QUESTION = {
  simian: '感情線和智慧線是分開的，還是連成一條橫線？',
  life: '生命線（繞著拇指根部的弧線）長什麼樣子？',
  head: '智慧線（從拇指和食指中間，往小指那側橫過去）長什麼樣子？',
  start: '智慧線的起點，和生命線連在一起嗎？',
  heart: '感情線（小指下方往食指方向的線）走到哪裡？',
  fate: '事業線（從手腕往中指方向的直線）長什麼樣子？',
  shape: '整個手掌和手指，比較像哪一種？',
  thick: '從側面看，手掌的厚度如何？',
};
const TARGETS = [
  { value: 'life', label: '生命線' },
  { value: 'head', label: '智慧線' },
  { value: 'heart', label: '感情線' },
  { value: 'fate', label: '事業線' },
  { value: 'simian', label: '斷掌線' },
];
const LINE_NAME = Object.fromEntries(TARGETS.map((t) => [t.value, t.label]));
const MAIN_LINES = ['life', 'head', 'heart', 'fate'];
// 每條線從哪裡描到哪裡（示範圖同時畫出起點和方向）
const TRACE_HOW = {
  life: '從拇指和食指中間開始，沿著拇指根部的弧線往手腕描。',
  head: '從拇指和食指中間開始，往小指那側橫著描到線的尾端。',
  heart: '從小指下方的手掌邊緣開始，往食指、中指的方向描。',
  fate: '從手腕中間往中指的方向，由下往上描；沒有這條線就跳過。',
  simian: '只有感情線和智慧線連成一條、橫過整個手掌時才描：從小指那側描到拇指那側。',
};
// 練習時描得和範例不一樣：告訴他差在哪
const PRACTICE_TIP = {
  life: '試著從拇指和食指中間一路描到手腕附近。',
  head: '描到線的尾端，往下斜的那段也要描到。',
  heart: '從小指下方的邊緣開始，描到食指和中指之間。',
  fate: '從手腕一路往上描到中指下方。',
};
const TRACE_FIELDS = ['life', 'head', 'heart', 'fate', 'simian', 'start'];
const FIELD_NAME = { life: '生命線', head: '智慧線', heart: '感情線', fate: '事業線', simian: '斷掌', start: '智慧線起點' };

// 整個命理分頁會重畫（例如按了儲存），畫到一半的選擇和照片要留著：放在模組層級，只在記憶體裡。
// hist：兩隻手各自的復原紀錄；enhance：「加強掌紋」開著沒（換照片也保留）；note：剛發生的事（復原了什麼、筆畫太短）
const session = {
  personId: null, hand: 'right', school: 'gender', dominant: '', picks: { left: {}, right: {} }, dirty: false, step: { left: 0, right: 0 },
  photos: { left: null, right: null }, hist: { left: createUndo(), right: createUndo() }, target: 'life', enhance: false, note: null,
};
const SCHOOL_IDS = HAND_SCHOOLS.map((x) => x.id);

/**
 * 換照片、開始練習或換人：舊照片和復原紀錄裡留著的照片（「清除照片」可以復原，所以先留著）一起放掉，復原紀錄清空
 */
function setPhoto(hand, ph) {
  const olds = new Set([session.photos[hand], ...session.hist[hand].states().map((st) => st.ph)]);
  for (const old of olds) if (old && old !== ph) freePhoto(old);
  session.hist[hand].clear();
  session.photos[hand] = ph;
  session.note = null;
  session.target = 'life'; // 新照片什麼都還沒描：從第一條線開始，不要停在上一張照片最後描的線
}

// 復原用的狀態：照片本身（參照）＋校正點、筆畫的淺拷貝（點陣列建立後不再修改）
function snap(hand) {
  const ph = session.photos[hand];
  return ph ? { ph, calib: { ...ph.calib }, strokes: copyStrokes(ph.strokes), advice: ph.advice, sideOk: ph.sideOk } : { ph: null };
}

// 草稿：iPhone 切到 LINE 再回來常常整頁重載，還沒按儲存的選擇會不見。每次改動就把選項代碼（不含照片）
// 暫存在這支手機，回來時接上；按儲存或「放棄修改」就刪掉，放超過 7 天也不接
const DRAFT_KEY = 'palmDraft';
const DRAFT_MS = 7 * 86400000;
const palmJson = (x) => JSON.stringify({ school: x.school || 'gender', dominant: x.dominant || '', left: sanitizePicks(x.left), right: sanitizePicks(x.right) });
function saveDraft() {
  save(DRAFT_KEY, { personId: session.personId, hand: session.hand, school: session.school, dominant: session.dominant, left: session.picks.left, right: session.picks.right, at: Date.now() });
}
function takeDraft(p) {
  const d = load(DRAFT_KEY, null);
  if (!d || d.personId !== p.id || !(Date.now() - Number(d.at) < DRAFT_MS)) return null;
  if (palmJson(d) === palmJson(p.palm || {})) return null; // 和已儲存的一樣，不用接
  return d;
}

/** 第一次打開先看哪隻手：看法有主要的手就看那隻（除非資料只選在另一隻手），否則看有選的那隻，都沒有就右手 */
function startHand(p) {
  const has = (hand) => Object.keys(session.picks[hand]).length > 0;
  const main = mainHand(session.school, { gender: p.gender || '', dominant: session.dominant });
  if (main && (has(main) || (!has('left') && !has('right')))) return main;
  return has('left') && !has('right') ? 'left' : 'right';
}

function loadSaved(p) {
  const saved = p.palm || {};
  // 沒選過看法的人預設傳統的「男左女右」（依名單裡的性別決定主要看哪隻手）
  session.school = SCHOOL_IDS.includes(saved.school) ? saved.school : 'gender';
  session.dominant = saved.dominant || '';
  session.picks = { left: sanitizePicks(saved.left), right: sanitizePicks(saved.right) };
}

/**
 * @param p 名單上的人
 * @param kit destiny.js 的共用工具（ctx、actions）
 */
export function drawPalm(p, { ctx, actions }) {
  if (session.personId !== p.id) {
    session.personId = p.id;
    loadSaved(p);
    session.hand = startHand(p);
    session.dirty = false;
    session.restored = false;
    session.step = { left: 0, right: 0 };
    setPhoto('left', null);
    setPhoto('right', null);
    const draft = takeDraft(p);
    if (draft) {
      session.picks = { left: sanitizePicks(draft.left), right: sanitizePicks(draft.right) };
      session.dominant = draft.dominant === 'left' || draft.dominant === 'right' ? draft.dominant : '';
      if (SCHOOL_IDS.includes(draft.school)) session.school = draft.school;
      if (draft.hand === 'left' || draft.hand === 'right') session.hand = draft.hand;
      session.dirty = true;
      session.restored = true;
    }
  } else if (!session.dirty) {
    loadSaved(p); // 沒有未儲存的修改：以名單裡存的為準（例如剛匯入備份）
  }

  const pickerBox = h('div', {});
  const photoBox = h('div', {});
  const resultBox = h('div', { 'aria-live': 'polite' });
  const roleLine = h('p', { class: 'muted small' });
  const genderHint = h('div', {});
  let advanceTimer = null;

  const picks = () => session.picks[session.hand];
  const fields = () => activeFields(picks());

  function setPick(field, value) {
    const cur = picks();
    cur[field] = value;
    if (field === 'simian' && value === 'full') for (const k of ['head', 'start', 'heart']) delete cur[k];
    session.picks[session.hand] = sanitizePicks(cur);
    session.dirty = true;
    saveDraft();
  }

  // 目前的看法（給 handRole、roleText、handDiffText 共用）
  const view = () => ({ school: session.school, gender: p.gender || '', dominant: session.dominant });

  function paintRole() {
    const role = handRole(session.hand, view());
    roleLine.textContent = roleText(session.hand, session.school, view(), role);
    // 男左女右卻還沒填性別：直接給一個按鈕去補，不只是說明
    fill(genderHint, session.school === 'gender' && !role ? h('button', { type: 'button', class: 'btn small', text: '到「我的」選性別', onclick: () => ctx.go('me') }) : null);
  }

  // ── 看圖自選：一次一題，選完自動跳下一題
  function paintPicker() {
    const list = fields();
    const hand = session.hand;
    let i = Math.min(session.step[hand], list.length - 1);
    if (i < 0) i = 0;
    session.step[hand] = i;
    const field = list[i];
    const cur = picks()[field.id] || '';
    const chips = h('div', { class: 'palm-steps', role: 'group', 'aria-label': '各題目前的選擇' }, list.map((f, j) => h('button', {
      type: 'button',
      class: `palm-step${j === i ? ' on' : ''}${picks()[f.id] ? ' done' : ''}`,
      'aria-pressed': j === i ? 'true' : 'false',
      onclick: () => { session.step[hand] = j; paintPicker(); },
      // 橫向捲動列：Tab 到畫面外的按鈕時瀏覽器只捲出一角，要自己捲到整顆看得到
      onfocus: (e) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    }, h('b', { text: f.label }), h('span', { text: picks()[f.id] ? PALM_TEXT[f.id][picks()[f.id]].label : '未選' }))));
    // 目前這題的按鈕捲到中間（只動這一列，不動整頁）
    requestAnimationFrame(() => {
      const on = chips.querySelector('.on');
      if (on && chips.isConnected) chips.scrollLeft = Math.max(0, on.offsetLeft - (chips.clientWidth - on.offsetWidth) / 2);
    });
    const options = h('div', { class: `palm-options n${field.options.length}`, role: 'group', 'aria-label': field.label }, field.options.map((opt) => h('button', {
      type: 'button',
      class: `palm-opt${opt === cur ? ' on' : ''}`,
      'aria-pressed': opt === cur ? 'true' : 'false',
      onclick: () => {
        setPick(field.id, opt);
        paintPicker();
        paintResult();
        clearTimeout(advanceTimer);
        // 停一下讓人看到自己選了哪個，再跳到下一題沒選的
        advanceTimer = setTimeout(() => {
          const now = fields();
          const at = now.findIndex((f) => f.id === field.id);
          const nextOpen = now.findIndex((f, j) => j > at && !picks()[f.id]);
          if (nextOpen >= 0 || at < now.length - 1) {
            session.step[hand] = nextOpen >= 0 ? nextOpen : at + 1;
            if (session.hand === hand && pickerBox.isConnected) paintPicker();
          }
        }, 320);
      },
    }, palmThumb(field.id, opt, hand), h('span', { text: PALM_TEXT[field.id][opt].label }))));
    fill(
      pickerBox,
      chips,
      h('h3', { class: 'palm-q' }, h('span', { class: 'badge', text: `${i + 1}／${list.length}` }), ' ', h('span', { text: QUESTION[field.id] })),
      options,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn small', text: '上一題', disabled: i === 0, onclick: () => { session.step[hand] = i - 1; paintPicker(); } }),
        i < list.length - 1
          ? h('button', { type: 'button', class: 'btn small', text: cur ? '下一題' : '先跳過', onclick: () => { session.step[hand] = i + 1; paintPicker(); } })
          : h('button', { type: 'button', class: 'btn small primary', text: '看結果', onclick: () => resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' }) })),
    );
  }

  // ── 拍照描線
  const curPhoto = () => session.photos[session.hand];
  // 復原了什麼、筆畫太短這類訊息：同一個元素一直留著，螢幕閱讀器才會念出新內容
  const noteLine = h('p', { class: 'palm-note small', 'aria-live': 'polite' });

  /** 描線變了就重新判斷：只更新受影響的欄位，自己改過的保留（mergeSuggestions）；練習用的手掌不填 */
  function applySuggestions(lines) {
    const ph = curPhoto();
    if (!ph || ph.demo || !lines.length || !frameOf(ph)) return;
    const st = mergeSuggestions(picks(), ph.applied, suggestPicks(uvTraces(ph)), lines);
    ph.applied = st.applied;
    if (JSON.stringify(st.picks) === JSON.stringify(picks())) return;
    session.picks[session.hand] = st.picks;
    session.dirty = true;
    saveDraft();
  }

  /** 每個會改照片狀態的動作：先記下動作之前的樣子（給復原用） */
  function record(label) {
    session.hist[session.hand].push(label, snap(session.hand));
    session.note = null;
  }
  const repaintAfter = () => {
    paintPhoto();
    paintPicker();
    paintResult();
  };

  function restore(state, verb, label) {
    const hand = session.hand;
    const before = session.photos[hand];
    // 先比對再改：before 和 state.ph 常常是同一張照片（同一個物件）
    const lines = before && before === state.ph ? changedLines(before, state) : [];
    session.photos[hand] = state.ph;
    const ph = state.ph;
    if (ph) {
      ph.calib = { ...state.calib };
      ph.strokes = copyStrokes(state.strokes);
      ph.advice = state.advice;
      ph.sideOk = state.sideOk;
    }
    applySuggestions(lines);
    session.note = { hand, text: `${verb}：${label}` };
    repaintAfter();
  }
  const undo = () => {
    const e = session.hist[session.hand].undo(snap(session.hand));
    if (e) restore(e.state, '已復原', e.label);
  };
  const redo = () => {
    const e = session.hist[session.hand].redo(snap(session.hand));
    if (e) restore(e.state, '已重做', e.label);
  };

  function placeCalib(q) {
    const ph = curPhoto();
    const next = CALIB.find((cp) => !ph.calib[cp.key]);
    if (!next) return;
    record(`點第 ${CALIB.indexOf(next) + 1} 個位置（${next.short}）`);
    ph.calib[next.key] = q;
    if (CALIB.every((cp) => ph.calib[cp.key])) {
      const fr = frameOf(ph);
      if (!fr) {
        ph.calib = {};
        ph.advice = '三個點太靠近，或幾乎在一直線上：請依序點食指根部、小指根部，再點手腕中間。';
      } else {
        ph.advice = photoAdvice(sampleGray(ph, fr), fr.width / ph.w);
        applySuggestions(tracedLines(ph)); // 重新點過位置：描過的線重新換算
      }
    }
    repaintAfter();
  }

  function addStroke(field, pts) {
    const ph = curPhoto();
    const fr = frameOf(ph);
    if (!fr) return;
    // 太短的一筆（不到 0.08 個掌寬）判定時本來就不算：直接說清楚，不要畫了卻沒反應
    if (!simplifyStroke(pts.map((q) => fr.toUV(q)))) {
      session.note = { hand: session.hand, text: '這一筆太短，當成不小心碰到：請沿著線多描一段。' };
      paintPhoto();
      return;
    }
    const n = (ph.strokes[field] || []).length + 1;
    record(`描${LINE_NAME[field]}${n > 1 ? `（第 ${n} 筆）` : ''}`);
    (ph.strokes[field] = ph.strokes[field] || []).push(pts);
    applySuggestions([field]);
    repaintAfter();
  }

  function clearLine() {
    const ph = curPhoto();
    const t = session.target;
    if (!(ph.strokes[t] || []).length) return;
    record(`清除${LINE_NAME[t]}`);
    delete ph.strokes[t];
    applySuggestions([t]);
    repaintAfter();
  }

  // 自動找三個位置：MediaPipe 手部關鍵點，按了才下載模型（第一次約 22MB）、只在手機上算。
  // 練習用的範例手掌是畫的，模型認不出來，所以練習時不提供。找的時候換了照片或換手，結果就不套用。
  let locating = false;
  const locLine = h('p', { class: 'small muted', role: 'status' });
  async function autoLocate() {
    const hand = session.hand;
    const ph = curPhoto();
    if (!ph || ph.demo || locating) return;
    locating = true;
    locLine.textContent = '準備辨識…';
    paintPhoto();
    // 大檔（模型、wasm）在 locateHand 裡面按了才下載；失敗都會回傳說明，不會丟出例外
    const r = await locateHand(ph.canvas, { onProgress: (t) => { locLine.textContent = t; } });
    locating = false;
    locLine.textContent = '';
    if (session.photos[hand] !== ph) return;
    if (!r.ok) {
      session.note = { hand, text: r.error };
      paintPhoto();
      return;
    }
    // 先檢查再記錄：側面、手指彎著時三個點會擠在一起，不合格就不要留下一筆復原不了什麼的紀錄
    if (!frameOf({ calib: r.points })) {
      session.note = { hand, text: '找到手了，但角度不對（像是側面或手指彎著）：手掌攤平、掌心朝鏡頭再拍一張，或手動點三個位置。' };
      paintPhoto();
      return;
    }
    record('自動找三個位置');
    ph.calib = { ...r.points };
    const fr = frameOf(ph);
    ph.advice = photoAdvice(sampleGray(ph, fr), fr.width / ph.w);
    applySuggestions(tracedLines(ph));
    session.note = { hand, text: '已自動放好三個位置：看看三個圈是不是在食指根部、小指根部和手腕中間；不準就按「重新點三個位置」自己點。' };
    repaintAfter();
  }

  function resetCalib() {
    const ph = curPhoto();
    record('重新點三個位置');
    ph.calib = {};
    ph.advice = null;
    paintPhoto(); // 選項先不動：重新點好三個位置時，描過的線會重新換算
  }

  function clearPhoto() {
    // 照片先不放掉記憶體：按錯了還能「復原」；換照片、開始練習或換人時才真的釋放
    record('清除照片');
    session.photos[session.hand] = null;
    paintPhoto();
  }

  /** 照片其實是另一隻手：照片和復原紀錄一起搬過去（另一隻手原本有照片就對調，不會丟掉） */
  function moveToHand(to) {
    const from = session.hand;
    const ph = session.photos[from];
    if (!ph.demo) {
      // 原本那隻手：拿掉這張照片自動填的（自己改過的留著）
      const st = mergeSuggestions(session.picks[from], ph.applied, {}, TRACE_LINES);
      if (JSON.stringify(st.picks) !== JSON.stringify(session.picks[from])) {
        session.picks[from] = st.picks;
        session.dirty = true;
      }
      ph.applied = {};
    }
    [session.photos[from], session.photos[to]] = [session.photos[to], ph];
    [session.hist[from], session.hist[to]] = [session.hist[to], session.hist[from]];
    ph.sideOk = true;
    session.hand = to;
    session.note = { hand: to, text: `照片已經移到${HAND_NAME[to]}。` };
    applySuggestions(tracedLines(ph));
    saveDraft();
    paintHandSeg();
    paintAll();
  }

  function toggleEnhance(btn) {
    const ph = curPhoto();
    if (!ph) return;
    if (session.enhance) {
      session.enhance = false;
      paintPhoto();
      return;
    }
    // 1280px 的照片要算一下：先讓按鈕顯示「處理中」，畫面更新後再算
    btn.disabled = true;
    btn.textContent = '處理中…';
    setTimeout(() => {
      try {
        if (!ph.enh) ph.enh = enhancedCanvas(ph);
        session.enhance = true;
      } catch {
        session.note = { hand: session.hand, text: '這張照片加強失敗（手機記憶體不夠），請用原圖描。' };
      }
      paintPhoto();
    }, 30);
  }

  function paintPhoto() {
    const hand = session.hand;
    const ph = session.photos[hand];
    const hist = session.hist[hand];
    noteLine.textContent = session.note && session.note.hand === hand ? session.note.text : '';
    const input = h('input', {
      type: 'file',
      accept: 'image/*',
      class: 'visually-hidden',
      tabindex: '-1',
      'aria-label': '選擇手掌照片',
      onchange: async (e) => {
        const file = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!file) return;
        try {
          setPhoto(hand, null); // 先放掉舊照片，大張照片解碼才有足夠的記憶體
          // 大張照片解碼要一點時間：先告訴使用者在處理，免得以為按了沒反應
          fill(photoBox, h('p', { class: 'palm-instr', role: 'status', text: '讀取照片中…（只在這支手機處理）' }));
          setPhoto(hand, newPhoto(await readPhoto(file)));
          paintPhoto();
        } catch (err) {
          fill(photoBox, h('p', { class: 'warn', text: err.message }), h('div', { class: 'actions' }, pickBtn('拍照或選照片', 'btn primary')), input);
        }
      },
    });
    const pickBtn = (text, cls) => h('button', { type: 'button', class: cls, text, onclick: () => input.click() });
    const undoBtn = () => h('button', {
      type: 'button',
      class: 'btn small',
      disabled: !hist.nextUndo(),
      'aria-label': hist.nextUndo() ? `復原：${hist.nextUndo()}` : '復原',
      onclick: undo,
    }, icon('undo'), h('span', { text: '復原' }));
    const redoBtn = () => h('button', {
      type: 'button',
      class: 'btn small',
      disabled: !hist.nextRedo(),
      'aria-label': hist.nextRedo() ? `重做：${hist.nextRedo()}` : '重做',
      onclick: redo,
    }, icon('redo'), h('span', { text: '重做' }));
    const inApp = /Line\/|FBAN|FBAV|Instagram/i.test(globalThis.navigator ? navigator.userAgent : '');

    if (!ph) {
      fill(
        photoBox,
        inApp ? h('p', { class: 'warn', text: '你是在 LINE、Facebook 或 Instagram 裡開這個網頁，這裡常常叫不出相機：請點右上角的選單，選「用預設瀏覽器開啟」或「在 Safari 中開啟」再試。' }) : null,
        h('p', { text: PALM_HOW.photo }),
        photoExamples(),
        h('ul', { class: 'reasons' },
          h('li', { class: 'tone-info', text: '手掌攤平、手指併攏，整隻手和手腕都要入鏡。' }),
          h('li', { class: 'tone-info', text: '光從正面照、不要開閃光燈，掌紋比較清楚。' }),
          h('li', { class: 'tone-info', text: '拍好後先點三個位置，再沿著掌紋描，App 會量長度和彎度，自動填進上面的選項。第一次用可以先拿範例手掌練習。' })),
        h('div', { class: 'actions' },
          pickBtn('拍照或選照片', 'btn primary'),
          h('button', { type: 'button', class: 'btn', text: '用範例手掌練習', onclick: () => { setPhoto(hand, newPhoto(practicePalm(hand), { demo: true })); paintPhoto(); } })),
        hist.nextUndo() ? h('div', { class: 'palm-tools' }, undoBtn(), h('span', { class: 'muted small', text: `上一步：${hist.nextUndo()}` })) : null,
        noteLine,
        input,
        h('details', { class: 'more' }, h('summary', { text: '按了沒反應、照片打不開？' }),
          h('p', { class: 'small', text: '按了沒反應：在 LINE、FB、IG 裡開的網頁常常不能用相機，請改用 Safari 開啟。' }),
          h('p', { class: 'small', text: '照片打不開：請改用「拍照」直接拍一張；照片太大（超過 40MB）也會讀不進來。' }),
          h('p', { class: 'small', text: '不想拍照也沒關係，上面「看圖選線形」一樣能完成解讀。' })),
      );
      return;
    }

    if (session.enhance && !ph.enh) {
      try {
        ph.enh = enhancedCanvas(ph);
      } catch {
        session.enhance = false;
      }
    }
    const next = CALIB.find((cp) => !ph.calib[cp.key]);
    const at = next ? CALIB.indexOf(next) : 3;
    const frame = frameOf(ph);
    const target = session.target;
    const canvas = photoCanvas(ph, { getTarget: () => session.target, getSource: () => (session.enhance ? ph.enh : null), onCalib: placeCalib, onStroke: addStroke });
    const guide = traceGuide({
      hand,
      calibDone: at,
      target,
      label: next ? `示範：第 ${at + 1} 個點在${next.text}` : `示範：${LINE_NAME[target]}的位置，從圓點描到箭頭`,
    });
    const how = next
      ? h('div', { class: 'palm-how' },
        h('p', { class: 'palm-instr' }, h('span', { class: 'badge', text: `${at + 1}／3` }), ' ', h('span', { text: `點照片上的「${next.text}」` })),
        h('p', { class: 'small muted', text: '照左邊的示範圖點。按住可以滑動微調，放開才算；手指按著時，角落的放大鏡看得到手指底下。' }),
        ph.demo ? null : h('div', { class: 'palm-auto' },
          h('button', { type: 'button', class: 'btn small primary', text: locating ? '辨識中…' : '自動找三個位置', disabled: locating, onclick: autoLocate }),
          locating ? locLine : h('p', { class: 'small muted', text: `用手部辨識模型在手機上找，照片不會上傳；第一次要下載約 ${MP_MB}MB（建議連 Wi-Fi）。` })))
      : h('div', { class: 'palm-how' },
        h('p', { class: 'palm-instr' }, h('b', { text: `描${LINE_NAME[target]}` })),
        h('p', { class: 'small', text: TRACE_HOW[target] }),
        h('p', { class: 'small muted', text: '斷開、分岔或有兩條，就分成幾筆描；描錯了按「復原」。' }));
    const count = (l) => (ph.strokes[l] || []).length;
    const chips = next ? null : h('div', { class: 'palm-steps', role: 'group', 'aria-label': '要描哪條線' }, TARGETS.map((t) => h('button', {
      type: 'button',
      class: `palm-step${target === t.value ? ' on' : ''}${count(t.value) ? ' done' : ''}`,
      'aria-pressed': target === t.value ? 'true' : 'false',
      onclick: () => { session.target = t.value; paintPhoto(); },
      onfocus: (e) => e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }),
    }, h('b', { text: t.label }), h('span', { text: count(t.value) ? `已描 ${count(t.value)} 筆` : t.value === 'simian' ? '有才描' : '未描' }))));
    // 描好一條就給「下一條」：照生命線、智慧線、感情線、事業線的順序找還沒描的
    const order = MAIN_LINES;
    const nextLine = order.find((l) => !count(l) && order.indexOf(l) > order.indexOf(target)) || order.find((l) => !count(l) && l !== target);
    let flow = null;
    if (!next && count(target)) {
      if (nextLine) flow = h('button', { type: 'button', class: 'btn small primary', text: `下一條：${LINE_NAME[nextLine]}`, onclick: () => { session.target = nextLine; paintPhoto(); } });
      else if (!ph.demo) flow = h('button', { type: 'button', class: 'btn small primary', text: '四條線都描好了，看解讀', onclick: () => resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' }) });
    }
    // 照片看起來是另一隻手：男左女右之下描錯手，解讀就整個看錯手。前鏡頭拍的照片可能左右相反，所以只提醒、讓他決定
    const side = frame && !ph.demo && !ph.sideOk && frame.side !== hand ? frame.side : null;
    const sideBox = side ? h('div', { class: 'palm-side' },
      h('p', { class: 'warn', text: `從你點的三個位置看，這張像是${HAND_NAME[side]}；現在選的是${HAND_NAME[hand]}。用前鏡頭拍、照片左右相反時也會這樣。` }),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn small primary', text: `移到${HAND_NAME[side]}`, onclick: () => moveToHand(side) }),
        h('button', { type: 'button', class: 'btn small', text: `沒錯，是${HAND_NAME[hand]}`, onclick: () => { ph.sideOk = true; paintPhoto(); } }))) : null;
    const enhBtn = h('button', {
      type: 'button',
      class: 'btn small',
      'aria-pressed': session.enhance ? 'true' : 'false',
      text: '加強掌紋',
      onclick: (e) => toggleEnhance(e.currentTarget),
    });
    const sug = frame ? suggestPicks(uvTraces(ph)) : {};
    let feedback = null;
    if (ph.demo) {
      // 練習：拿判斷結果對範例的答案，描得不一樣就說差在哪
      const done = MAIN_LINES.filter((l) => count(l));
      if (done.length) {
        feedback = h('ul', { class: 'reasons' },
          done.map((l) => (sug[l] === PRACTICE_ANSWER[l]
            ? h('li', { class: 'tone-good', text: `${LINE_NAME[l]}：判斷成「${PALM_TEXT[l][sug[l]].label}」，和範例一樣。` })
            : h('li', { class: 'tone-info', text: `${LINE_NAME[l]}：判斷成「${sug[l] ? PALM_TEXT[l][sug[l]].label : '看不出來'}」，範例是「${PALM_TEXT[l][PRACTICE_ANSWER[l]].label}」。${PRACTICE_TIP[l]}` }))),
          done.length < MAIN_LINES.length ? h('li', { class: 'tone-info', text: `還沒描：${MAIN_LINES.filter((l) => !done.includes(l)).map((l) => LINE_NAME[l]).join('、')}。` }) : null);
      }
    } else {
      const mine = picks();
      const parts = TRACE_FIELDS.filter((k) => sug[k]).map((k) => {
        const base = `${FIELD_NAME[k]}「${PALM_TEXT[k][sug[k]].label}」`;
        return mine[k] && mine[k] !== sug[k] ? `${base}（你選了「${PALM_TEXT[k][mine[k]].label}」，保留你的）` : base;
      });
      if (parts.length) feedback = h('p', { class: 'small', text: `依你描的線推測：${parts.join('、')}。已經填進上面的選項，可以再自己改。` });
    }
    fill(
      photoBox,
      ph.demo ? h('p', { class: 'hint', text: '練習模式：這是畫出來的範例手掌，描的線不會填進你的選項。照示範圖點三個位置、描四條線，描完會告訴你判斷得對不對。' }) : null,
      h('div', { class: 'palm-howrow' }, guide, how),
      chips,
      flow ? h('div', { class: 'actions' }, flow) : null,
      ph.advice ? h('p', { class: 'warn', text: ph.advice }) : null,
      sideBox,
      h('div', { class: 'palm-tools' }, undoBtn(), redoBtn(), enhBtn, hist.nextUndo() ? h('span', { class: 'muted small', text: `上一步：${hist.nextUndo()}` }) : null),
      noteLine,
      canvas.el,
      feedback,
      h('div', { class: 'actions' },
        next ? null : h('button', { type: 'button', class: 'btn small', text: `清除${LINE_NAME[target]}`, disabled: !count(target), onclick: clearLine }),
        h('button', { type: 'button', class: 'btn small', text: '重新點三個位置', disabled: !CALIB.some((cp) => ph.calib[cp.key]), onclick: resetCalib }),
        ph.demo ? null : h('button', { type: 'button', class: 'btn small', text: '清除照片', onclick: clearPhoto })),
      ph.demo
        ? h('div', { class: 'actions' }, pickBtn('改用我的照片', 'btn primary'), h('button', { type: 'button', class: 'btn', text: '結束練習', onclick: () => { setPhoto(hand, null); paintPhoto(); } }))
        : h('div', { class: 'actions' }, pickBtn('換一張照片', 'btn')),
      input,
    );
  }

  // ── 結果
  function paintResult() {
    const hand = session.hand;
    const cur = picks();
    const items = palmReading(cur);
    const ph = session.photos[hand];
    const role = handRole(hand, view());
    const saveRow = h('div', { class: 'actions' },
      h('button', {
        type: 'button',
        class: `btn${session.dirty ? ' primary' : ''}`,
        text: `存到${p.name}的資料`,
        disabled: !session.dirty,
        onclick: () => {
          const saved = ctx.savePerson({ ...p, palm: { school: session.school, dominant: session.dominant, left: session.picks.left, right: session.picks.right } });
          if (saved.ok) {
            session.dirty = false;
            session.restored = false;
            remove(DRAFT_KEY);
            ctx.toast('已存進名單（只在這支手機），照片沒有儲存');
          } else {
            ctx.toast(saved.error || '儲存失敗');
          }
        },
      }),
      h('span', { class: 'muted small', text: !session.dirty ? '已儲存' : session.restored ? '上次還沒儲存的選擇已經接回來了，記得按儲存' : '有還沒儲存的選擇' }),
      session.dirty ? h('button', {
        type: 'button',
        class: 'link',
        text: '放棄修改',
        onclick: () => {
          remove(DRAFT_KEY);
          loadSaved(p);
          session.dirty = false;
          session.restored = false;
          domSel.value = session.dominant;
          schoolSel.value = session.school;
          domField.hidden = session.school !== 'dominant';
          paintAll();
        },
      }) : null);
    if (!items.length) {
      fill(resultBox, h('p', { class: 'muted', text: '選了線形之後，這裡會畫出你的掌紋並逐項解讀。' }), session.dirty ? saveRow : null);
      return;
    }
    const traces = ph ? uvTraces(ph) : {};
    const present = diagramFields(cur, traces);
    const diffs = compareHands(session.picks.left, session.picks.right);
    const bothFilled = Object.keys(session.picks.left).length && Object.keys(session.picks.right).length;
    const summary = items.map((it) => `${it.label}：${it.title}`).join('；');
    fill(
      resultBox,
      h('div', { class: 'palm-figure' },
        playWhenVisible(palmDiagram({ hand, picks: cur, traces, label: `${HAND_NAME[hand]}掌紋示意：${summary}` })),
        h('div', { class: 'palm-legend small' }, present.map((f) => h('span', { class: `pl-key pl-${f}`, text: { life: '生命線', head: '智慧線', heart: '感情線', fate: '事業線', simian: cur.simian === 'full' ? '斷掌線' : '相連處' }[f] })))),
      h('p', { class: 'muted small', text: roleText(hand, session.school, view(), role) }),
      items.map((it) => h('div', { class: 'palm-item' },
        h('h3', {}, h('span', { class: 'badge', text: it.label }), ' ', h('span', { text: it.title })),
        traitScale(it.scale, it.pos),
        h('p', { text: it.text }),
        h('ul', { class: 'reasons' },
          h('li', { class: 'tone-good' }, h('b', { text: '值得發揮：' }), h('span', { text: it.good })),
          h('li', { class: 'tone-info' }, h('b', { text: '溫和提醒：' }), h('span', { text: it.care })),
          h('li', { class: 'tone-info' }, h('b', { text: '小行動：' }), h('span', { text: it.act }))))),
      cur.simian && cur.simian !== 'none' ? h('p', { class: 'hint', text: SIMIAN_NOTE }) : null,
      bothFilled
        ? [h('h3', { text: '左右手比較' }), diffs.length ? h('ul', { class: 'reasons' }, diffs.map((d) => h('li', { class: 'tone-info', text: handDiffText(d, view()) }))) : h('p', { text: session.school === 'gender' ? '兩隻手選的都一樣：主要看的手和參考的手說法一致。' : '兩隻手選的都一樣：天生和後天的傾向一致。' })]
        : h('p', { class: 'hint', text: `也可以切到${HAND_NAME[hand === 'left' ? 'right' : 'left']}選一次，比較兩隻手的差異。` }),
      h('p', { class: 'hint', text: PALM_DISCLAIMER }),
      saveRow,
      actions(p, 'palm', `掌紋（${HAND_NAME[hand]}）`, summary, { title: `${p.name}的掌紋（${HAND_NAME[hand]}）`, subtitle: role ? roleText(hand, session.school, view(), role) : '', lines: items.map((it) => `${it.label}｜${it.title}`) }),
    );
  }

  function paintAll() {
    paintRole();
    paintPicker();
    paintPhoto();
    paintResult();
  }

  const domSel = h('select', {
    'aria-label': '慣用手',
    onchange: (e) => {
      session.dominant = e.target.value;
      session.dirty = true;
      saveDraft();
      paintRole();
      paintResult();
    },
  }, h('option', { value: '', text: '不確定' }), h('option', { value: 'right', text: '右手' }), h('option', { value: 'left', text: '左手' }));
  domSel.value = session.dominant;
  // 慣用手只有「看慣用手」這一派用得到，其他看法時收起來，免得以為要填
  const domField = h('div', { class: 'field', hidden: session.school !== 'dominant' }, h('span', { class: 'field-label', text: '慣用手' }), domSel);
  const handBox = h('div', {});
  const paintHandSeg = () => fill(handBox, segmented({ name: 'palm-hand', label: '看哪隻手', value: session.hand, options: [{ value: 'right', label: '右手' }, { value: 'left', label: '左手' }], onChange: (v) => { session.hand = v; paintAll(); } }));
  const schoolSel = h('select', {
    'aria-label': '看哪隻手的看法',
    onchange: (e) => {
      session.school = e.target.value;
      session.dirty = true;
      saveDraft();
      domField.hidden = session.school !== 'dominant';
      // 換成男左女右時，直接切到主要看的那隻手
      const main = session.school === 'gender' ? mainHand('gender', view()) : null;
      if (main && main !== session.hand) {
        session.hand = main;
        paintHandSeg();
      }
      paintAll();
    },
  }, HAND_SCHOOLS.map((x) => h('option', { value: x.id, text: x.label })));
  schoolSel.value = session.school;
  paintHandSeg();
  paintAll();

  return [
    h(
      'section',
      { class: 'card' },
      cardHead(h, 'palm', `${p.name}的掌紋`, '看圖選線形，也可以拍照描線'),
      h('div', { class: 'row2' },
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: '看哪隻手' }), handBox),
        h('div', { class: 'field' }, h('span', { class: 'field-label', text: '看法' }), schoolSel)),
      domField,
      roleLine,
      genderHint,
      h('details', { class: 'more' }, h('summary', { text: '看哪隻手？怎麼看？' }), h('p', { class: 'small', text: PALM_HOW.school }), h('p', { class: 'small', text: PALM_HOW.pick })),
    ),
    h('section', { class: 'card' }, h('h2', { text: '看圖選線形' }), pickerBox),
    h('section', { class: 'card' }, cardHead(h, 'sparkle', '拍照描線（選用）', '照片不儲存、不上傳'), photoBox),
    h('section', { class: 'card' }, h('h2', { text: '掌紋解讀' }), resultBox),
  ];
}
