// js/weather.js — WEATHER · 大氣感測站
// 資料來源：Open-Meteo (open-meteo.com) — 免費、免 API key、CORS 友善

/* ============================================================
   WMO 天氣代碼
   ============================================================ */
const WMO = {
  0:  { zh:'晴朗',       emoji:'☀️'  },
  1:  { zh:'大致晴朗',   emoji:'🌤️' },
  2:  { zh:'局部多雲',   emoji:'⛅'  },
  3:  { zh:'陰天',       emoji:'☁️'  },
  45: { zh:'起霧',       emoji:'🌫️' },
  48: { zh:'霧凇',       emoji:'🌫️' },
  51: { zh:'毛毛雨',     emoji:'🌦️' },
  53: { zh:'毛毛雨',     emoji:'🌦️' },
  55: { zh:'大毛毛雨',   emoji:'🌦️' },
  61: { zh:'小雨',       emoji:'🌧️' },
  63: { zh:'中雨',       emoji:'🌧️' },
  65: { zh:'大雨',       emoji:'🌧️' },
  71: { zh:'小雪',       emoji:'🌨️' },
  73: { zh:'中雪',       emoji:'🌨️' },
  75: { zh:'大雪',       emoji:'🌨️' },
  77: { zh:'冰晶',       emoji:'🌨️' },
  80: { zh:'短暫陣雨',   emoji:'🌦️' },
  81: { zh:'陣雨',       emoji:'🌧️' },
  82: { zh:'強陣雨',     emoji:'🌧️' },
  85: { zh:'陣雪',       emoji:'🌨️' },
  86: { zh:'強陣雪',     emoji:'🌨️' },
  95: { zh:'雷雨',       emoji:'⛈️'  },
  96: { zh:'雷雨夾冰雹', emoji:'⛈️'  },
  99: { zh:'強雷雨',     emoji:'⛈️'  },
};
function wmoInfo(code) { return WMO[code] ?? { zh:'未知', emoji:'🌡️' }; }

/* ============================================================
   縣市 + 鄉鎮座標
   ============================================================ */
