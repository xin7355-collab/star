// 農曆、節氣、八字、大運流年、黃曆宜忌：lunar-typescript（MIT，6tail）
// 刻意引用 CJS 版：iztro 內部用 require('lunar-typescript') 也會拿到同一個檔案，
// 打包時兩者共用 vendor/shared-chunk.js，不會下載兩份。
import * as L from '../../node_modules/lunar-typescript/dist/index.cjs';

export const { Solar, Lunar, LunarYear, LunarMonth, EightChar, LunarUtil, SolarUtil } = L;
