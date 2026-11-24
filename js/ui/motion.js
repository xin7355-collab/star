// 動畫小工具。原則：只動 transform／opacity；使用者在系統設定「減少動態效果」時直接顯示結果（CSS 檔尾也會全關）。

export function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 卡片依序浮上來：加上 .rv 並設定順序（CSS 用 --i 算延遲） */
export function reveal(nodes) {
  let i = 0;
  for (const n of nodes) {
    if (n && n.classList) {
      n.classList.add('rv');
      n.style.setProperty('--i', String(i));
      i += 1;
    }
  }
  return nodes;
}

/** 只設定順序（給已經有自己進場動畫的小元素：吉時格、彩球、宮位） */
export function order(nodes) {
  nodes.forEach((n, i) => n && n.style && n.style.setProperty('--i', String(i)));
  return nodes;
}

/** 分數環：先放在 0，下一個畫面再設成目標值，CSS transition 會補間 */
export function ringTo(el, value) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  if (reducedMotion()) {
    el.style.setProperty('--p', String(v));
    return el;
  }
  el.style.setProperty('--p', '0');
  requestAnimationFrame(() => requestAnimationFrame(() => el.style.setProperty('--p', String(v))));
  return el;
}

/** 數字從 0 數到目標（三次方緩出） */
export function countUp(el, to, { duration = 900, suffix = '' } = {}) {
  const target = Math.round(Number(to) || 0);
  if (reducedMotion()) {
    el.textContent = `${target}${suffix}`;
    return el;
  }
  el.textContent = `0${suffix}`;
  const start = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - start) / duration);
    const eased = 1 - (1 - k) ** 3;
    el.textContent = `${Math.round(target * eased)}${suffix}`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return el;
}

/** 切換分頁時讓新分頁滑入 */
export function enterView(el) {
  if (reducedMotion()) return;
  el.classList.remove('entering');
  // 讀一次版面讓瀏覽器重新開始動畫
  void el.offsetWidth;
  el.classList.add('entering');
}
