// 一個人的各系統命盤一次算好：綜合解讀、工作與方向、開運佈置、解惑共用同一份結果。
// 為什麼要共用：每個畫面各自組一次很容易漏掉多胞胎借宮、瑪雅加時分這類細節，同一個人在不同畫面看到不同說法。

/**
 * @param ctx app 的共用介面（natalOf、getSettings）
 * @param p 名單上的人
 * @param input ctx.inputOf(p) 的出生資料
 * @param opts { gender, sect, solarTime, today }
 * @param {{mayaTime?:{h,mi}|null, withName?:boolean}} extra
 */
export async function loadProfile(ctx, p, input, opts, { mayaTime = null, withName = true } = {}) {
  const [B, Z, M, C, CAL, R, NM] = await Promise.all([
    import('../core/bazi.js'), import('../core/ziwei.js'), import('../core/maya.js'), import('../core/chenggu.js'),
    import('../core/calendar.js'), import('../core/reading.js'), withName && p.fullName ? import('../core/name.js') : null,
  ]);
  const natal = ctx.natalOf(p);
  const bz = B.buildBazi(input, opts);
  const bazi = bz.ok ? bz : null;
  const zw = input.time && (p.gender === '男' || p.gender === '女') ? Z.buildZiwei(input, { gender: p.gender, solarTime: opts.solarTime, at: opts.today }) : null;
  let chenggu = null;
  if (input.time && bazi) {
    const clk = B.baziClock(input, { solarTime: opts.solarTime });
    if (clk.ok) {
      const l = CAL.solarToLunar(clk.clock);
      chenggu = C.chengGu({ yearGanZhi: bazi.pillars[0].gan + bazi.pillars[0].zhi, lunarMonth: l.month, lunarDay: l.day, hour: clk.clock.h });
    }
  }
  let name = null;
  if (NM) {
    try {
      name = NM.analyzeName(p.fullName, await NM.loadNameData(), { bazi });
    } catch {
      name = null; // 康熙筆畫資料載入失敗時，其他系統照常解讀
    }
  }
  const maya = M.computeMaya(input.date, mayaTime);
  const reading = R.buildReading({
    natal, bazi, ziwei: zw && zw.ok ? zw : null, birth: input.date, maya, name, chenggu,
    today: opts.today, gender: p.gender || null, birthOrder: p.birthOrder || 0, twinMethod: ctx.getSettings().twinMethod, bloodType: p.bloodType || '',
  });
  // 多胞胎借宮後的紫微盤（綜合解讀內部也用這張）
  const ziwei = zw && zw.ok ? (reading.twins && reading.twins.shift ? R.rotateZiwei(zw, reading.twins.shift) : zw) : null;
  // 綜合解讀用到月柱、時柱和紫微命宮：出生時間靠近交界時先講一句，細節在八字、紫微命盤上方
  const edgeParts = [];
  if (bazi && bazi.edges.month && !bazi.edges.month.byDay) edgeParts.push(bazi.edges.month.pillars.年柱 ? '年柱、月柱' : '月柱');
  if (bazi && bazi.edges.hour && bazi.edges.hour.pillars.日柱) edgeParts.push('日柱');
  if (bazi && ((bazi.edges.hour && bazi.edges.hour.pillars.時柱) || bazi.edges.solar)) edgeParts.push('時柱');
  if (zw && zw.ok && zw.uncertain.length) edgeParts.push('紫微命宮');
  const edgeNote = edgeParts.length ? `出生時間靠近交界：${edgeParts.join('、')}可能不同，下面的解讀也會跟著變；細節看八字、紫微命盤上方的提醒。` : null;
  const missing = [];
  if (!input.time) missing.push('出生時間（上升星座、紫微、稱骨）');
  if (!p.gender) missing.push('性別（紫微、大運、個人吉方）');
  if (!p.fullName) missing.push('本名（姓名學）');
  if (!p.bloodType) missing.push('血型（選填）');
  return { natal, bazi, ziwei, ziweiError: zw && !zw.ok ? zw.error : null, maya, name, chenggu, reading, lifePathNumber: reading.lifePathNumber, missing, edgeNote };
}
