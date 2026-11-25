// 朗讀用的文字：把畫面上的符號換成唸得順的說法（11/26（四）→11月26日星期四、13:00→13點、／→或），
// 再切成短句：iOS 的語音遇到很長的一段常唸到一半就停，一句一句排進佇列比較穩。純函式，可在 Node 測試。

/** 畫面文字 → 唸得順的文字 */
export function speakable(text) {
  return String(text)
    .replace(/(\d{1,2})\/(\d{1,2})（([日一二三四五六])）/g, '$1月$2日星期$3')
    .replace(/(\d{1,2})\/(\d{1,2})/g, '$1月$2日')
    .replace(/(\d{1,2}):00/g, '$1點')
    .replace(/(\d{1,2}):(\d{2})/g, '$1點$2分')
    .replace(/[～~–]/g, '到')
    .replace(/／/g, '或')
    .replace(/[・•｜|]/g, '，')
    .replace(/[「」『』]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 切成短句：句號、問號、驚嘆號、分號後切；超過 maxLen 字的再從逗號切，還是太長就硬切 */
export function chunks(text, maxLen = 100) {
  const out = [];
  for (const sentence of String(text).split(/(?<=[。！？；!?;])/)) {
    let s = sentence.trim();
    if (!s) continue;
    while (s.length > maxLen) {
      const cut = s.lastIndexOf('，', maxLen);
      const at = cut > maxLen / 3 ? cut + 1 : maxLen;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

/**
 * 今天的重點朗讀稿。
 * @param {{title:string, dateLine:string, score:number, level:string, advice:string, attention?:string[], hours?:string[],
 *          lucky?:{color?:string, numbers?:string, cai?:string}, maya?:{title:string, q:string}}} d
 * @returns {string[]} 一句一句
 */
export function todayScript(d) {
  const parts = [`${d.title}。今天是${d.dateLine}。`, `今日指數 ${d.score} 分，${d.level}。${d.advice}`];
  if (d.attention && d.attention.length) parts.push(`今天要注意的：${d.attention.join('')}`);
  if (d.hours && d.hours.length) parts.push(`時辰的部分：${d.hours.join('')}`);
  if (d.lucky) {
    const l = d.lucky;
    parts.push(`今天的幸運色是${l.color || '不限'}${l.numbers ? `，幸運尾數是${l.numbers}` : ''}${l.cai ? `，財神方位在${l.cai}` : ''}。`);
  }
  if (d.maya) parts.push(`今天的瑪雅印記是${d.maya.title}，今天問自己：${d.maya.q}`);
  parts.push('祝你有美好的一天。');
  return chunks(speakable(parts.join('')));
}
