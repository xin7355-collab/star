// 復原／重做的堆疊（掌紋描線用）。只管順序，不管內容：每一筆是「做這個動作之前的狀態」＋給人看的說明。
// 為什麼存「整個狀態」而不是「怎麼反做」：描線的動作會連帶改到建議選項、照片提醒，逐一反做容易漏；
// 存狀態的話，復原就是整個換回去，不會只復原一半。狀態裡的點陣列建立後不再修改，所以只要淺拷貝，很省記憶體。
// 純函式，可在 Node 測試。

/**
 * @param {{limit?:number}} [opts] limit：最多記幾步（超過的最舊那步丟掉）
 */
export function createUndo({ limit = 60 } = {}) {
  let past = [];
  let future = [];
  return {
    /** 做了新動作：記下動作之前的狀態；新動作一做，原本可以重做的就作廢 */
    push(label, state) {
      past.push({ label, state });
      future = [];
      if (past.length > limit) past = past.slice(past.length - limit);
    },
    /** 復原：回傳要換回去的那一筆（沒有就 null）；current 是現在的狀態，留給重做 */
    undo(current) {
      const e = past.pop();
      if (!e) return null;
      future.push({ label: e.label, state: current });
      return e;
    },
    /** 重做：回傳要換回去的那一筆（沒有就 null） */
    redo(current) {
      const e = future.pop();
      if (!e) return null;
      past.push({ label: e.label, state: current });
      return e;
    },
    /** 下一次復原／重做會動到哪一步（按鈕上顯示用） */
    nextUndo: () => (past.length ? past[past.length - 1].label : ''),
    nextRedo: () => (future.length ? future[future.length - 1].label : ''),
    /** 所有還記著的狀態（換照片時用來釋放舊照片的記憶體） */
    states: () => [...past, ...future].map((e) => e.state),
    clear() {
      past = [];
      future = [];
    },
  };
}
