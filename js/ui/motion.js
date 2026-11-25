// 動畫小工具。原則：只動 transform／opacity；使用者在系統設定「減少動態效果」時直接顯示結果（CSS 檔尾也會全關）。

/** App 裡選的動畫強度（html 的 data-motion）：full、lite、off */
export function motionLevel() {
  const m = typeof document !== 'undefined' ? document.documentElement.dataset.motion : '';
  return m === 'lite' || m === 'off' ? m : 'full';
}

/** 系統開了「減少動態效果」，或在 App 裡把動畫關掉 */
export function reducedMotion() {
  return motionLevel() === 'off' || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** 把設定套到 html 上（CSS 依 data-motion 縮短或關閉動畫） */
export function applyMotion(level) {
  if (typeof document === 'undefined') return;
  if (level === 'lite' || level === 'off') document.documentElement.dataset.motion = level;
  else delete document.documentElement.dataset.motion;
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

/**
 * 圖在畫面下方時，先暫停動畫，捲到眼前（露出兩成）才開始播。減少動態效果或瀏覽器沒有 IntersectionObserver 時直接顯示。
 * 回傳同一個元素，方便寫在 h(...) 裡。
 */
export function playWhenVisible(el) {
  if (!el || reducedMotion() || typeof IntersectionObserver !== 'function') return el;
  el.classList.add('await-view');
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      el.classList.remove('await-view');
      io.disconnect();
    }
  }, { threshold: 0.2 });
  io.observe(el);
  return el;
}
