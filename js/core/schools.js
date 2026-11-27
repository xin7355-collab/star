// 各系統可以切換的派別（命盤分頁的「排盤設定」用）。純資料、不 import 函式庫：
// 命盤分頁一打開就要畫設定，不能為了幾個選項把紫微（iztro 約 51KB）一起載進來。
// 計算在各自的模組：瑪雅曆 maya-kin.js（kinOf 的 count）、紫微 ziwei.js（buildZiwei 的 school、yearDivide、sect）。

/**
 * 瑪雅曆的兩種算法：13 月亮曆（José Argüelles 1987 年設計，台灣多數老師用；2/29 不算一天）、
 * 傳統馬雅曆（瓜地馬拉 K'iche' 族至今使用的 260 天日曆，每天都算；同一天的圖騰常和 13 月亮曆不同）
 */
export const MAYA_COUNTS = [
  { value: 'dreamspell', label: '13 月亮曆（預設）' },
  { value: 'traditional', label: '傳統馬雅曆' },
];

/** 紫微派別（iztro 支援的排法）：中州派實測主星、四化和通行版相同，差在劫殺、大耗、龍德、截空、天使天傷這些雜曜 */
export const ZIWEI_SCHOOLS = [
  { value: 'default', label: '通行版（預設）' },
  { value: 'zhongzhou', label: '中州派' },
];

/** 紫微年分界：農曆正月初一換年（預設）或立春換年；立春到春節之間出生的人年干不同，四化跟著變 */
export const ZIWEI_YEARS = [
  { value: 'normal', label: '農曆正月初一（預設）' },
  { value: 'exact', label: '立春' },
];
