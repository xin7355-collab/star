// 朗讀：Web Speech API（speechSynthesis），全部用裝置內建的語音。
// 為什麼只用內建語音（localService）：Chrome 的「Google 國語」這類雲端語音會把要唸的文字送到外面，違反個資只留在手機的原則；
// iPhone 的語音都是內建的。為什麼要先 primeVoices：iOS 要在點擊的當下呼叫 speak（等語音清單載入再唸會被擋），
// 所以畫面打開時先讀一次清單，按下去時就能直接唸。

let session = null;

export function canSpeak() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

/** 先讀一次語音清單（Chrome 第一次呼叫常是空的，之後才載入） */
export function primeVoices() {
  if (canSpeak()) window.speechSynthesis.getVoices();
}

/** 挑內建的中文語音：台灣＞香港／繁體＞其他中文；清單是空的回傳 known:false（交給系統預設，iPhone 預設就是內建） */
export function pickVoice(voices) {
  if (!voices || !voices.length) return { voice: null, known: false };
  const local = voices.filter((v) => v.localService !== false);
  const find = (re) => local.find((v) => re.test(String(v.lang).replace('_', '-')));
  return { voice: find(/^zh-TW/i) || find(/^zh-(HK|Hant)/i) || find(/^zh/i) || null, known: true };
}

/**
 * 開始朗讀（要在點擊事件裡直接呼叫，不能 await 之後才叫）。
 * @param {string[]} parts 一句一句
 * @returns {{ok:true}|{ok:false, error:string}}
 */
export function speak(parts, { onEnd } = {}) {
  if (!canSpeak()) return { ok: false, error: '這個瀏覽器不支援朗讀。' };
  stopSpeaking();
  const synth = window.speechSynthesis;
  const { voice, known } = pickVoice(synth.getVoices());
  if (known && !voice) return { ok: false, error: '這台裝置沒有內建的中文語音。iPhone 可以到「設定→輔助使用→朗讀內容→聲音」下載中文語音。' };
  const me = { onEnd };
  session = me;
  const finish = () => {
    if (session !== me) return;
    session = null;
    if (onEnd) onEnd();
  };
  parts.forEach((text, i) => {
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = voice ? voice.lang : 'zh-TW';
    if (voice) u.voice = voice;
    u.rate = 1;
    if (i === parts.length - 1) u.onend = finish;
    u.onerror = finish;
    synth.speak(u);
  });
  return { ok: true };
}

export function stopSpeaking() {
  const was = session;
  session = null;
  if (canSpeak()) window.speechSynthesis.cancel();
  if (was && was.onEnd) was.onEnd();
}

export const isSpeaking = () => !!session;
