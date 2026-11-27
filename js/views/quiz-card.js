// 興趣與性格測驗的卡片（工作與未來方向裡）：還沒做 → 說明＋開始；作答中 → 一題一頁、可以上一題、隨時停；做完 → 結果。
// 一題一頁：56 題排成一長串，手機上會漏答、找不到做到哪；作答進度存在這支手機，關掉 App 再回來可以接著做。
// 做完自動存進名單（只存分數）：做了 5 分鐘的測驗，因為忘了按儲存而不見，最傷。

import { h, fill } from '../ui/dom.js';
import { cardHead } from '../ui/icons.js';
import { load, save, remove } from '../ui/storage.js';
import {
  QUESTIONS, INTEREST_SCALE, PERSONALITY_SCALE, RIASEC, RIASEC_ORDER, BIG5, BIG5_ORDER, INTEREST_ITEMS,
  scoreQuiz, hollandCode, big5Level, eiOf, mbtiOf,
} from '../core/quiz.js';

const DRAFT_KEY = 'quiz-draft';
const isAnswer = (a) => Number.isInteger(a) && a >= 1 && a <= 5;
const isoDate = (t) => `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`;

/**
 * @param {{p:object, who:string, ctx:object, today:{y:number,m:number,d:number}, pendingCareer?:()=>object|null}} o
 *   pendingCareer：工作表單有沒存的變更就回傳它（存測驗會讓整頁重畫，一起存才不會把剛選的工作洗掉）
 */
