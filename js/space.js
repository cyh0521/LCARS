// js/space.js — SPACE · 太空觀測站

const APOD_CACHE_KEY    = 'lcars_apod_v2';
const VOYAGER_CACHE_KEY = 'lcars_voyager_v2';
const APOD_KEY          = 'DEMO_KEY';
const APOD_CACHE_TTL    = 86400000 * 7; // 7 days in localStorage

let spaceInited  = false;

/* ============================================================
   APOD
   ============================================================ */
async function fetchAPOD() {
  // Use localStorage for long-term cache (survives session restarts)
  let cached = null;
  try {
    const raw = localStorage.getItem(APOD_CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch(e) {}

  // Show cached immediately if available
  if (cached?.url) renderAPOD(cached);

  // Only fetch if cache is older than 1 day
  const cacheAge = cached?.fetchedAt ? (Date.now() - cached.fetchedAt) : Infinity;
  if (cacheAge < 86400000) return; // fresh enough

  try {
    const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${APOD_KEY}&thumbs=true`);
    if (res.status === 429) {
      if (!cached) showAPODNote('NASA API 今日請求次數已達上限，請稍後再試。');
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    data.fetchedAt = Date.now();
    try { localStorage.setItem(APOD_CACHE_KEY, JSON.stringify(data)); } catch(e) {}
    renderAPOD(data);
  } catch(e) {
    if (!cached) showAPODNote('APOD 資料載入失敗：' + e.message);
  }
}

function showAPODNote(msg) {
  const ph = document.getElementById('sp-apod-placeholder');
  if (ph) {
    ph.innerHTML = `<span style="font-size:11px;color:#3a4a5a;letter-spacing:.08em;padding:12px;text-align:center">${msg}</span>`;
    ph.style.display = 'flex';
  }
}

function renderAPOD(data) {
  const imgEl   = document.getElementById('sp-apod-img');
  const linkEl  = document.getElementById('sp-apod-link');
  const phEl    = document.getElementById('sp-apod-placeholder');
  const titleEl = document.getElementById('sp-apod-title');
  const dateEl  = document.getElementById('sp-apod-date');
  const descEl  = document.getElementById('sp-apod-desc');
  const src = data.media_type === 'video' ? (data.thumbnail_url || '') : (data.url || '');
  if (imgEl && src) {
    imgEl.src = src; imgEl.alt = data.title || ''; imgEl.hidden = false;
    if (phEl) phEl.style.display = 'none';
  }
  if (linkEl) linkEl.href = data.hdurl || data.url || '#';
  if (titleEl) titleEl.textContent = data.title       || '—';
  if (dateEl)  dateEl.textContent  = data.date        || '—';
  if (descEl)  descEl.textContent  = data.explanation || '';
}


/* ============================================================
   PLANET ORBIT MAP — true perspective 3D
   Drag: azimuth (L/R) + elevation (U/D), no angle limits
   Scroll / pinch: zoom
   ============================================================ */
const PLANETS = [
  { name:'Mercury', zh:'水星', color:'#aaaaaa', au:0.387 },
  { name:'Venus',   zh:'金星', color:'#e8c97a', au:0.723 },
  { name:'Earth',   zh:'地球', color:'#4a9eff', au:1.000 },
  { name:'Mars',    zh:'火星', color:'#e07050', au:1.524 },
  { name:'Jupiter', zh:'木星', color:'#d4a96a', au:5.203 },
  { name:'Saturn',  zh:'土星', color:'#c8b87a', au:9.537 },
  { name:'Uranus',  zh:'天王', color:'#7aecd4', au:19.19 },
  { name:'Neptune', zh:'海王', color:'#5577e8', au:30.07 },
];
const VOYAGER_STATIC = {
  v1: { au:164, color:'#ff9966', label:'V1', angleDeg:258 },
  v2: { au:137, color:'#9977bb', label:'V2', angleDeg:290 },
};
let voyagerData = JSON.parse(JSON.stringify(VOYAGER_STATIC));

const VIEW = {
  azi:  0,      // azimuth radians — no limit
  elev: 1.2,    // elevation radians — no limit (π/2 = top-down)
  zoom: 1.0,
  fov:  700,    // perspective focal length (px)
  dragging: false, lastX: 0, lastY: 0, pinchDist: 0,
};
const VIEW_DEFAULTS = { azi: 0, elev: 1.2, zoom: 1.0 };

async function fetchVoyager() {
  const cached = cacheGet(VOYAGER_CACHE_KEY);
  if (cached && (Date.now() - cached.ts) < 86400000) { voyagerData = cached.data; return; }
  const base  = 'https://ssd.jpl.nasa.gov/api/horizons.api';
  const today = new Date().toISOString().slice(0,10);
  const tom   = new Date(Date.now()+86400000).toISOString().slice(0,10);
  const q = cmd =>
    `${base}?format=json&COMMAND='${cmd}'&OBJ_DATA='NO'&MAKE_EPHEM='YES'` +
    `&EPHEM_TYPE='OBSERVER'&CENTER='500@10'` +
    `&START_TIME='${today}'&STOP_TIME='${tom}'&STEP_SIZE='1d'&QUANTITIES='20'`;
  try {
    const [r1,r2] = await Promise.all([fetch(q('-31')),fetch(q('-32'))]);
    const [d1,d2] = await Promise.all([r1.json(),r2.json()]);
    const parseAU = d => { const m=(d.result||'').match(/(\d+\.\d+)/); return m?parseFloat(m[1]):null; };
    const au1=parseAU(d1), au2=parseAU(d2);
    if (au1) voyagerData.v1 = { ...VOYAGER_STATIC.v1, au:au1 };
    if (au2) voyagerData.v2 = { ...VOYAGER_STATIC.v2, au:au2 };
    cacheSet(VOYAGER_CACHE_KEY, { ts:Date.now(), data:voyagerData });
  } catch(e) {}
}

/* True perspective projection
   Ecliptic coords: x=east, y=north, z=up (AU)
   Camera rotated by azi (around Z) then elev (around X) */
function project3D(x, y, z, cx, cy, base) {
  const s = base * VIEW.zoom;
  // Azimuth rotation (around Z)
  const cosA = Math.cos(VIEW.azi), sinA = Math.sin(VIEW.azi);
  const rx =  x*cosA + y*sinA;
  const ry = -x*sinA + y*cosA;
  // Elevation rotation (around X)
  const cosE = Math.cos(VIEW.elev), sinE = Math.sin(VIEW.elev);
  const ex = rx;
  const ey = ry*cosE - z*sinE;
  const ez = ry*sinE + z*cosE;   // depth: positive = toward viewer
  // Perspective divide
  const persp = VIEW.fov / (VIEW.fov + ez * s * 0.6);
  return { px: cx + ex*s*persp, py: cy - ey*s*persp, depth: ez, scale: persp };
}

function updateHUD() {
  const aziDeg  = ((VIEW.azi  * 180/Math.PI) % 360 + 360) % 360;
  const elevDeg = VIEW.elev * 180/Math.PI;
  const a = document.getElementById('sp-orbit-azi');
  const t = document.getElementById('sp-orbit-tilt');
  const z = document.getElementById('sp-orbit-zoom');
  if (a) a.textContent = Math.round(aziDeg)  + '°';
  if (t) t.textContent = Math.round(elevDeg) + '°';
  if (z) z.textContent = VIEW.zoom.toFixed(1) + '×';
}

function drawOrbitMap() {
  const canvas = document.getElementById('sp-orbit-canvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.clientWidth  || 600;
  const H   = canvas.clientHeight || Math.round(W*9/16);
  canvas.width  = Math.round(W*dpr);
  canvas.height = Math.round(H*dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const cx = W/2, cy = H/2;
  const base = (Math.min(W,H)/2) * 0.82 / 32;  // px per AU at zoom=1

  ctx.fillStyle = '#02050a'; ctx.fillRect(0,0,W,H);

  // ── Grid rings
  [5,10,15,20,25,30].forEach(au => {
    ctx.beginPath();
    for (let i=0; i<=80; i++) {
      const a=(i/80)*Math.PI*2;
      const {px,py} = project3D(Math.cos(a)*au, Math.sin(a)*au, 0, cx,cy,base);
      i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.strokeStyle='#0d1e30'; ctx.lineWidth=1; ctx.stroke();
    const lp = project3D(au,0,0,cx,cy,base);
    ctx.font='9px Antonio,sans-serif'; ctx.fillStyle='#1a2d3e';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(au+' AU', lp.px+3, lp.py);
  });

  // ── Sun
  const sun = project3D(0,0,0,cx,cy,base);
  const sr  = Math.max(4, 7*sun.scale);
  const sg  = ctx.createRadialGradient(sun.px,sun.py,0, sun.px,sun.py,sr*3);
  sg.addColorStop(0,   'rgba(255,210,70,0.85)');
  sg.addColorStop(0.5, 'rgba(255,160,30,0.35)');
  sg.addColorStop(1,   'rgba(255,80,0,0)');
  ctx.beginPath(); ctx.arc(sun.px,sun.py,sr*3,0,Math.PI*2);
  ctx.fillStyle=sg; ctx.fill();
  ctx.beginPath(); ctx.arc(sun.px,sun.py,sr,0,Math.PI*2);
  ctx.fillStyle='#ffcc44'; ctx.shadowColor='#ffcc44'; ctx.shadowBlur=18; ctx.fill();
  ctx.shadowBlur=0;

  // ── Planet orbit rings
  PLANETS.forEach(p => {
    ctx.beginPath();
    for (let i=0; i<=80; i++) {
      const a=(i/80)*Math.PI*2;
      const {px,py} = project3D(Math.cos(a)*p.au, Math.sin(a)*p.au, 0, cx,cy,base);
      i===0 ? ctx.moveTo(px,py) : ctx.lineTo(px,py);
    }
    ctx.closePath();
    ctx.strokeStyle=p.color+'38'; ctx.lineWidth=1; ctx.stroke();
  });

  // ── Collect all objects for depth sort
  const now = new Date();
  const useLive = typeof Astronomy !== 'undefined';
  const objs = [];

  PLANETS.forEach(p => {
    let ex=p.au, ey=0, ez=0;
    if (useLive) {
      try { const v=Astronomy.HelioVector(Astronomy.Body[p.name],now); ex=v.x; ey=v.y; ez=v.z; }
      catch(e) {}
    }
    objs.push({ type:'planet', p, proj: project3D(ex,ey,ez,cx,cy,base) });
  });

  Object.values(voyagerData).forEach(v => {
    const angle = v.angleDeg*Math.PI/180;
    // Clamp to avoid going off-screen
    const maxAU  = (Math.min(W,H)/2*0.92) / (base*VIEW.zoom);
    const dispAU = Math.min(v.au, maxAU);
    objs.push({ type:'voyager', v,
      proj: project3D(Math.cos(angle)*dispAU, Math.sin(angle)*dispAU, 0, cx,cy,base) });
  });

  // Depth sort: farthest first
  objs.sort((a,b) => a.proj.depth - b.proj.depth);

  // ── Draw
  objs.forEach(({type, p, v, proj}) => {
    if (type === 'planet') {
      const pR = Math.max(2, (p.name==='Jupiter'||p.name==='Saturn' ? 6 : 4) * proj.scale);
      // Glow
      const g = ctx.createRadialGradient(proj.px,proj.py,0, proj.px,proj.py,pR*3);
      g.addColorStop(0, p.color+'88'); g.addColorStop(1, p.color+'00');
      ctx.beginPath(); ctx.arc(proj.px,proj.py,pR*3,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
      // Dot
      ctx.beginPath(); ctx.arc(proj.px,proj.py,pR,0,Math.PI*2);
      ctx.fillStyle=p.color; ctx.fill();
      // Label
      const fs = Math.round(Math.max(9, 11*proj.scale));
      ctx.font=`${fs}px Antonio,sans-serif`;
      ctx.fillStyle=p.color+'cc'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(p.zh, proj.px+pR+3, proj.py);

    } else {
      const s = Math.max(3, 5*proj.scale);
      ctx.beginPath();
      ctx.moveTo(proj.px,proj.py-s); ctx.lineTo(proj.px+s,proj.py);
      ctx.lineTo(proj.px,proj.py+s); ctx.lineTo(proj.px-s,proj.py);
      ctx.closePath();
      ctx.fillStyle=v.color; ctx.shadowColor=v.color; ctx.shadowBlur=10; ctx.fill();
      ctx.shadowBlur=0;
      const side = proj.px>cx ? 'left':'right';
      const lx   = proj.px + (proj.px>cx ? 7 : -7);
      ctx.fillStyle=v.color; ctx.textAlign=side;
      ctx.font=`bold ${Math.round(Math.max(9,10*proj.scale))}px Antonio,sans-serif`;
      ctx.textBaseline='bottom'; ctx.fillText(v.label, lx, proj.py-1);
      ctx.font=`${Math.round(Math.max(8,9*proj.scale))}px Antonio,sans-serif`;
      ctx.textBaseline='top'; ctx.fillText(v.au.toFixed(1)+' AU', lx, proj.py+2);
    }
  });

  // ── Legends
  const v1El=document.getElementById('sp-voy1-au');
  const v2El=document.getElementById('sp-voy2-au');
  if (v1El) v1El.textContent=voyagerData.v1.au.toFixed(1)+' AU';
  if (v2El) v2El.textContent=voyagerData.v2.au.toFixed(1)+' AU';
  updateHUD();
}

/* ============================================================
   INPUT HANDLERS
   ============================================================ */
function setupOrbitInteraction() {
  const wrap = document.getElementById('sp-orbit-wrap');
  if (!wrap || wrap._orbitBound) return;
  wrap._orbitBound = true;

  wrap.addEventListener('mousedown', e => {
    VIEW.dragging=true; VIEW.lastX=e.clientX; VIEW.lastY=e.clientY; e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!VIEW.dragging) return;
    VIEW.azi  += (e.clientX-VIEW.lastX)*0.008;
    VIEW.elev += (e.clientY-VIEW.lastY)*0.008;
    VIEW.lastX=e.clientX; VIEW.lastY=e.clientY;
    drawOrbitMap();
  });
  window.addEventListener('mouseup', ()=>{ VIEW.dragging=false; });

  wrap.addEventListener('wheel', e=>{
    e.preventDefault();
    VIEW.zoom = Math.max(0.2, Math.min(8, VIEW.zoom*(e.deltaY>0?0.92:1.08)));
    drawOrbitMap();
  }, {passive:false});

  wrap.addEventListener('touchstart', e=>{
    if (e.touches.length===1) {
      VIEW.dragging=true; VIEW.lastX=e.touches[0].clientX; VIEW.lastY=e.touches[0].clientY;
    } else if (e.touches.length===2) {
      VIEW.dragging=false;
      VIEW.pinchDist=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                                e.touches[0].clientY-e.touches[1].clientY);
    }
    e.preventDefault();
  }, {passive:false});

  wrap.addEventListener('touchmove', e=>{
    if (e.touches.length===1&&VIEW.dragging) {
      VIEW.azi  += (e.touches[0].clientX-VIEW.lastX)*0.008;
      VIEW.elev += (e.touches[0].clientY-VIEW.lastY)*0.008;
      VIEW.lastX=e.touches[0].clientX; VIEW.lastY=e.touches[0].clientY;
      drawOrbitMap();
    } else if (e.touches.length===2) {
      const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                         e.touches[0].clientY-e.touches[1].clientY);
      VIEW.zoom=Math.max(0.2,Math.min(8,VIEW.zoom*(d/VIEW.pinchDist)));
      VIEW.pinchDist=d; drawOrbitMap();
    }
    e.preventDefault();
  }, {passive:false});

  wrap.addEventListener('touchend', ()=>{ VIEW.dragging=false; });

  const btn=document.getElementById('sp-orbit-reset');
  if (btn) btn.addEventListener('click', ()=>{
    Object.assign(VIEW, VIEW_DEFAULTS); drawOrbitMap();
  });
}

/* ============================================================
   INIT
   ============================================================ */
function initSpace() {
  if (!spaceInited) {
    spaceInited = true;
    fetchAPOD();
    drawOrbitMap();
    fetchVoyager().then(()=>drawOrbitMap());
    const c=document.getElementById('sp-orbit-canvas');
    if (c) new ResizeObserver(()=>drawOrbitMap()).observe(c);
    setupOrbitInteraction();
  }
}

window.initSpace = initSpace;
