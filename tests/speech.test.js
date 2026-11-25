// 朗讀：文字換成唸得順的說法、切短句、朗讀稿內容、只挑內建語音（雲端語音會把文字送出去）。離線可跑。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakable, chunks, todayScript } from '../js/core/speech.js';
import { pickVoice } from '../js/ui/speak.js';

test('符號換成唸得順的說法', () => {
  assert.equal(speakable('11/26（四）・農曆十月十八・甲辰日'), '11月26日星期四，農曆十月十八，甲辰日');
  assert.equal(speakable('好時段：13:00～15:00、9:30'), '好時段：13點到15點、9點30分');
  assert.equal(speakable('水星逆行 11/7–12/6「合約」／交通'), '水星逆行 11月7日到12月6日合約或交通');
});

test('切短句：句號後切、太長的從逗號切，每段不超過上限，內容不掉字', () => {
  const long = `${'今天適合整理桌面，'.repeat(20)}晚上早點睡。明天見！`;
  const parts = chunks(long, 50);
  assert.ok(parts.length > 3);
  for (const p of parts) assert.ok(p.length <= 50, p);
  assert.equal(parts.join(''), long);
  assert.deepEqual(chunks('第一句。第二句？第三句！'), ['第一句。', '第二句？', '第三句！']);
});

test('今天的朗讀稿：指數、要注意的、好時辰、幸運色、瑪雅印記都在，句子都不長', () => {
  const parts = todayScript({
    title: '早安，小明', dateLine: '11/26（四）・農曆十月十八・甲辰日', score: 78, level: '小吉', advice: '適合主動聯絡老朋友。',
    attention: ['今天沖戌（屬狗），屬狗的人重要的事緩一緩。'], hours: ['好時段：巳時 9:00–11:00 適合談事情。'],
    lucky: { color: '綠色', numbers: '3、8', cai: '東北' }, maya: { title: '宇宙藍猴', q: '我如何超越？' },
  });
  const all = parts.join('');
  for (const s of ['早安，小明', '11月26日星期四', '今日指數 78 分，小吉', '屬狗的人重要的事緩一緩', '9點到11點', '幸運色是綠色', '幸運尾數是3、8', '財神方位在東北', '瑪雅印記是宇宙藍猴', '祝你有美好的一天']) {
    assert.ok(all.includes(s), s);
  }
  for (const p of parts) assert.ok(p.length <= 100, p);
});

test('挑語音：只用裝置內建的中文語音（台灣優先），只有雲端語音時不唸', () => {
  const v = (name, lang, localService) => ({ name, lang, localService });
  assert.equal(pickVoice([v('Google 國語', 'zh-TW', false), v('Mei-Jia', 'zh-TW', true)]).voice.name, 'Mei-Jia');
  assert.equal(pickVoice([v('Sin-ji', 'zh-HK', true), v('Tingting', 'zh-CN', true)]).voice.name, 'Sin-ji');
  assert.equal(pickVoice([v('Samantha', 'en-US', true), v('Tingting', 'zh_CN', true)]).voice.name, 'Tingting');
  assert.deepEqual(pickVoice([v('Google 國語', 'zh-TW', false), v('Samantha', 'en-US', true)]), { voice: null, known: true });
  assert.deepEqual(pickVoice([]), { voice: null, known: false });
});
