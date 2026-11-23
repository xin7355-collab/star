// 出生地清單（縣市政府或市中心附近座標）。經度誤差 0.1° 只影響上升點約 0.4 分鐘，
// 對整宮制的星座判斷影響極小。清單之外請選「自訂經緯度」。

export const PLACE_GROUPS = [
  {
    label: '台灣',
    places: [
      ['taipei', '臺北市', 25.0375, 121.5637, 'Asia/Taipei'],
      ['newtaipei', '新北市', 25.012, 121.465, 'Asia/Taipei'],
      ['keelung', '基隆市', 25.1276, 121.7392, 'Asia/Taipei'],
      ['taoyuan', '桃園市', 24.9936, 121.301, 'Asia/Taipei'],
      ['hsinchucity', '新竹市', 24.8138, 120.9675, 'Asia/Taipei'],
      ['hsinchu', '新竹縣', 24.8387, 121.0177, 'Asia/Taipei'],
      ['miaoli', '苗栗縣', 24.5602, 120.8214, 'Asia/Taipei'],
      ['taichung', '臺中市', 24.1477, 120.6736, 'Asia/Taipei'],
      ['changhua', '彰化縣', 24.0809, 120.5385, 'Asia/Taipei'],
      ['nantou', '南投縣', 23.9157, 120.6639, 'Asia/Taipei'],
      ['yunlin', '雲林縣', 23.7092, 120.5434, 'Asia/Taipei'],
      ['chiayicity', '嘉義市', 23.4801, 120.4491, 'Asia/Taipei'],
      ['chiayi', '嘉義縣', 23.459, 120.332, 'Asia/Taipei'],
      ['tainan', '臺南市', 22.9999, 120.227, 'Asia/Taipei'],
      ['kaohsiung', '高雄市', 22.6273, 120.3014, 'Asia/Taipei'],
      ['pingtung', '屏東縣', 22.669, 120.4862, 'Asia/Taipei'],
      ['yilan', '宜蘭縣', 24.757, 121.753, 'Asia/Taipei'],
      ['hualien', '花蓮縣', 23.9872, 121.6016, 'Asia/Taipei'],
      ['taitung', '臺東縣', 22.7583, 121.1444, 'Asia/Taipei'],
      ['penghu', '澎湖縣', 23.5655, 119.5793, 'Asia/Taipei'],
      ['kinmen', '金門縣', 24.4337, 118.3171, 'Asia/Taipei'],
      ['lienchiang', '連江縣（馬祖）', 26.1505, 119.9499, 'Asia/Taipei'],
    ],
  },
  {
    label: '海外',
    places: [
      ['hongkong', '香港', 22.3193, 114.1694, 'Asia/Hong_Kong'],
      ['macau', '澳門', 22.1987, 113.5439, 'Asia/Macau'],
      ['shanghai', '上海', 31.2304, 121.4737, 'Asia/Shanghai'],
      ['beijing', '北京', 39.9042, 116.4074, 'Asia/Shanghai'],
      ['tokyo', '東京', 35.6762, 139.6503, 'Asia/Tokyo'],
      ['seoul', '首爾', 37.5665, 126.978, 'Asia/Seoul'],
      ['singapore', '新加坡', 1.3521, 103.8198, 'Asia/Singapore'],
      ['kualalumpur', '吉隆坡', 3.139, 101.6869, 'Asia/Kuala_Lumpur'],
      ['bangkok', '曼谷', 13.7563, 100.5018, 'Asia/Bangkok'],
      ['manila', '馬尼拉', 14.5995, 120.9842, 'Asia/Manila'],
      ['sydney', '雪梨', -33.8688, 151.2093, 'Australia/Sydney'],
      ['melbourne', '墨爾本', -37.8136, 144.9631, 'Australia/Melbourne'],
      ['auckland', '奧克蘭', -36.8485, 174.7633, 'Pacific/Auckland'],
      ['london', '倫敦', 51.5074, -0.1278, 'Europe/London'],
      ['paris', '巴黎', 48.8566, 2.3522, 'Europe/Paris'],
      ['berlin', '柏林', 52.52, 13.405, 'Europe/Berlin'],
      ['newyork', '紐約', 40.7128, -74.006, 'America/New_York'],
      ['chicago', '芝加哥', 41.8781, -87.6298, 'America/Chicago'],
      ['houston', '休士頓', 29.7604, -95.3698, 'America/Chicago'],
      ['losangeles', '洛杉磯', 34.0522, -118.2437, 'America/Los_Angeles'],
      ['sanfrancisco', '舊金山', 37.7749, -122.4194, 'America/Los_Angeles'],
      ['seattle', '西雅圖', 47.6062, -122.3321, 'America/Los_Angeles'],
      ['vancouver', '溫哥華', 49.2827, -123.1207, 'America/Vancouver'],
      ['toronto', '多倫多', 43.6532, -79.3832, 'America/Toronto'],
    ],
  },
].map((g) => ({
  label: g.label,
  places: g.places.map(([id, name, lat, lon, tz]) => ({ id, name, lat, lon, tz })),
}));

export const PLACES = Object.fromEntries(PLACE_GROUPS.flatMap((g) => g.places).map((p) => [p.id, p]));

export function validateCoords(lat, lon) {
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || la <= -90 || la >= 90) return { ok: false, error: '緯度要在 -90 到 90 之間（北緯為正）' };
  if (!Number.isFinite(lo) || lo < -180 || lo > 180) return { ok: false, error: '經度要在 -180 到 180 之間（東經為正）' };
  return { ok: true, value: { lat: la, lon: lo } };
}
