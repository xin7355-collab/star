// 方向感測器的共用小工具（手機羅盤、AR 星空都用）：要權限、讀螢幕轉向。
// 獨立成小檔：「我的」分頁一開就要載入 askOrientation（按鈕要在點擊當下呼叫），不想連帶載入羅盤圖和天文計算。

/** 點擊當下呼叫；iPhone（和新版 Chrome）會依設定詢問或回覆，沒有這個 API 的瀏覽器不用問。回傳 Promise<'granted'|'denied'> */
export function askOrientation() {
  const DOE = window.DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === 'function') {
    try {
      return DOE.requestPermission().then((st) => (st === 'granted' ? 'granted' : 'denied'), () => 'denied');
    } catch {
      return Promise.resolve('denied');
    }
  }
  return Promise.resolve('granted');
}

/** 螢幕轉向（直拿 0、橫拿 90／270）：舊版 iPhone 沒有 screen.orientation，用 window.orientation */
export const screenAngle = () => {
  const o = window.screen && window.screen.orientation;
  if (o && typeof o.angle === 'number') return o.angle;
  return typeof window.orientation === 'number' ? window.orientation : 0;
};