const CITY_COORDS = {
  '臺北市': { lat:25.0478, lon:121.5319, districts:{
    '信義區':{lat:25.0330,lon:121.5654},'大安區':{lat:25.0262,lon:121.5436},
    '中正區':{lat:25.0435,lon:121.5198},'中山區':{lat:25.0627,lon:121.5328},
    '松山區':{lat:25.0503,lon:121.5773},'內湖區':{lat:25.0837,lon:121.5871},
    '士林區':{lat:25.0931,lon:121.5232},'北投區':{lat:25.1318,lon:121.5003},
    '南港區':{lat:25.0541,lon:121.6070},'文山區':{lat:24.9976,lon:121.5712},
    '萬華區':{lat:25.0336,lon:121.4995},'大同區':{lat:25.0632,lon:121.5128},
  }},
  '新北市': { lat:25.0121, lon:121.4652, districts:{
    '板橋區':{lat:25.0127,lon:121.4652},'新莊區':{lat:25.0367,lon:121.4404},
    '三重區':{lat:25.0640,lon:121.4867},'中和區':{lat:24.9970,lon:121.4947},
    '永和區':{lat:25.0126,lon:121.5169},'土城區':{lat:24.9729,lon:121.4389},
    '樹林區':{lat:24.9884,lon:121.4115},'新店區':{lat:24.9694,lon:121.5375},
    '汐止區':{lat:25.0669,lon:121.6610},'淡水區':{lat:25.1689,lon:121.4480},
    '三峽區':{lat:24.9328,lon:121.3713},'蘆洲區':{lat:25.0860,lon:121.4763},
  }},
  '桃園市': { lat:24.9937, lon:121.3009, districts:{
    '桃園區':{lat:24.9937,lon:121.3009},'中壢區':{lat:24.9658,lon:121.2246},
    '八德區':{lat:24.9459,lon:121.2841},'蘆竹區':{lat:25.0601,lon:121.3003},
    '龜山區':{lat:25.0356,lon:121.3480},'平鎮區':{lat:24.9432,lon:121.2163},
  }},
  '臺中市': { lat:24.1477, lon:120.6736, districts:{
    '中區':{lat:24.1378,lon:120.6849},'西屯區':{lat:24.1613,lon:120.6208},
    '北屯區':{lat:24.1810,lon:120.7135},'南屯區':{lat:24.1181,lon:120.6398},
    '豐原區':{lat:24.2539,lon:120.7196},'大里區':{lat:24.1054,lon:120.6835},
  }},
  '臺南市': { lat:22.9999, lon:120.2269, districts:{
    '中西區':{lat:22.9913,lon:120.2024},'東區':{lat:22.9960,lon:120.2280},
    '北區':{lat:23.0192,lon:120.2137},'安平區':{lat:23.0028,lon:120.1607},
    '仁德區':{lat:22.9389,lon:120.2225},'永康區':{lat:23.0354,lon:120.2619},
  }},
  '高雄市': { lat:22.6273, lon:120.3014, districts:{
    '鼓山區':{lat:22.6570,lon:120.2918},'左營區':{lat:22.6917,lon:120.2951},
    '楠梓區':{lat:22.7346,lon:120.3269},'三民區':{lat:22.6472,lon:120.3050},
    '苓雅區':{lat:22.6223,lon:120.3161},'鳳山區':{lat:22.6263,lon:120.3571},
    '前鎮區':{lat:22.5926,lon:120.3146},'小港區':{lat:22.5639,lon:120.3418},
  }},
  '基隆市': { lat:25.1276, lon:121.7392, districts:{
    '仁愛區':{lat:25.1286,lon:121.7412},'中正區':{lat:25.1205,lon:121.7472},
    '安樂區':{lat:25.1325,lon:121.7087},'暖暖區':{lat:25.1074,lon:121.7597},
  }},
  '新竹市': { lat:24.8138, lon:120.9675, districts:{
    '東區':{lat:24.8099,lon:120.9873},'北區':{lat:24.8384,lon:120.9645},'香山區':{lat:24.7784,lon:120.9347},
  }},
  '嘉義市': { lat:23.4801, lon:120.4491, districts:{
    '東區':{lat:23.4820,lon:120.4583},'西區':{lat:23.4790,lon:120.4399},
  }},
  '新竹縣': { lat:24.8388, lon:121.0177, districts:{
    '竹北市':{lat:24.8427,lon:121.0153},'竹東鎮':{lat:24.7363,lon:121.0929},'新埔鎮':{lat:24.8338,lon:121.0731},
  }},
  '苗栗縣': { lat:24.5602, lon:120.8214, districts:{
    '苗栗市':{lat:24.5602,lon:120.8214},'頭份市':{lat:24.6905,lon:120.8771},'竹南鎮':{lat:24.6853,lon:120.8621},
  }},
  '彰化縣': { lat:24.0795, lon:120.5366, districts:{
    '彰化市':{lat:24.0795,lon:120.5366},'員林市':{lat:23.9582,lon:120.5742},'鹿港鎮':{lat:24.0480,lon:120.4342},
  }},
  '南投縣': { lat:23.9600, lon:120.9718, districts:{
    '南投市':{lat:23.9122,lon:120.6834},'埔里鎮':{lat:23.9609,lon:120.9718},'草屯鎮':{lat:23.9732,lon:120.7395},
  }},
  '雲林縣': { lat:23.7092, lon:120.4313, districts:{
    '斗六市':{lat:23.7092,lon:120.5440},'斗南鎮':{lat:23.6785,lon:120.4827},'虎尾鎮':{lat:23.7069,lon:120.4301},
  }},
  '嘉義縣': { lat:23.4518, lon:120.2555, districts:{
    '太保市':{lat:23.4518,lon:120.2555},'朴子市':{lat:23.4626,lon:120.2440},'水上鄉':{lat:23.4115,lon:120.3048},
  }},
  '屏東縣': { lat:22.6714, lon:120.4878, districts:{
    '屏東市':{lat:22.6714,lon:120.4878},'潮州鎮':{lat:22.5510,lon:120.5434},'恆春鎮':{lat:22.0033,lon:120.7452},
  }},
  '宜蘭縣': { lat:24.6917, lon:121.7600, districts:{
    '宜蘭市':{lat:24.7573,lon:121.7533},'羅東鎮':{lat:24.6774,lon:121.7694},'蘇澳鎮':{lat:24.5974,lon:121.8527},
  }},
  '花蓮縣': { lat:23.9871, lon:121.6015, districts:{
    '花蓮市':{lat:23.9871,lon:121.6015},'吉安鄉':{lat:23.9659,lon:121.5836},'鳳林鎮':{lat:23.7468,lon:121.4636},
  }},
  '臺東縣': { lat:22.7583, lon:121.1444, districts:{
    '臺東市':{lat:22.7583,lon:121.1444},'卑南鄉':{lat:22.7166,lon:121.1078},'成功鎮':{lat:23.1003,lon:121.3795},
  }},
  '澎湖縣': { lat:23.5711, lon:119.5793, districts:{
    '馬公市':{lat:23.5658,lon:119.5673},'湖西鄉':{lat:23.6039,lon:119.6373},'白沙鄉':{lat:23.6733,lon:119.5956},
  }},
  '金門縣': { lat:24.4493, lon:118.3767, districts:{
    '金城鎮':{lat:24.4307,lon:118.3184},'金湖鎮':{lat:24.4493,lon:118.3767},'金沙鎮':{lat:24.4992,lon:118.4212},
  }},
  '連江縣': { lat:26.1539, lon:119.9497, districts:{
    '南竿鄉':{lat:26.1600,lon:119.9390},'北竿鄉':{lat:26.2274,lon:120.0047},'東引鄉':{lat:26.3680,lon:120.4964},
  }},
};