export function quizCard({ p, who, ctx, today, pendingCareer = () => null }) {
  const body = h('div', { class: 'quiz-body' });
  const card = h('section', { class: 'card', id: 'quiz-card' },
    cardHead(h, 'sparkle', `${who}的興趣與性格`, '測驗：職業興趣（何倫六型）＋五大性格'), body);
  // 作答進度：只收同一個人的、合法的答案
  const draft = load(DRAFT_KEY, null);
  let answers = draft && draft.id === p.id && Array.isArray(draft.answers) ? draft.answers.slice(0, QUESTIONS.length) : [];
  if (!answers.every(isAnswer)) answers = [];

  const keep = () => save(DRAFT_KEY, { id: p.id, answers });

  function intro() {
    const resume = answers.length > 0 && answers.length < QUESTIONS.length;
    fill(body,
      h('p', { text: '兩個部分、共 56 題，大約 6 分鐘：' }),
      h('ol', { class: 'plan' },
        h('li', { text: `職業興趣 ${INTEREST_ITEMS.length} 題：喜不喜歡這些活動 → 何倫六型（實作、研究、藝術、社會、企業、事務）。` }),
        h('li', { text: '性格 20 題：像不像你 → 五大性格（外向、親和、盡責、情緒穩定、開放）。' })),
      h('p', { class: 'muted small', text: '照「平常的你」直覺回答，沒有對錯。做到一半可以停，下次接著做。' }),
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', text: resume ? `繼續作答（第 ${answers.length + 1} 題）` : '開始測驗', onclick: () => ask(resume ? answers.length : 0) }),
        resume ? h('button', { type: 'button', class: 'btn ghost', text: '重新開始', onclick: () => { answers = []; keep(); ask(0); } }) : null),
      note());
  }

  function ask(i) {
    const q = QUESTIONS[i];
    const scale = q.part === 'interest' ? INTEREST_SCALE : PERSONALITY_SCALE;
    const done = Math.round((i / QUESTIONS.length) * 100);
    const qText = q.part === 'interest' ? `你喜不喜歡：${q.text}？` : `${q.text}。`;
    fill(body,
      h('p', { class: 'quiz-progress muted small', text: `第 ${i + 1}／${QUESTIONS.length} 題・${q.part === 'interest' ? '職業興趣' : '性格'}` }),
      h('div', { class: 'quiz-track', role: 'progressbar', 'aria-label': '作答進度', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(done) },
        h('div', { class: 'quiz-fill', style: { width: `${done}%` } })),
      h('h3', { class: 'quiz-q', id: `quiz-q-${i}`, text: qText }),
      h('div', { class: 'quiz-options', role: 'group', 'aria-labelledby': `quiz-q-${i}` },
        scale.map((label, k) => h('button', {
          type: 'button', class: 'btn quiz-opt', 'aria-pressed': answers[i] === k + 1 ? 'true' : 'false', text: label,
          onclick: () => answer(i, k + 1),
        }))),
      h('div', { class: 'actions' },
        i > 0 ? h('button', { type: 'button', class: 'btn small ghost', text: '上一題', onclick: () => ask(i - 1) }) : null,
        h('button', { type: 'button', class: 'btn small ghost', text: '先停在這裡', onclick: intro })));
    // 換題後把焦點放在題目上：讀螢幕的人知道換題了，手機上也會捲到題目
    const head = body.querySelector('.quiz-q');
    head.setAttribute('tabindex', '-1');
    head.focus({ preventScroll: false });
  }

  function answer(i, v) {
    answers[i] = v;
    keep();
    if (i + 1 < QUESTIONS.length && answers.length <= i + 1) return ask(i + 1);
    // 回頭改答案後，跳到第一題還沒答的；全部答完就算分
    const next = answers.findIndex((a) => !isAnswer(a));
    if (next >= 0) return ask(next);
    if (answers.length < QUESTIONS.length) return ask(answers.length);
    finish();
  }

  function finish() {
    const result = scoreQuiz(answers, isoDate(today));
    if (!result) return ask(0);
    remove(DRAFT_KEY);
    answers = [];
    showResult(result);
    const career = pendingCareer();
    const res = ctx.savePerson({ ...p, quiz: result, ...(career ? { career } : {}) });
    if (!res.ok) return ctx.toast(res.error);
    ctx.toast(career ? '測驗結果和工作的選擇都存在這支手機了' : '測驗結果已存在這支手機');
  }

  function showResult(r) {
    const code = hollandCode(r);
    const top = RIASEC_ORDER.map((t) => ({ t, n: r.riasec[t] })).sort((a, b) => b.n - a.n);
    fill(body,
      h('p', { class: 'master-verdict' },
        code ? `興趣代碼 ${code}：${code.split('').map((t) => RIASEC[t].name).join('、')}。` : '六種興趣都不算特別高：可能還在摸索，或對「工作」本身的興趣普通，那就更要看收入、穩定、生活平衡哪個對你重要。',
        r.at ? h('small', { class: 'muted', text: `（${r.at} 測）` }) : null),
      h('h3', { text: '職業興趣（何倫六型）' }),
      h('div', { class: 'quiz-bars' }, top.map(({ t, n }) => bar(`${RIASEC[t].name} ${t}`, n))),
      code ? h('ul', { class: 'reasons' }, code.split('').map((t) => h('li', { class: 'tone-good' },
        h('b', { text: `${RIASEC[t].name}：` }), h('span', { text: `${RIASEC[t].desc}適合的環境：${RIASEC[t].env}。例如：${RIASEC[t].jobs}。` })))) : null,
      h('h3', { text: '五大性格' }),
      h('div', { class: 'quiz-bars' }, BIG5_ORDER.map((t) => bar(BIG5[t].name, r.big5[t]))),
      h('ul', { class: 'reasons' }, BIG5_ORDER.map((t) => {
        const lv = big5Level(r.big5[t]);
        const x = BIG5[t];
        const text = lv === 'high' ? `${x.high}${x.workHigh}` : lv === 'low' ? `${x.low}${x.workLow}` : `${x.name}在中間：兩種情況都應付得來，看環境調整。`;
        return h('li', { class: lv === 'mid' ? 'tone-info' : 'tone-good' }, h('b', { text: `${x.name}${lv === 'high' ? '偏高' : lv === 'low' ? '偏低' : '中等'}：` }), h('span', { text }));
      })),
      eiBlock(r),
      h('p', { class: 'hint', text: '這份結果會用在上面的「綜合推薦」：每個工作各比一次興趣相符（例如業務看企業型）和性格相符（例如業務看外向、行政看盡責），不混進命理的天賦投票。' }),
      h('div', { class: 'actions' },
        // 綜合解讀的「說中與不像」：各系統說的個性和這份結果逐句對照
        h('button', { type: 'button', class: 'btn small', text: '看各系統說中幾句', onclick: () => ctx.go('destiny', { tool: 'reading', focus: 'trait-check' }) }),
        h('button', { type: 'button', class: 'btn small ghost', text: '重新測驗', onclick: () => { answers = []; keep(); ask(0); } })),
      note());
  }

  // E 人／I 人：使用者問「E 人 I 人有用嗎」。有用的部分是外向性（五大性格的一項），拿來挑工作型態；
  // 類 MBTI 四個字母只當參考，中間的分數寫 X，不硬分兩類
  function eiBlock(r) {
    const ei = eiOf(r);
    return [
      h('h3', { text: 'E 人還是 I 人' }),
      h('p', {}, h('b', { text: ei.label }), h('span', { text: `，外向性 ${ei.n}。` }),
        h('span', { text: ei.code === 'E' ? '和人互動會讓你有精神：對外窗口、業務、帶團隊比較順。' : ei.code === 'I' ? '獨處、專心做事會讓你有精神：專業技術、幕後、研究型的位置比較順；要常和人互動的工作也做得來，記得排獨處充電的時間。' : '和人互動、獨立作業都應付得來，看工作內容調整就好。' })),
      h('details', { class: 'more' }, h('summary', { text: 'E／I 有用嗎？類 MBTI 是什麼' }),
        h('p', { class: 'small', text: 'E／I 就是五大性格的「外向性」。研究上，外向性和業務、管理這類常和人打交道的工作表現有關；但對大多數工作，影響最大的是盡責性。所以它適合拿來挑工作型態，不決定你能不能做。' }),
        h('p', { class: 'small', text: `換算成類 MBTI：${mbtiOf(r)}（E/I 看外向性、N/S 看開放性、F/T 看親和性、J/P 看盡責性；X 是分數在中間，不硬分）。` }),
        h('p', { class: 'small', text: '這不是正式的 MBTI 測驗。MBTI 把每個向度硬分成兩類，分數在中間的人重測很容易換類型，所以本 App 不用四個字母推薦工作，綜合推薦用的是上面的分數。' })),
    ];
  }

  const bar = (label, n) => h('div', { class: 'quiz-row' },
    h('span', { class: 'quiz-label', text: label }),
    h('div', { class: 'bar-track', role: 'img', 'aria-label': `${label} ${n} 分` }, h('div', { class: 'bar-fill', style: { width: `${Math.max(3, n)}%` } })),
    h('b', { class: 'quiz-num', text: String(n) }));

  const note = () => h('details', { class: 'more' }, h('summary', { text: '這個測驗怎麼來的' }),
    h('p', { class: 'small', text: '職業興趣：題目是本 App 依何倫（Holland）職業興趣理論寫的簡易版，沒有經過正式常模驗證，結果請當自我了解的參考。常見的正式量表（例如 O*NET）授權不允許翻譯改作，所以沒有使用。' }),
    h('p', { class: 'small', text: '性格：五大性格用 Mini-IPIP 的 20 題（Donnellan 等人，2006；國際性格題庫 IPIP 的公開題目），中文由本 App 翻譯。' }),
    h('p', { class: 'small', text: '測驗不是診斷，也不決定你能做什麼；只存分數在這支手機，不存每一題的答案。' }));

  if (p.quiz && !(answers.length && answers.length < QUESTIONS.length)) showResult(p.quiz);
  else intro();
  return card;
}