/* ============================================================
   STATE
   ============================================================ */
const WX_CACHE_KEY = 'lcars_wx_om_v3';
const WX_CACHE_TTL = 10 * 60 * 1000;

let wxCity     = '新北市';
let wxDistrict = '';
let wxData     = null;
let wxLoading  = false;
let wxSunTimer = null;

try {
  const c = localStorage.getItem('lcars_wx_city');
  const d = localStorage.getItem('lcars_wx_district');
  if (c && CITY_COORDS[c]) wxCity = c;
  if (d) wxDistrict = d;
} catch(e) {}

/* ============================================================
   FETCH
   ============================================================ */
function wxGetCoords() {
  const city = CITY_COORDS[wxCity];
  if (!city) return { lat:25.01, lon:121.46 };
  if (wxDistrict && city.districts?.[wxDistrict]) return city.districts[wxDistrict];
  return { lat:city.lat, lon:city.lon };
}

async function fetchWeatherPage() {
  if (wxLoading) return;
  wxLoading = true;
  const loadEl = document.getElementById('wx-loading');
  const errEl  = document.getElementById('wx-error');
  if (loadEl) loadEl.hidden = false;
  if (errEl)  errEl.hidden  = true;

  const { lat, lon } = wxGetCoords();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure,uv_index&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&timezone=Asia%2FTaipei&forecast_days=7`;

  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    wxData = { city:wxCity, district:wxDistrict, data, ts:Date.now() };
    try { localStorage.setItem(WX_CACHE_KEY, JSON.stringify(wxData)); } catch(e) {}
    renderWeatherAll();
  } catch(err) {
    console.warn('[wx]', err);
    if (errEl) { errEl.hidden = false; errEl.textContent = '⚠ ' + err.message; }
  } finally {
    wxLoading = false;
    if (loadEl) loadEl.hidden = true;
  }
}

function wxLoadCache() {
  try {
    const raw = localStorage.getItem(WX_CACHE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || (Date.now() - d.ts) > WX_CACHE_TTL) return false;
    if (d.city !== wxCity || d.district !== wxDistrict) return false;
    wxData = d;
    return true;
  } catch(e) { return false; }
}

/* ============================================================
   RENDER
   ============================================================ */
function renderWeatherAll() {
  if (!wxData?.data) return;
  const { data } = wxData;

  // 同步選擇器
  const sel  = document.getElementById('wx-city-select');
  const dsel = document.getElementById('wx-district-select');
  if (sel)  sel.value  = wxCity;
  if (dsel) dsel.value = wxDistrict;

  // 更新時間戳
  const tsEl = document.getElementById('wx-timestamp');
  if (tsEl) tsEl.textContent = new Date(wxData.ts)
    .toLocaleTimeString('zh-TW', {hour:'2-digit', minute:'2-digit'});

  renderCurrentCards(data.current);
  renderHourlyStrip(data.hourly);
  renderDailyForecast(data.daily);
  renderSunArc(data.daily);
}

/* ---- 頂部四格即時資料 ---- */
function renderCurrentCards(cur) {
  if (!cur) return;
  const info  = wmoInfo(cur.weather_code);
  const temp  = cur.temperature_2m?.toFixed(1) ?? '—';
  const feel  = cur.apparent_temperature?.toFixed(1) ?? '—';
  const humid = cur.relative_humidity_2m ?? '—';
  const pres  = cur.surface_pressure?.toFixed(0) ?? '—';
  const ws    = cur.wind_speed_10m?.toFixed(1) ?? '—';
  const wd    = degToDir(cur.wind_direction_10m);
  const uv    = cur.uv_index ?? null;
  const { uvLabel, uvCls } = uvInfo(uv);

  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const addCls = (id, c) => {
    const e = document.getElementById(id); if (!e) return;
    e.className = e.className.replace(/\buv-\S+/g,'').trim();
    if (c) e.classList.add(c);
  };

  set('wx-val-temp',    temp + '°C');
  set('wx-val-feel',    '體感 ' + feel + '°C');
  set('wx-val-icon',    info.emoji);
  set('wx-val-desc',    info.zh);
  set('wx-val-wind',    ws + ' m/s');
  set('wx-val-wd',      wd);
  set('wx-val-humid',   humid + '%');
  set('wx-val-pres',    pres + ' hPa');
  set('wx-val-uv',      uv != null ? uv.toFixed(1) : '—');
  set('wx-val-uvlabel', uvLabel);
  addCls('wx-val-uv',      uvCls);
  addCls('wx-val-uvlabel', uvCls);

  // UV 卡片邊框
  const uvCard = document.getElementById('wx-card-uv');
  if (uvCard) {
    uvCard.style.borderColor = '';
    uvCard.className = 'info-card gold';
    if (uv != null) {
      if      (uv > 10) uvCard.style.borderColor = '#cc44cc';
      else if (uv > 7)  uvCard.style.borderColor = 'var(--lcars-rust)';
      else if (uv > 5)  uvCard.className = 'info-card amber';
    }
  }
}

/* ---- 逐小時 ---- */
function renderHourlyStrip(hourly) {
  const el = document.getElementById('wx-hourly');
  if (!el || !hourly) return;
  const now   = new Date();
  const times = hourly.time ?? [];
  let si = times.findIndex(t => new Date(t) >= now);
  if (si < 0) si = 0;
  el.innerHTML = times.slice(si, si + 13).map((t, i) => {
    const dt   = new Date(t);
    const info = wmoInfo(hourly.weather_code?.[si+i] ?? 0);
    const tmp  = hourly.temperature_2m?.[si+i];
    const pop  = hourly.precipitation_probability?.[si+i] ?? 0;
    const isNow = i === 0;
    return `<div class="wx-hr-card${isNow?' now':''}">
      <div class="wx-hr-time">${isNow?'現在':dt.getHours()+':00'}</div>
      <div class="wx-hr-icon">${info.emoji}</div>
      <div class="wx-hr-temp">${tmp?.toFixed(0)??'—'}°</div>
      <div class="wx-hr-pop">💧${pop}%</div>
    </div>`;
  }).join('');
}

/* ---- 七天預報（卡片磚塊版）---- */
function renderDailyForecast(daily) {
  const el = document.getElementById('wx-daily');
  if (!el || !daily) return;
  const today  = new Date().toDateString();
  const allHi  = (daily.temperature_2m_max ?? []).map(Number);
  const allLo  = (daily.temperature_2m_min ?? []).map(Number);
  const rMax   = Math.max(...allHi);
  const rMin   = Math.min(...allLo);
  const rSpan  = rMax - rMin || 1;

  el.innerHTML = (daily.time ?? []).map((ds, i) => {
    const d    = new Date(ds + 'T12:00');
    const info = wmoInfo(daily.weather_code?.[i] ?? 0);
    const hi   = allHi[i]?.toFixed(0) ?? '—';
    const lo   = allLo[i]?.toFixed(0) ?? '—';
    const pop  = daily.precipitation_probability_max?.[i] ?? 0;
    const uv   = daily.uv_index_max?.[i];
    const { uvLabel, uvCls } = uvInfo(uv);
    const isTd = d.toDateString() === today;
    const wd   = isTd ? '今天' : d.toLocaleDateString('zh-TW',{weekday:'short'});
    const md   = d.toLocaleDateString('zh-TW',{month:'numeric',day:'numeric'});
    // 溫度長條
    const bL   = ((allLo[i]-rMin)/rSpan*100).toFixed(1);
    const bW   = ((allHi[i]-allLo[i])/rSpan*100).toFixed(1);

    return `<div class="wx-day-card${isTd?' today':''}">
      <div class="wx-dc-top">
        <div class="wx-dc-day${isTd?' today-wd':''}">${wd}</div>
        <div class="wx-dc-date">${md}</div>
      </div>
      <div class="wx-dc-icon">${info.emoji}</div>
      <div class="wx-dc-desc">${info.zh}</div>
      <div class="wx-dc-bar-track">
        <div class="wx-dc-bar-fill" style="left:${bL}%;width:${bW}%"></div>
      </div>
      <div class="wx-dc-temps">
        <span class="lo">${lo}°</span>
        <span class="hi">${hi}°</span>
      </div>
      <div class="wx-dc-pop">💧${pop}%</div>
      ${uv!=null?`<div class="wx-dc-uv ${uvCls}">${uvLabel}</div>`:''}
    </div>`;
  }).join('');
}

/* ---- 日出日落 Canvas ---- */
function renderSunArc(daily) {
  const canvas = document.getElementById('wx-sun-arc');
  if (!canvas || !daily) return;
  const sr = daily.sunrise?.[0], ss = daily.sunset?.[0];
  if (!sr || !ss) return;

  const ctx  = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const now    = new Date();
  const srT    = new Date(sr), ssT = new Date(ss);
  const dayMin = (ssT - srT) / 60000;
  const nowMin = (now - srT) / 60000;
  const prog   = Math.max(0, Math.min(1, nowMin / dayMin));
  const isDay  = now >= srT && now <= ssT;

  const cx = W/2, cy = H - 14, r = W/2 - 14;

  // 軌道
  ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1.5; ctx.stroke();

  // 已走過的軌跡
  if (isDay && prog > 0) {
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI*(1+prog), false);
    ctx.strokeStyle = 'rgba(255,160,60,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  }

  // 太陽/月亮
  const angle = Math.PI * (1 + prog);
  const sx = cx + r * Math.cos(Math.PI - prog*Math.PI);
  const sy = cy - r * Math.sin(prog*Math.PI);
  const sr2 = isDay ? 9 : 6;

  if (isDay) {
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr2*2.5);
    g.addColorStop(0,'rgba(255,200,60,0.35)'); g.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(sx, sy, sr2*2.5, 0, Math.PI*2);
    ctx.fillStyle = g; ctx.fill();
  }
  ctx.beginPath(); ctx.arc(sx, sy, sr2, 0, Math.PI*2);
  ctx.fillStyle = isDay ? '#ffc040' : 'rgba(180,190,220,0.6)'; ctx.fill();

  // 地平線
  ctx.beginPath(); ctx.moveTo(cx-r-8, cy); ctx.lineTo(cx+r+8, cy);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();

  const fmt = t => new Date(t).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
  ctx.font = '11px Antonio, monospace';
  ctx.fillStyle = 'rgba(255,190,90,0.75)';
  ctx.textAlign = 'left';  ctx.fillText('↑ ' + fmt(sr), 6, H-3);
  ctx.textAlign = 'right'; ctx.fillText('↓ ' + fmt(ss), W-6, H-3);

  if (isDay) {
    const lbl = now.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
    ctx.font = '10px Antonio, monospace';
    ctx.fillStyle = 'rgba(255,210,80,0.95)'; ctx.textAlign = 'center';
    const ly = sy < H/2 ? sy + 16 : sy - 10;
    ctx.fillText(lbl, sx, Math.max(14, Math.min(ly, H-18)));
  }
}

/* ============================================================
   UTILITY
   ============================================================ */
function degToDir(deg) {
  if (deg == null) return '—';
  const d=['北','北北東','東北','東北東','東','東南東','東南','南南東',
            '南','南南西','西南','西南西','西','西北西','西北','北北西'];
  return d[Math.round(deg/22.5)%16];
}
function uvInfo(n) {
  if (n==null||isNaN(n)) return {uvLabel:'—',    uvCls:''};
  if (n<=2)  return {uvLabel:'低量級', uvCls:'uv-low'};
  if (n<=5)  return {uvLabel:'中量級', uvCls:'uv-mid'};
  if (n<=7)  return {uvLabel:'高量級', uvCls:'uv-high'};
  if (n<=10) return {uvLabel:'過量級', uvCls:'uv-vhigh'};
  return           {uvLabel:'危險級', uvCls:'uv-extreme'};
}

/* ============================================================
   城市 / 鄉鎮選擇
   ============================================================ */
function wxChangeCity(val) {
  if (!CITY_COORDS[val]) return;
  wxCity = val; wxDistrict = '';
  try { localStorage.setItem('lcars_wx_city', val);    } catch(e) {}
  try { localStorage.setItem('lcars_wx_district', ''); } catch(e) {}
  try { localStorage.removeItem(WX_CACHE_KEY);         } catch(e) {}
  wxData = null;
  wxPopulateDistricts();
  fetchWeatherPage();
  if (typeof beep==='function') beep(540);
}
function wxChangeDistrict(val) {
  wxDistrict = val;
  try { localStorage.setItem('lcars_wx_district', val); } catch(e) {}
  try { localStorage.removeItem(WX_CACHE_KEY);          } catch(e) {}
  wxData = null;
  fetchWeatherPage();
  if (typeof beep==='function') beep(520);
}
function wxPopulateDistricts() {
  const sel = document.getElementById('wx-district-select');
  if (!sel) return;
  const keys = Object.keys(CITY_COORDS[wxCity]?.districts ?? {});
  if (!keys.length) { sel.innerHTML='<option value="">—</option>'; sel.disabled=true; return; }
  sel.disabled  = false;
  sel.innerHTML = `<option value="">全區</option>`
    + keys.map(k=>`<option value="${k}"${k===wxDistrict?' selected':''}>${k}</option>`).join('');
}
window.wxChangeCity     = wxChangeCity;
window.wxChangeDistrict = wxChangeDistrict;

/* ============================================================
   INIT
   ============================================================ */
function initWeather() {
  const sel = document.getElementById('wx-city-select');
  if (sel && !sel.options.length) {
    sel.innerHTML = Object.keys(CITY_COORDS)
      .map(k=>`<option value="${k}"${k===wxCity?' selected':''}>${k}</option>`).join('');
  }
  wxPopulateDistricts();
  if (wxLoadCache()) renderWeatherAll();
  fetchWeatherPage();
  clearInterval(wxSunTimer);
  wxSunTimer = setInterval(()=>{ if (wxData?.data?.daily) renderSunArc(wxData.data.daily); }, 60000);
}
window.initWeather      = initWeather;
window.fetchWeatherPage = fetchWeatherPage;
