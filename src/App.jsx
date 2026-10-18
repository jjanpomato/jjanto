import { useState, useRef, useEffect, Fragment } from "react";
import { pushPlannerData, subscribePlannerData } from "./firebase";

const C = {
  bg:"#FFF8F6", pink1:"#FFE0D6", pink2:"#FFBCAA", pink3:"#FF7A5C",
  rose:"#E8392A", tomato:"#C0392B", text:"#2D1A14", sub:"#9A6A5A",
  border:"#FFCFC4", white:"#FFFFFF", green:"#7EC8A4",
};

// 예전 할일 기록(보관함)에서 분류 이름을 보여줄 때 써요
const CAT_DEFAULTS = [
  { id:"work",    name:"회사",  emoji:"💼", color:"#FF85A1", hidden:false },
  { id:"economy", name:"경제",  emoji:"📈", color:"#FFB347", hidden:false },
  { id:"fitness", name:"운동",  emoji:"🏃", color:"#7EC8A4", hidden:false },
  { id:"personal",name:"개인",  emoji:"🌸", color:"#B39DDB", hidden:false },
  { id:"apptech", name:"앱테크",emoji:"📱", color:"#64B5F6", hidden:false },
  { id:"event",   name:"이벤트",emoji:"🎉", color:"#F06292", hidden:false },
];

const DAYS_KO   = ["일","월","화","수","목","금","토"];

const WEEK_DAYS = [
  { key:"mon", label:"월" }, { key:"tue", label:"화" }, { key:"wed", label:"수" },
  { key:"thu", label:"목" }, { key:"fri", label:"금" },
  { key:"sat", label:"토", weekend:true }, { key:"sun", label:"일", weekend:true },
];
// 주간 표는 월~일 일정을 다 적고, 달성률도 월~일 모두 세요.
const WEEKLY_ROW_COLORS = ["#FF85A1","#FFB347","#7EC8A4","#B39DDB","#64B5F6","#F06292","#4DB6AC","#9575CD"];
function emptyWeeklyCells() { return { mon:"", tue:"", wed:"", thu:"", fri:"", sat:"", sun:"" }; }
const EMPTY_JJANTECH = { items: [], log: {} };

// 주간 표는 weeklyTable.weeks[월요일 날짜] = { v:2, rows } 형태로 주마다 따로 저장돼요.
// 행(row)은 { id, label, color, checks:{mon:true...}, off:{tue:true...} } 이고, off인 칸은 "이 날은 안 함"이라 달성률에서 빠져요.
function getWeekRows(table, wk) {
  const week = table && table.weeks && table.weeks[wk];
  return (week && Array.isArray(week.rows)) ? week.rows : [];
}
// 이번 주를 아직 안 건드렸으면 가장 최근 주의 항목·칸 내용을 그대로 이어받아요(체크만 비운 채로).
// 처음 체크하거나 고치는 순간 이번 주 것으로 따로 저장돼요.
function getEffectiveWeekRows(table, wk) {
  if (table && table.weeks && table.weeks[wk]) return getWeekRows(table, wk);
  const prev = findPrevWeekKey(table, wk);
  return prev ? getWeekRows(table, prev).map(r => ({ ...r, checks: {} })) : [];
}
function hasWeekData(table, wk) {
  return getWeekRows(table, wk).length > 0;
}
function findPrevWeekKey(table, wk) {
  const keys = Object.keys((table && table.weeks) || {}).filter(k => k < wk && hasWeekData(table, k)).sort();
  return keys.length ? keys[keys.length - 1] : null;
}
// 아주 예전 방식(weeklyTable.rows 하나를 모든 주가 공유)을 주별 데이터로 옮겨줘요
function migrateWeeklyTable(table, todayStr) {
  if (!table || !Array.isArray(table.rows) || table.rows.length === 0) return null;
  const legacyRows = table.rows;
  const weekKeys = new Set();
  legacyRows.forEach(r => Object.keys(r.checks || {}).forEach(k => weekKeys.add(k)));
  if (weekKeys.size === 0) weekKeys.add(getMonday(todayStr));
  const weeks = { ...(table.weeks || {}) };
  weekKeys.forEach(wk => {
    if (hasWeekData({ weeks }, wk)) return;
    weeks[wk] = { rows: legacyRows.map(r => ({ id: r.id, label: r.label, color: r.color, cells: { ...emptyWeeklyCells(), ...r.cells }, checks: { ...((r.checks && r.checks[wk]) || {}) } })) };
  });
  return { weeks };
}
// 예전 성장일지는 글자를 적은 칸만 달성률에 셌어요. 새 표는 모든 칸을 세니까,
// 옛 주에서 글자를 하나라도 적은 행은 빈칸을 "안 함(off)"으로 바꿔서 예전 달성률이 그대로 나오게 해요.
function migrateWeeklyOff(table) {
  const weeks = (table && table.weeks) || {};
  const oldKeys = Object.keys(weeks).filter(k => weeks[k] && weeks[k].v !== 2);
  if (oldKeys.length === 0) return null;
  const next = { ...weeks };
  oldKeys.forEach(k => {
    next[k] = { v: 2, rows: getWeekRows(table, k).map(r => {
      const cells = r.cells || {};
      const hasText = WEEK_DAYS.some(d => (cells[d.key] || "").trim());
      if (!hasText) return r;
      const off = { ...(r.off || {}) };
      WEEK_DAYS.forEach(d => { if (!(cells[d.key] || "").trim()) off[d.key] = true; });
      return { ...r, off };
    }) };
  });
  return { ...table, weeks: next };
}

function genId()     { return Math.random().toString(36).slice(2,9); }
function fmtDate(d)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function parseDate(ds) { const [y,m,d] = ds.split("-").map(Number); return new Date(y, m-1, d); }
function addDays(ds, n) { const d = parseDate(ds); d.setDate(d.getDate() + n); return fmtDate(d); }

function getMonday(ds) {
  const d = parseDate(ds);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return fmtDate(d);
}
function weekdayDates(wk) { return WEEK_DAYS.map((d, i) => ({ ...d, ds: addDays(wk, i) })); }
function weekRangeLabel(wk) {
  const mon = parseDate(wk), end = parseDate(addDays(wk, 6));
  return `${mon.getMonth()+1}/${mon.getDate()} ~ ${end.getMonth()+1}/${end.getDate()}`;
}

// 한 주(월~일)의 일간·주간 달성률을 계산해요.
// 표의 각 칸 + 짠테크 한 줄(그날 체크리스트를 전부 끝내야 완료)로 세고, 🌿쉼으로 표시한 날은 빼요.
function computeWeekStats(table, jj, wk, isRestDay) {
  const rows = getEffectiveWeekRows(table, wk);
  const days = weekdayDates(wk).map(d => {
    const rest = isRestDay(d.ds);
    const jjItems = (jj && jj.items) || [];
    const dayLog = (jj && jj.log && jj.log[d.ds]) || {};
    const jjDone = jjItems.filter(it => dayLog[it.id]).length;
    // planned: 그날 해야 했던 칸 수. 쉬는 날도 세 두면 영상 카드에서 "다 한 날"로 칠 수 있어요.
    let planned = 0, done = 0;
    rows.forEach(r => {
      if (r.off && r.off[d.key]) return;
      planned++;
      if (!rest && r.checks && r.checks[d.key]) done++;
    });
    if (jjItems.length) { planned++; if (!rest && jjDone === jjItems.length) done++; }
    const total = rest ? 0 : planned;
    if (rest) done = 0;
    return { ...d, rest, planned, total, done, pct: total ? Math.round(done / total * 100) : null, jjDone, jjTotal: jjItems.length };
  });
  const total = days.reduce((s, d) => s + d.total, 0);
  const done = days.reduce((s, d) => s + d.done, 0);
  // 영상 카드용: 쉬는 날은 계획했던 칸을 전부 한 걸로 쳐서(100%) 주간 달성률에 넣어요.
  const restPlanned = days.reduce((s, d) => s + (d.rest ? d.planned : 0), 0);
  const workDays = days.filter(d => !d.rest);
  return {
    rows, days, total, done,
    pct: total ? Math.round(done / total * 100) : null,
    cardPct: total + restPlanned ? Math.round((done + restPlanned) / (total + restPlanned) * 100) : (days.some(d => d.rest) ? 100 : null),
    income: incomeCount(table && table.weeks && table.weeks[wk]),
    jjFullDays: workDays.filter(d => d.jjTotal && d.jjDone === d.jjTotal).length,
    jjActiveDays: workDays.filter(d => d.jjTotal).length,
  };
}

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 800;
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveNodeAsImage(node, filename) {
  if (!node) return;
  import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(() => {
    window.html2canvas(node, { scale: 2, backgroundColor: "#FFFFFF" }).then(canvas => {
      const a = document.createElement("a");
      a.download = filename;
      a.href = canvas.toDataURL();
      a.click();
    });
  }).catch(() => alert("이미지 저장에 실패했어요. 화면을 캡처해서 써봐요!"));
}

const today    = new Date();
const todayStr = fmtDate(today);

function load(key,fb){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function save(key,v){ try{ localStorage.setItem(key,JSON.stringify(v)); }catch{} }

function repeatLabel(item) {
  if (item.date) return item.date.slice(5).replace("-","/");
  if (item.endDate) { return item.startDate===item.endDate ? item.startDate.slice(5).replace("-","/") : `${item.startDate.slice(5).replace("-","/")} ~ ${item.endDate.slice(5).replace("-","/")}`; }
  const type = item.repeatType || "daily";
  if (type === "daily") return "매일";
  if (type === "alternate") return "격일";
  if (type === "weekly") {
    const days = (item.weekDays||[]).slice().sort();
    if (days.length===5 && [1,2,3,4,5].every(v=>days.includes(v))) return "매주 평일";
    if (days.length===2 && [0,6].every(v=>days.includes(v))) return "매주 주말";
    const names = days.map(d=>DAYS_KO[d]);
    return names.length ? `매주 ${names.join("·")}` : "매주";
  }
  if (type === "monthly") return `매월 ${item.monthDay||1}일`;
  return "반복";
}
function repeatIcon(item) {
  if (item.date) return "✅";
  if (item.endDate) return "🗓️";
  const type = item.repeatType || "daily";
  if (type === "alternate") return "⚡";
  if (type === "weekly") return "📅";
  if (type === "monthly") return "🗓️";
  return "🔁";
}

function KoreanInput({ value, onChange, style, placeholder, autoFocus, type="text", inputMode }) {
  const composing = useRef(false);
  return <input type={type} defaultValue={value} placeholder={placeholder} autoFocus={autoFocus} inputMode={inputMode} style={style} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={(e)=>{composing.current=false;onChange(e.target.value);}} onChange={(e)=>{if(!composing.current)onChange(e.target.value);}}/>;
}
function KoreanTextarea({ value, onChange, style, placeholder, rows, onKeyDown }) {
  const composing = useRef(false);
  return <textarea defaultValue={value} placeholder={placeholder} rows={rows} style={style} onKeyDown={onKeyDown} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={(e)=>{composing.current=false;onChange(e.target.value);}} onChange={(e)=>{if(!composing.current)onChange(e.target.value);}}/>;
}
function ModalWrap({children, onClose, zIndex=100, isMobile}) {
  return <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.38)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex}} onClick={onClose}><div style={{background:C.white,borderRadius:isMobile?"20px 20px 0 0":"20px",padding:22,width:isMobile?"100%":"400px",boxShadow:`0 20px 60px ${C.pink3}55`,maxHeight:"92vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>{children}</div></div>;
}
function Ring({pct,size=56,stroke=5,color=C.rose,bg=C.pink1}) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, off=circ-(pct/100)*circ;
  return (
    <svg width={size} height={size} style={{display:"block",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dashoffset .5s"}}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle" style={{fontSize:size*.22,fontWeight:700,fill:color,fontFamily:"inherit"}}>{Math.round(pct)}%</text>
    </svg>
  );
}
const inp = {width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12,fontFamily:"inherit",background:"#FFF8FA",color:C.text};
function TomatoRow({ count }) { return <span style={{display:"inline-flex",alignItems:"center",gap:1,marginLeft:6}}>{Array.from({length:count}).map((_,i)=><span key={i} style={{fontSize:14,lineHeight:1,filter:"drop-shadow(0 1px 1px rgba(0,0,0,.1))",animation:`tomato-bounce ${0.4+i*0.15}s ease-in-out infinite alternate`}}>🍅</span>)}</span>; }
// 랜덤 종이 뽑기 보상. 일간 규칙은 하루 달성률마다, 주간 규칙은 주간 달성률로 따로 세요.
// 그 주에 초과수당·보너스·월급 같은 추가 수입이 들어오면 한 건마다 주간에 1장씩 더 뽑아요.
const DAY_PAPER_RULES  = [{ min: 100, count: 3 }, { min: 60, count: 2 }, { min: 30, count: 1 }];
const WEEK_PAPER_RULES = [{ min: 100, count: 2 }, { min: 50, count: 1 }];
// 위에서부터 처음 넘는 기준의 장수예요
// 추가 수입 건수. 예전에 켜고 끄던 값(true)은 1건으로 봐요.
function incomeCount(week) { const v = week && week.income; return v === true ? 1 : Math.max(0, Number(v) || 0); }
function paperCount(pct, rules) { const r = pct === null ? null : rules.find(r => pct >= r.min); return r ? r.count : 0; }
function tomatoCount(pct) { return pct === null ? 0 : pct === 100 ? 3 : pct >= 70 ? 2 : 1; }
const navBtn = {background:C.pink1,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.rose,fontWeight:800,fontSize:14};

// 뽑기 규칙 칸 하나: 기준(label)과 장수. hit이면 이번 주에 해당해서 빨갛게 보여요.
function PaperChip({ label, count, hit }) {
  return (
    <div style={{ flex: 1, textAlign: "center", borderRadius: 8, padding: "6px 2px", background: hit ? C.rose : C.white, border: `1px solid ${hit ? C.rose : C.border}`, color: hit ? C.white : C.sub }}>
      <div style={{ fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: hit ? C.white : C.text }}>{count}장</div>
    </div>
  );
}
const incomeBtn = on => ({ width: 20, height: 20, padding: 0, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 900, lineHeight: "20px", background: on ? "rgba(255,255,255,.3)" : C.pink1, color: on ? C.white : C.rose, fontFamily: "inherit" });

function WeeklyCheckbox({ checked, onToggle, size = 22 }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: size, height: size, borderRadius: 7, cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: checked ? "none" : `1.5px solid ${C.pink2}`,
        background: checked ? C.rose : C.white,
        transition: "all .15s",
      }}
    >
      {checked && <span style={{ color: C.white, fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  );
}

// 주간 표: 행 = 매일 하는 항목, 열 = 월~일. 맨 아래에 일간 달성률, 위에 주간 달성률이 같이 보여요.
// 짠테크는 항목이 많아서 표에는 "짠테크" 한 줄로만 들어가고, 그날 체크리스트를 다 끝내면 완료로 쳐요.
function WeeklyBoard({ isMobile, selDate, setSelDate, todayStr, stats, toggleRestDay, addWeeklyRow, updateWeeklyLabel, updateWeeklyCell, toggleWeeklyCheck, toggleWeeklyOff, removeWeeklyRow, resetWeeklyTable, changeWeekIncome, openJjantech, openSummary }) {
  const [editMode, setEditMode] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const captureRef = useRef(null);
  const wk = getMonday(selDate);
  const { rows, days } = stats;
  const hasJj = days.some(d => d.jjTotal > 0);
  const range = weekRangeLabel(wk);
  const isThisWeek = wk === getMonday(todayStr);
  const tc = tomatoCount(stats.pct);
  const dayPapers = days.reduce((s, d) => s + paperCount(d.pct, DAY_PAPER_RULES), 0);
  const weekPapers = paperCount(stats.pct, WEEK_PAPER_RULES);
  const incomePapers = stats.income;
  const papers = dayPapers + weekPapers + incomePapers;
  const cols = WEEK_DAYS.length + 1 + (editMode ? 1 : 0);

  function handleSaveTable() {
    const fname = `짠토의_주간표_${range.replace(/\s/g, "")}.png`;
    if (editMode) { setEditMode(false); setTimeout(() => saveNodeAsImage(captureRef.current, fname), 80); }
    else saveNodeAsImage(captureRef.current, fname);
  }

  // PC(넓은 화면)에서는 칸을 넓혀서 체크박스 옆에 글씨가 한 줄로 들어가게 해요
  const wide = !isMobile;
  const labelTd = { position: "sticky", left: 0, zIndex: 1, background: C.white, padding: wide ? "10px 10px 10px 4px" : "8px 6px 8px 2px", borderBottom: `1px dashed ${C.border}`, maxWidth: wide ? 180 : 64, width: wide ? 150 : undefined };
  const cellTd = d => ({ minWidth: wide ? 140 : 38, padding: wide ? "10px 6px" : "8px 1px", borderBottom: `1px dashed ${C.border}`, textAlign: "center", verticalAlign: "middle", background: d.ds === todayStr ? C.rose + "0D" : "transparent", opacity: d.rest ? .35 : 1 });

  return (
    <div style={{ maxWidth: wide ? 1240 : 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setSelDate(addDays(wk, -7))} style={navBtn}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.rose, flex: 1, textAlign: "center" }}>{range}</span>
        <button onClick={() => setSelDate(addDays(wk, 7))} style={navBtn}>›</button>
        {!isThisWeek && <button onClick={() => setSelDate(todayStr)} style={{ ...navBtn, background: C.pink2, color: C.white, fontSize: 12 }}>이번 주</button>}
        <button onClick={() => setEditMode(p => !p)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 13, background: editMode ? C.green : C.rose }}>
          {editMode ? "완료" : "편집"}
        </button>
      </div>

      <div ref={captureRef} style={{ background: C.white, borderRadius: 16, padding: 10, border: `1.5px solid ${C.border}`, boxShadow: `0 2px 10px ${C.pink1}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg,#FFF3F1,#FFE2D8)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <Ring pct={stats.pct || 0} size={60} stroke={7} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 15, fontWeight: 900, color: C.rose }}>🍅 주간 달성률{tc > 0 && <TomatoRow count={tc} />}</div>
            <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginTop: 3 }}>
              {stats.total ? `${stats.done}/${stats.total}칸 완료 · ${range}` : "아직 체크할 칸이 없어요"}
            </div>
          </div>
        </div>

        <div style={{ background: "#FFF8F6", border: `1px dashed ${C.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: C.text }}>🎟️ 랜덤 종이 뽑기 규칙</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: papers ? C.rose : C.sub }}>이번 주 총 {papers}장</span>
          </div>
          <div style={{ display: "flex", flexDirection: wide ? "row" : "column", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, marginBottom: 5 }}>📅 일간 규칙 · 하루 달성률마다 <b style={{ color: C.rose }}>{dayPapers}장</b></div>
              <div style={{ display: "flex", gap: 6 }}>
                {[...DAY_PAPER_RULES].reverse().map(r => <PaperChip key={r.min} label={`${r.min}%`} count={r.count} />)}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, marginBottom: 5 }}>📊 주간 규칙 · 주간 달성률 <b style={{ color: C.rose }}>{weekPapers + incomePapers}장</b></div>
              <div style={{ display: "flex", gap: 6 }}>
                {[...WEEK_PAPER_RULES].reverse().map(r => <PaperChip key={r.min} label={`${r.min}%`} count={r.count} hit={weekPapers === r.count} />)}
                <div title="초과수당·보너스·월급 등 그 주에 들어온 추가 수입 건수만큼 1장씩 더 뽑아요" style={{ flex: 1, textAlign: "center", borderRadius: 8, padding: "6px 2px", background: incomePapers ? C.rose : C.white, border: `1px solid ${incomePapers ? C.rose : C.border}`, color: incomePapers ? C.white : C.sub }}>
                  <div style={{ fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>💰 추가 수입 건당</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <button onClick={() => changeWeekIncome(wk, -1)} disabled={!incomePapers} style={incomeBtn(incomePapers)}>−</button>
                    <span style={{ fontSize: 13, fontWeight: 900, color: incomePapers ? C.white : C.text }}>+{incomePapers || 1}장</span>
                    <button onClick={() => changeWeekIncome(wk, 1)} style={incomeBtn(incomePapers)}>＋</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...labelTd, borderBottom: `1.5px solid ${C.border}` }} />
                {days.map(d => {
                  const isToday = d.ds === todayStr;
                  return (
                    <th key={d.key} onClick={editMode ? () => toggleRestDay(d.ds) : undefined} style={{ minWidth: wide ? 50 : 38, padding: "4px 2px 6px", borderBottom: `1.5px solid ${C.border}`, cursor: editMode ? "pointer" : "default", background: isToday ? C.rose + "0D" : "transparent" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: isToday ? C.rose : d.weekend ? C.sub : C.text }}>{d.label}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? C.rose : C.sub }}>{d.rest ? "🌿" : Number(d.ds.slice(8))}</div>
                    </th>
                  );
                })}
                {editMode && <th style={{ width: 26, borderBottom: `1.5px solid ${C.border}` }} />}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td style={labelTd}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                      {editMode ? (
                        <KoreanInput key={"rowlabel-" + wk + "-" + row.id} value={row.label} onChange={v => updateWeeklyLabel(wk, row.id, v)} style={{ width: wide ? 130 : 60, border: "none", borderBottom: `1px solid ${C.border}`, fontSize: wide ? 14 : 12, fontWeight: 700, color: C.text, outline: "none", background: "transparent", padding: "2px 0", fontFamily: "inherit" }} />
                      ) : (
                        <span style={{ fontSize: wide ? 14 : 12, fontWeight: 700, color: C.text, wordBreak: "keep-all", overflowWrap: "anywhere", lineHeight: 1.3 }}>{row.label}</span>
                      )}
                    </div>
                  </td>
                  {days.map(d => {
                    const off = !!(row.off && row.off[d.key]);
                    const checked = !!(row.checks && row.checks[d.key]);
                    const text = (row.cells && row.cells[d.key]) || "";
                    return (
                      <td key={d.key} style={{ ...cellTd(d), verticalAlign: wide ? "middle" : "top" }}>
                        <div style={{ display: "flex", flexDirection: wide ? "row" : "column", alignItems: "center", justifyContent: wide && !off ? "flex-start" : "center", gap: wide ? 8 : 4 }}>
                          {editMode ? (
                            <>
                              <KoreanInput key={"cell-" + wk + "-" + row.id + "-" + d.key} value={text} onChange={v => updateWeeklyCell(wk, row.id, d.key, v)} placeholder="할 일" style={{ width: wide ? "100%" : 48, minWidth: 0, flex: wide ? 1 : undefined, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: wide ? 13 : 11, textAlign: wide ? "left" : "center", outline: "none", background: off ? "#F5EEEC" : "#FFF8FA", color: C.text, padding: wide ? "6px 8px" : "4px 2px", fontFamily: "inherit" }} />
                              <button onClick={() => toggleWeeklyOff(wk, row.id, d.key)} style={{ flexShrink: 0, whiteSpace: "nowrap", border: "none", borderRadius: 6, padding: wide ? "5px 8px" : "2px 6px", fontSize: wide ? 11 : 10, fontWeight: 800, cursor: "pointer", background: off ? C.sub : C.pink1, color: off ? C.white : C.sub, fontFamily: "inherit" }}>{off ? "안 함" : "함"}</button>
                            </>
                          ) : off ? (
                            <span style={{ color: C.pink2, fontWeight: 900, fontSize: 13, lineHeight: "22px" }}>—</span>
                          ) : (
                            <>
                              <WeeklyCheckbox checked={checked} onToggle={() => toggleWeeklyCheck(wk, row.id, d.key)} />
                              {text && (wide ? (
                                <span title={text} style={{ flex: 1, minWidth: 0, fontSize: 13, color: checked ? C.sub : C.text, textDecoration: checked ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "left" }}>{text}</span>
                              ) : (
                                <span style={{ fontSize: 11, lineHeight: 1.3, color: checked ? C.sub : C.text, textDecoration: checked ? "line-through" : "none", maxWidth: 52, wordBreak: "keep-all", overflowWrap: "anywhere" }}>{text}</span>
                              ))}
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {editMode && (
                    <td style={{ textAlign: "center", verticalAlign: "middle", borderBottom: `1px dashed ${C.border}` }}>
                      <button onClick={() => removeWeeklyRow(wk, row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 13, opacity: .7 }}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
              {hasJj && (
                <tr>
                  <td style={labelTd}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12 }}>📱</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>짠테크</span>
                    </div>
                  </td>
                  {days.map(d => {
                    const full = d.jjDone === d.jjTotal;
                    return (
                      <td key={d.key} style={cellTd(d)}>
                        {d.jjTotal === 0 ? <span style={{ color: C.pink2, fontWeight: 900, fontSize: 13 }}>—</span> : <button onClick={() => openJjantech(d.ds)} title="짠테크 체크리스트 열기" style={{ border: "none", borderRadius: 7, padding: "4px 2px", minWidth: 40, fontSize: 10, fontWeight: 800, cursor: "pointer", background: full ? C.rose : C.pink1, color: full ? C.white : C.sub, fontFamily: "inherit" }}>{d.jjDone}/{d.jjTotal}</button>}
                      </td>
                    );
                  })}
                  {editMode && <td style={{ borderBottom: `1px dashed ${C.border}` }} />}
                </tr>
              )}
              {(rows.length > 0 || hasJj) && (
                <tr>
                  <td style={{ ...labelTd, borderBottom: "none", background: C.white }}>
                    <span style={{ fontSize: 11, fontWeight: 900, color: C.rose, whiteSpace: "nowrap" }}>일간 달성률</span>
                  </td>
                  {days.map(d => (
                    <td key={d.key} style={{ padding: "10px 2px 4px", textAlign: "center", background: d.ds === todayStr ? C.rose + "0D" : "transparent" }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: d.rest ? C.sub : d.pct === 100 ? "#4CAF84" : C.rose }}>{d.rest ? "쉼" : d.pct === null ? "—" : d.pct + "%"}</span>
                      {paperCount(d.pct, DAY_PAPER_RULES) > 0 && <div style={{ fontSize: 10, fontWeight: 800, color: C.sub, marginTop: 2 }}>🎟️{paperCount(d.pct, DAY_PAPER_RULES)}장</div>}
                    </td>
                  ))}
                  {editMode && <td />}
                </tr>
              )}
              {rows.length === 0 && !hasJj && (
                <tr><td colSpan={cols} style={{ textAlign: "center", padding: "18px 0", fontSize: 12, color: C.sub }}>
                  {editMode ? "아래 ＋ 항목 추가 버튼으로 첫 항목을 만들어봐요!" : "이번 주 표가 비어 있어요. 편집을 눌러 매일 할 일을 넣어봐요 🍅"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {editMode && (
        <>
          <button onClick={() => addWeeklyRow(wk)} style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10, border: `1.5px dashed ${C.rose}`, background: "transparent", color: C.rose, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>＋ 항목 추가</button>
          <div style={{ marginTop: 8, fontSize: 11, color: C.sub, lineHeight: 1.7, background: C.pink1, borderRadius: 10, padding: "8px 12px" }}>
            ✏️ 칸마다 그날 할 일을 적을 수 있어요. 적은 내용은 다음 주에도 그대로 이어져요.<br />
            💡 칸 아래 <b>함/안 함</b>을 누르면 그날은 <b>—</b>로 빠지고, 달성률에도 안 들어가요.<br />
            🌿 요일 이름을 누르면 그날 전체가 쉼(공휴일 등)으로 빠져요.<br />
            📱 짠테크 줄은 짠테크 탭에 항목을 넣으면 자동으로 생겨요.
          </div>
          <button onClick={() => setConfirmReset(true)} style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10, border: "1.5px solid #FFB3B3", background: "#FFF0F0", color: "#E63946", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>🗑️ 주간표 전체 초기화</button>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={handleSaveTable} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.rose}`, background: C.white, color: C.rose, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📸 표 이미지 저장</button>
        <button onClick={openSummary} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>🎬 영상용 요약 카드</button>
      </div>

      {confirmReset && (
        <ModalWrap onClose={() => setConfirmReset(false)} zIndex={300} isMobile={isMobile}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#E63946", marginBottom: 10 }}>🗑️ 주간표를 처음부터 다시 시작할까요?</div>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.7, marginBottom: 16 }}>
            모든 주의 항목·칸 내용·체크와 🌿쉼 표시가 지워져요. 지운 건 되돌릴 수 없어요.<br />
            <span style={{ color: C.sub }}>짠테크·결혼준비·메모·보관함은 그대로 남아요.</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmReset(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, background: C.pink1, color: C.sub }}>취소</button>
            <button onClick={() => { resetWeeklyTable(); setConfirmReset(false); setEditMode(false); }} style={{ flex: 1, padding: "10px 0", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, background: "#E63946", color: C.white }}>초기화</button>
          </div>
        </ModalWrap>
      )}
    </div>
  );
}

// 영상에 넣을 한 장짜리 카드: 항목 이름 없이 주간 달성률과 요일별 일간 달성률만 보여줘요
function SummaryCardModal({ isMobile, stats, wk, onClose }) {
  const ref = useRef(null);
  const range = weekRangeLabel(wk);
  // 영상에서는 쉬는 날을 100% 달성으로 보여줘요 (앱 화면의 달성률은 그대로 쉬는 날을 빼고 계산)
  const pct = stats.cardPct;
  const tc = tomatoCount(pct);
  const msg = pct === null ? "🍅 이번 주도 화이팅!" : pct === 100 ? "🎉 이번 주 올클리어!" : pct >= 70 ? "🌸 이번 주도 잘 해냈다!" : "🍅 다음 주엔 조금 더 힘내보자!";
  return (
    <ModalWrap onClose={onClose} zIndex={300} isMobile={isMobile}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.rose, marginBottom: 14, textAlign: "center" }}>🎬 영상용 요약 카드</div>
      <div ref={ref} style={{ background: "linear-gradient(160deg,#FFF3F1,#FFE2D8)", borderRadius: 20, padding: "22px 20px", border: `2px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", fontSize: 18, fontWeight: 900, color: C.rose }}>짠토의 성장일지{tc > 0 && <TomatoRow count={tc} />}</div>
            <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginTop: 3 }}>{range} · 월~일</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Ring pct={pct || 0} size={78} stroke={8} />
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 800, marginTop: 4 }}>주간 달성률</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, marginBottom: 8 }}>일간 달성률</div>
        {stats.days.map(d => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <span style={{ width: 18, fontSize: 14, fontWeight: 900, color: C.text }}>{d.label}</span>
            <div style={{ flex: 1, height: 14, borderRadius: 99, background: "rgba(255,255,255,.85)", overflow: "hidden" }}>
              <div style={{ width: `${d.rest ? 100 : d.pct || 0}%`, height: "100%", borderRadius: 99, background: d.rest || d.pct === 100 ? C.green : `linear-gradient(90deg,${C.pink3},${C.rose})` }} />
            </div>
            <span style={{ width: 42, textAlign: "right", fontSize: 14, fontWeight: 900, color: d.rest || d.pct === 100 ? "#4CAF84" : C.rose }}>{d.rest ? "100%" : d.pct === null ? "—" : d.pct + "%"}</span>
          </div>
        ))}
        {stats.jjActiveDays > 0 && (
          <div style={{ marginTop: 12, background: "rgba(255,255,255,.8)", borderRadius: 12, padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.text, display: "flex", justifyContent: "space-between" }}>
            <span>📱 짠테크 완주한 날</span><span style={{ color: C.rose, fontWeight: 900 }}>{stats.jjFullDays}/{stats.jjActiveDays}일</span>
          </div>
        )}
        <div style={{ marginTop: 14, textAlign: "center", fontSize: 13, color: C.sub, fontWeight: 700 }}>{msg}</div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={() => saveNodeAsImage(ref.current, `짠토의_성장일지_${range.replace(/\s/g, "")}.png`)} style={{ padding: "10px 22px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 800, background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white }}>💾 이미지 저장</button>
        <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 700, background: C.pink1, color: C.sub }}>닫기</button>
      </div>
    </ModalWrap>
  );
}

// 짠테크 매일 체크리스트: 항목은 한 번만 만들어두고, 체크는 날짜별로 따로 저장돼서 매일 새로 시작해요
function JjantechView({ isMobile, selDate, setSelDate, todayStr, jj, importSources, importFromCat, clearJjantechItems, toggleJjantech, addJjantechItems, renameJjantechItem, removeJjantechItem, moveJjantechItem }) {
  const [editMode, setEditMode] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkKey, setBulkKey] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const items = jj.items || [];
  const log = (jj.log && jj.log[selDate]) || {};
  const done = items.filter(it => log[it.id]).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const visible = hideDone && !editMode ? items.filter(it => !log[it.id]) : items;
  const dateLabel = parseDate(selDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

  function submitBulk() {
    const titles = bulk.split("\n").map(s => s.trim()).filter(Boolean);
    if (!titles.length) return;
    addJjantechItems(titles);
    setBulk(""); setBulkKey(k => k + 1);
  }

  return (
    <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "14px 14px 80px" : "20px 28px" }}>
      <div style={{ maxWidth: isMobile ? 720 : 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <button onClick={() => setSelDate(addDays(selDate, -1))} style={navBtn}>‹</button>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.rose, flex: 1, textAlign: "center" }}>{selDate === todayStr ? `오늘 · ${dateLabel}` : dateLabel}</span>
          <button onClick={() => setSelDate(addDays(selDate, 1))} style={navBtn}>›</button>
          {selDate !== todayStr && <button onClick={() => setSelDate(todayStr)} style={{ ...navBtn, background: C.pink2, color: C.white, fontSize: 12 }}>오늘</button>}
          <button onClick={() => setEditMode(p => !p)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 13, background: editMode ? C.green : C.rose }}>{editMode ? "완료" : "편집"}</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.white, borderRadius: 16, padding: "12px 16px", border: `1.5px solid ${C.border}`, marginBottom: 12, boxShadow: `0 2px 10px ${C.pink1}` }}>
          <Ring pct={pct} size={52} stroke={6} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: C.rose }}>📱 오늘의 짠테크</div>
            <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginTop: 2 }}>
              {items.length ? `${done}/${items.length}개 완료${done === items.length ? " · 완주! 🎉" : ""}` : "편집을 눌러 짠테크 항목을 넣어봐요"}
            </div>
          </div>
          {!editMode && items.length > 0 && (
            <button onClick={() => setHideDone(p => !p)} style={{ padding: "5px 10px", borderRadius: 99, border: `1.5px solid ${hideDone ? C.rose : C.border}`, background: hideDone ? C.rose + "18" : C.white, color: hideDone ? C.rose : C.sub, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>{hideDone ? `완료 숨김(${done})` : "완료 숨기기"}</button>
          )}
        </div>

        {/* 편집할 때 맨 위에 보여서 바로 찾을 수 있게 해요 */}
        {editMode && items.length > 0 && (
          confirmClear ? (
            <div style={{ marginBottom: 12, padding: "12px 14px", background: "#FFF0F0", borderRadius: 12, border: "1.5px solid #FFB3B3" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E63946", marginBottom: 8 }}>⚠️ 짠테크 항목 {items.length}개를 모두 지울까요? 지운 뒤 '예전 할일에서 불러오기'로 다시 가져올 수 있어요.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: C.pink1, color: C.sub, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>취소</button>
                <button onClick={() => { clearJjantechItems(); setConfirmClear(false); }} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "#E63946", color: "white", fontWeight: 800, cursor: "pointer", fontSize: 13 }}>모두 지우기</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} style={{ marginBottom: 12, width: "100%", padding: "9px 0", borderRadius: 10, border: "1.5px solid #FFB3B3", background: "#FFF0F0", color: "#E63946", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>🗑️ 짠테크 항목 전체 비우기</button>
          )
        )}

        {!editMode && hideDone && items.length > 0 && visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: C.sub, fontWeight: 700 }}>🎉 오늘 짠테크 모두 끝!</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : editMode ? "1fr 1fr" : "repeat(3, 1fr)", gap: 6 }}>
          {visible.map((it, i) => {
            const checked = !!log[it.id];
            return editMode ? (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.white, borderRadius: 10, padding: "6px 10px", border: `1.5px solid ${C.border}` }}>
                <span style={{ fontSize: 11, color: C.sub, width: 18, textAlign: "right" }}>{i + 1}</span>
                <KoreanInput key={"jj-" + it.id} value={it.title} onChange={v => renameJjantechItem(it.id, v)} style={{ flex: 1, minWidth: 0, border: "none", borderBottom: `1px solid ${C.border}`, fontSize: 14, color: C.text, outline: "none", background: "transparent", padding: "3px 0", fontFamily: "inherit" }} />
                <button onClick={() => moveJjantechItem(it.id, -1)} disabled={i === 0} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 13, opacity: i === 0 ? .25 : .8 }}>↑</button>
                <button onClick={() => moveJjantechItem(it.id, 1)} disabled={i === items.length - 1} style={{ background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 13, opacity: i === items.length - 1 ? .25 : .8 }}>↓</button>
                <button onClick={() => removeJjantechItem(it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 13, opacity: .7 }}>✕</button>
              </div>
            ) : (
              <div key={it.id} onClick={() => toggleJjantech(selDate, it.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: checked ? "#FFF3F1" : C.white, borderRadius: 10, padding: "10px 12px", border: `1.5px solid ${checked ? C.pink2 : C.border}`, cursor: "pointer", userSelect: "none" }}>
                <WeeklyCheckbox checked={checked} onToggle={() => {}} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: checked ? 500 : 700, color: checked ? C.sub : C.text, textDecoration: checked ? "line-through" : "none" }}>{it.title}</span>
              </div>
            );
          })}
        </div>

        {(editMode || items.length === 0) && importSources.length > 0 && (
          <div style={{ marginTop: 12, background: C.white, borderRadius: 12, padding: 12, border: `1.5px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.rose, marginBottom: 4 }}>📦 예전 할일에서 불러오기</div>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>예전에 분류별로 적어둔 할일을 짠테크 항목으로 한 번에 가져와요. 이미 있는 이름은 건너뛰어요.</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {importSources.map(({ cat, count }) => (
                <button key={cat.id} onClick={() => importFromCat(cat.id)} style={{ padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${cat.color}`, background: cat.color + "18", color: C.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{cat.emoji} {cat.name} ({count}개)</button>
              ))}
            </div>
          </div>
        )}

        {editMode && (
          <div style={{ marginTop: 12, background: C.white, borderRadius: 12, padding: 12, border: `1.5px dashed ${C.rose}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: C.rose, marginBottom: 6 }}>＋ 항목 추가 (한 줄에 하나씩, 여러 개 한 번에 붙여넣어도 돼요)</div>
            <KoreanTextarea key={"bulk-" + bulkKey} value={bulk} onChange={setBulk} rows={4} placeholder={"예)\n출석체크\n만보기 적립\n퀴즈 풀기"} style={{ ...inp, resize: "vertical", lineHeight: 1.6, marginBottom: 8 }} />
            <button onClick={submitBulk} style={{ width: "100%", padding: "9px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>추가하기</button>
          </div>
        )}

      </div>
    </div>
  );
}

// 주간 표로 바뀌기 전에 쓰던 분류별 할일 기록이에요. 지금은 기록용으로만 남겨두고, 필요 없으면 지울 수 있어요.
function ArchiveView({ isMobile, todos, cats, setTodosS }) {
  const [confirmId, setConfirmId] = useState(null);
  const byCat = cats
    .map(cat => ({ cat, items: Array.isArray(todos[cat.id]) ? todos[cat.id] : [] }))
    .filter(g => g.items.length > 0);

  function deletePermanently(catId, id) {
    setTodosS(p => ({ ...p, [catId]: (p[catId] || []).filter(t => t.id !== id) }));
    setConfirmId(null);
  }

  return (
    <div style={{flex:1,overflow:"auto",padding:isMobile?"14px 14px 80px":"20px 28px"}}>
      <div style={{maxWidth:680,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <span style={{fontSize:22}}>📦</span>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:C.rose}}>예전 할일 보관함</div>
            <div style={{fontSize:12,color:C.sub,marginTop:2}}>주간 표로 바뀌기 전에 쓰던 할일이에요.</div>
          </div>
        </div>
        <div style={{background:C.pink1,borderRadius:12,padding:"10px 14px",marginBottom:20,fontSize:12,color:C.sub,lineHeight:1.7}}>
          💡 여기 기록은 달성률에 들어가지 않아요. 매일 하는 일은 주간 표에 다시 넣어주세요.<br/>
          🗑️ 필요 없는 건 영구 삭제할 수 있어요.
        </div>
        {byCat.length === 0 && (
          <div style={{textAlign:"center",padding:"60px 0",color:C.sub}}>
            <div style={{fontSize:48,marginBottom:12}}>📭</div>
            <div style={{fontSize:15,fontWeight:700}}>보관된 할일이 없어요</div>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          {byCat.map(({ cat, items }) => (
            <div key={cat.id} style={{background:C.white,borderRadius:16,border:`1.5px solid ${C.border}`,overflow:"hidden",boxShadow:`0 2px 8px ${C.pink1}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",background:cat.color+"18",borderBottom:`1px solid ${C.border}`}}>
                <span style={{fontSize:18}}>{cat.emoji}</span>
                <span style={{fontSize:15,fontWeight:800,color:C.text}}>{cat.name}</span>
                <span style={{fontSize:12,color:cat.color,background:cat.color+"22",padding:"2px 9px",borderRadius:99,fontWeight:700}}>{items.length}개</span>
              </div>
              <div style={{padding:"8px 0"}}>
                {items.map(item => (
                  <div key={item.id}>
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:`1px dashed ${C.border}`}}>
                      <span style={{fontSize:13,color:C.sub,flexShrink:0}}>{repeatIcon(item)}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,color:C.text,fontWeight:600}}>{item.title}</div>
                        <div style={{fontSize:11,color:C.sub,marginTop:2}}>
                          {repeatLabel(item)}
                          {item.doneLog && Object.keys(item.doneLog).length > 0 && <span style={{color:cat.color}}> · ✅ 완료 기록 {Object.keys(item.doneLog).length}일</span>}
                          {item.date && item.done && <span style={{color:cat.color}}> · ✅ 완료</span>}
                        </div>
                      </div>
                      <button onClick={()=>setConfirmId(item.id)} style={{padding:"5px 12px",borderRadius:10,border:"1.5px solid #FFB3B3",background:"#FFF0F0",color:"#E63946",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>🗑️ 삭제</button>
                    </div>
                    {confirmId === item.id && (
                      <div style={{margin:"0 16px 10px",padding:"12px 14px",background:"#FFF0F0",borderRadius:10,border:"1.5px solid #FFB3B3"}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#E63946",marginBottom:8}}>⚠️ 영구 삭제하면 완료 기록도 모두 사라져요. 정말 삭제할까요?</div>
                        <div style={{display:"flex",gap:8}}>
                          <button onClick={()=>setConfirmId(null)} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:C.pink1,color:C.sub,fontWeight:700,cursor:"pointer",fontSize:13}}>취소</button>
                          <button onClick={()=>deletePermanently(cat.id, item.id)} style={{flex:1,padding:"7px",borderRadius:8,border:"none",background:"#E63946",color:"white",fontWeight:800,cursor:"pointer",fontSize:13}}>영구 삭제</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MemoCard({ m, editMemo, deleteMemo }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.text);
  const [draftImg, setDraftImg] = useState(m.image || null);
  const fileRef = useRef(null);

  function save() {
    if (!draft.trim() && !draftImg) return;
    editMemo(m.id, draft.trim(), draftImg);
    setEditing(false);
  }
  function cancel() {
    setDraft(m.text);
    setDraftImg(m.image || null);
    setEditing(false);
  }
  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (file) compressImage(file, setDraftImg);
  }

  return (
    <div style={{background:C.white,borderRadius:14,padding:"14px 16px",border:`1.5px solid ${editing?C.rose:C.border}`,boxShadow:`0 2px 8px ${C.pink1}`,transition:"border-color .2s"}}>
      {editing ? (
        <>
          <KoreanTextarea value={draft} onChange={setDraft} onKeyDown={e=>{ if(e.key==="Escape") cancel(); }} rows={4} style={{width:"100%",padding:"8px 10px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,outline:"none",fontFamily:"inherit",background:"#FFF8FA",color:C.text,resize:"none",lineHeight:1.6,boxSizing:"border-box",marginBottom:10}} />
          {draftImg && (
            <div style={{position:"relative",display:"inline-block",marginBottom:10}}>
              <img src={draftImg} alt="memo" style={{maxWidth:"100%",maxHeight:200,borderRadius:8,border:`1px solid ${C.border}`}}/>
              <button onClick={()=>setDraftImg(null)} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"white",border:"none",borderRadius:"50%",width:24,height:24,cursor:"pointer",fontSize:12,fontWeight:"bold"}}>✕</button>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <button onClick={()=>fileRef.current?.click()} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${C.border}`,background:C.pink1,color:C.text,fontSize:12,fontWeight:700,cursor:"pointer"}}>📷 사진 변경</button>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageChange}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={cancel} style={{padding:"6px 14px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub,fontSize:13}}>취소</button>
              <button onClick={save} style={{padding:"6px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,fontSize:13}}>저장</button>
            </div>
          </div>
        </>
      ) : (
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            {m.text && <div style={{fontSize:14,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap",wordBreak:"break-all",marginBottom:m.image?10:0}}>{m.text}</div>}
            {m.image && (
              <div style={{marginBottom:6}}>
                <img src={m.image} alt="memo" style={{maxWidth:"100%",maxHeight:300,borderRadius:10,border:`1px solid ${C.border}`,display:"block"}}/>
              </div>
            )}
            <div style={{fontSize:10,color:C.sub,marginTop:4}}>{new Date(m.createdAt).toLocaleString("ko-KR",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
            <button onClick={()=>{ setDraft(m.text); setDraftImg(m.image||null); setEditing(true); }} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,color:C.sub,opacity:.6,padding:"2px 4px"}}>✏️</button>
            <button onClick={()=>deleteMemo(m.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:15,color:C.sub,opacity:.5,padding:"2px 4px"}}>🗑️</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoView({isMobile, memos, memoInput, setMemoInput, addMemo, editMemo, deleteMemo}) {
  const [memoImg, setMemoImg] = useState(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);
  function handleAdd() { if(!memoInput.trim() && !memoImg) return; addMemo(memoImg); setMemoImg(null); }
  function handleImageSelect(e) { const file = e.target.files?.[0]; if (file) compressImage(file, setMemoImg); e.target.value = ""; }
  const q = search.trim().toLowerCase();
  const filteredMemos = q ? memos.filter(m => (m.text||"").toLowerCase().includes(q)) : memos;
  return (
    <div style={{flex:1,overflow:"auto",padding:isMobile?"14px 14px 80px":"20px 24px"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <div style={{fontSize:18,fontWeight:800,color:C.rose,marginBottom:16}}>🗒️ 메모</div>
        <div style={{position:"relative",marginBottom:16}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:14,color:C.sub}}>🔍</span>
          <KoreanInput value={search} onChange={setSearch} placeholder="메모 검색..." style={{width:"100%",padding:"9px 12px 9px 34px",border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:13,outline:"none",fontFamily:"inherit",background:C.white,color:C.text,boxSizing:"border-box"}}/>
        </div>
        {memoImg && (
          <div style={{position:"relative",display:"inline-block",marginBottom:10}}>
            <img src={memoImg} alt="preview" style={{maxHeight:120,borderRadius:8,border:`1.5px solid ${C.border}`}}/>
            <button onClick={()=>setMemoImg(null)} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"white",border:"none",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,fontWeight:"bold"}}>✕</button>
          </div>
        )}
        <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"flex-end"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
            <KoreanTextarea key={memos.length} value={memoInput} onChange={setMemoInput} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleAdd(); } }} placeholder="메모를 입력하세요... (Enter로 저장)" rows={3} style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${C.border}`,borderRadius:14,fontSize:14,outline:"none",fontFamily:"inherit",background:"#FFF8FA",color:C.text,resize:"none",lineHeight:1.6,boxSizing:"border-box"}}/>
            <div style={{display:"flex",justifyContent:"flex-start"}}>
              <button onClick={()=>fileRef.current?.click()} style={{padding:"6px 12px",borderRadius:10,background:C.pink1,color:C.rose,border:`1px solid ${C.border}`,fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><span>📷</span> 사진 첨부</button>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageSelect}/>
            </div>
          </div>
          <button onClick={handleAdd} style={{padding:"10px 18px",borderRadius:14,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:14,cursor:"pointer",flexShrink:0,height:52}}>저장</button>
        </div>
        {memos.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.sub,fontSize:14}}><div style={{fontSize:36,marginBottom:8}}>🗒️</div>메모가 없어요. 사진이나 글을 남겨봐요!</div>}
        {memos.length>0&&filteredMemos.length===0&&<div style={{textAlign:"center",padding:"40px 0",color:C.sub,fontSize:14}}><div style={{fontSize:36,marginBottom:8}}>🔍</div>"{search}"에 대한 검색 결과가 없어요</div>}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filteredMemos.map(m=><MemoCard key={m.id} m={m} editMemo={editMemo} deleteMemo={deleteMemo}/>)}
        </div>
      </div>
    </div>
  );
}

// 💍 결혼준비 › 하객 관리: 신랑측·신부측 하객을 한 줄씩 적고, 위 요약표는 자동으로 계산돼요.
// 하객 한 명 = { id, name, type:"모청"|"종이"|"", meetingId(청모), attend:"O"|"X"|"", meal:"O"|"X"|"", gift, memo }
const EMPTY_WEDDING = { guests: { groom: [], bride: [] } };
const GUEST_SIDES = [
  { key: "groom", label: "신랑측", emoji: "💙", color: "#5B9BD5", bg: "#EEF5FC" },
  { key: "bride", label: "신부측", emoji: "🩷", color: "#E77FA6", bg: "#FDEFF4" },
];
const GUEST_COLS = [
  { key: "name",     label: "이름",            w: 110 },
  { key: "type",     label: "유형",            w: 64,  cycle: ["", "모청", "종이"] },
  { key: "meetingId", label: "🍽️ 청모",       w: 180, meeting: true },
  { key: "attend",   label: "참석",            w: 52,  cycle: ["", "O", "X"] },
  { key: "meal",     label: "식사",            w: 52,  cycle: ["", "O", "X"] },
  { key: "gift",     label: "축의금",          w: 100, num: true },
  { key: "memo",     label: "메모",            w: 150 },
];
function toWon(v) { return Number(String(v || "").replace(/[^\d]/g, "")) || 0; }
function fmtWon(n) { return n.toLocaleString("ko-KR"); }
function guestStats(list) {
  const rows = (list || []).filter(g => (g.name || "").trim());
  const total = rows.length;
  const yes = rows.filter(g => g.attend === "O").length;
  return {
    total, yes, rest: total - yes,
    pct: total ? Math.round(yes / total * 100) : 0,
    meet: rows.filter(g => g.meetingId).length,
    gift: rows.reduce((s, g) => s + toWon(g.gift), 0),
  };
}
function nextInCycle(cycle, v) { return cycle[(cycle.indexOf(v || "") + 1) % cycle.length]; }

function CycleChip({ value, onClick }) {
  const style = value === "O" ? { background: "#E3F4EA", color: "#2E8B57", border: "1.5px solid #9ED4B4" }
    : value === "X" ? { background: "#FDECEC", color: "#D64545", border: "1.5px solid #F2B0B0" }
    : value ? { background: C.pink1, color: C.rose, border: `1.5px solid ${C.pink2}` }
    : { background: C.white, color: C.pink2, border: `1.5px dashed ${C.border}` };
  return <button onClick={onClick} style={{ ...style, minWidth: 40, padding: "4px 8px", borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{value || "—"}</button>;
}

function GuestField({ g, col, side, updateGuest, style, meetings, addMeetingFor }) {
  if (col.cycle) return <CycleChip value={g[col.key]} onClick={() => updateGuest(side, g.id, col.key, nextInCycle(col.cycle, g[col.key]))} />;
  const base = { width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#FFF8FA", color: C.text, padding: "6px 8px", fontFamily: "inherit", ...style };
  if (col.meeting) {
    const list = asList(meetings);
    const has = list.some(m => m.id === g.meetingId);
    return (
      <select value={has ? g.meetingId : ""} onChange={e => e.target.value === "__new" ? addMeetingFor(side, g.id) : updateGuest(side, g.id, "meetingId", e.target.value)} style={{ ...base, color: has ? C.text : C.sub }}>
        <option value="">— 청모 없음</option>
        {[...list].sort((a, b) => (!a.date) - (!b.date) || (a.date || "").localeCompare(b.date || "")).map(m => <option key={m.id} value={m.id}>{meetingLabel(m)}</option>)}
        <option value="__new">＋ 새 청모 만들기</option>
      </select>
    );
  }
  return <KoreanInput key={col.key + "-" + g.id} value={g[col.key] || ""} inputMode={col.num ? "numeric" : undefined} placeholder={col.num ? "0" : ""} onChange={v => updateGuest(side, g.id, col.key, col.num ? v.replace(/[^\d]/g, "") : v)} style={{ ...base, textAlign: col.num ? "right" : "left" }} />;
}

function GuestView({ isMobile, wedding, setWedding, addGuest, updateGuest, removeGuest, sortGuests }) {
  const [side, setSide] = useState("bride");
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const all = { groom: [], bride: [], ...(wedding.guests || {}) };
  const guests = all[side] || [];
  const sideInfo = GUEST_SIDES.find(s => s.key === side) || GUEST_SIDES[1];
  const meetings = asList(wedding.meetings);
  // 하객 칸에서 '새 청모 만들기'를 고르면 빈 청모를 만들고 그 하객을 바로 넣어요. 날짜·식당은 🍽️ 청모에서 채워요.
  function addMeetingFor(sideKey, gid) {
    const m = newMeeting();
    setWedding(p => ({ ...p, meetings: [...asList(p.meetings), m] }));
    updateGuest(sideKey, gid, "meetingId", m.id);
  }
  const fieldProps = { side, updateGuest, meetings, addMeetingFor };
  const stats = GUEST_SIDES.map(s => ({ ...s, ...guestStats(all[s.key]) }));
  const sum = guestStats([...(all.groom || []), ...(all.bride || [])]);

  function handleSort(key) {
    const dir = sort.key === key ? -sort.dir : 1;
    setSort({ key, dir });
    sortGuests(side, key, dir);
  }
  function confirmRemove(g) {
    if (window.confirm(`${(g.name || "").trim() || "이름 없는 하객"} 줄을 지울까요?`)) removeGuest(side, g.id);
  }
  function switchSide(k) { setSide(k); setSort({ key: null, dir: 1 }); }

  const th = { padding: "8px 6px", fontSize: 12, fontWeight: 800, color: C.white, whiteSpace: "nowrap", background: sideInfo.color, cursor: "pointer", userSelect: "none" };
  const sumCell = { padding: "8px 6px", textAlign: "center", fontSize: 13, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const sumBold = { ...sumCell, fontWeight: 900 };
  const sortMark = k => sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : " ⇅";

  return (
    <>

        {/* 요약표: 이름을 적은 줄만 세요 */}
        <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, boxShadow: `0 2px 10px ${C.pink1}`, overflowX: "auto", marginBottom: 16 }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead>
              <tr>{["구분", "총 초대", "참석 (O)", "미정/불참", "참석률", "청첩장모임 인원", "축의금 합계"].map(h => <th key={h} style={{ padding: "9px 6px", fontSize: 12, fontWeight: 800, color: C.white, background: "#3A3A3A", whiteSpace: "nowrap" }}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {stats.map(s => (
                <tr key={s.key} style={{ background: s.bg }}>
                  <td style={{ ...sumCell, fontWeight: 800 }}>{s.emoji} {s.label}</td>
                  <td style={sumCell}>{s.total}</td><td style={sumCell}>{s.yes}</td><td style={sumCell}>{s.rest}</td>
                  <td style={sumCell}>{s.pct}%</td><td style={sumCell}>{s.meet}</td><td style={sumCell}>{fmtWon(s.gift)}원</td>
                </tr>
              ))}
              <tr style={{ background: "#F3F0EF" }}>
                <td style={sumBold}>합 계</td>
                <td style={sumBold}>{sum.total}</td><td style={sumBold}>{sum.yes}</td><td style={sumBold}>{sum.rest}</td>
                <td style={sumBold}>{sum.pct}%</td><td style={sumBold}>{sum.meet}</td><td style={sumBold}>{fmtWon(sum.gift)}원</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {GUEST_SIDES.map(s => (
            <button key={s.key} onClick={() => switchSide(s.key)} style={{ flex: 1, padding: "9px 0", borderRadius: 12, border: `2px solid ${side === s.key ? s.color : C.border}`, background: side === s.key ? s.color : C.white, color: side === s.key ? C.white : C.sub, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
              {s.emoji} {s.label} ({(all[s.key] || []).length})
            </button>
          ))}
          <button onClick={() => switchSide(MEET_INFO.key)} style={{ flex: 1, padding: "9px 0", borderRadius: 12, border: `2px solid ${side === MEET_INFO.key ? MEET_INFO.color : C.border}`, background: side === MEET_INFO.key ? MEET_INFO.color : C.white, color: side === MEET_INFO.key ? C.white : C.sub, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
            {MEET_INFO.emoji} {MEET_INFO.label} ({meetings.length})
          </button>
        </div>

        {side === MEET_INFO.key ? <MeetingView isMobile={isMobile} wedding={wedding} setWedding={setWedding} /> : <>
        {isMobile ? (
          <>
            {guests.length > 0 && (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 2 }}>
                <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, alignSelf: "center", flexShrink: 0 }}>정렬</span>
                {GUEST_COLS.filter(c => c.key !== "memo").map(c => (
                  <button key={c.key} onClick={() => handleSort(c.key)} style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 99, border: `1.5px solid ${sort.key === c.key ? sideInfo.color : C.border}`, background: sort.key === c.key ? sideInfo.bg : C.white, color: sort.key === c.key ? sideInfo.color : C.sub, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{c.label}{sort.key === c.key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}</button>
                ))}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {guests.map((g, i) => (
                <div key={g.id} style={{ background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, borderLeft: `5px solid ${sideInfo.color}`, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: C.sub, width: 18 }}>{i + 1}</span>
                    <GuestField g={g} col={GUEST_COLS[0]} {...fieldProps} style={{ fontSize: 14, fontWeight: 700 }} />
                    <button onClick={() => confirmRemove(g)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 14, opacity: .7 }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                    {GUEST_COLS.filter(c => c.cycle).map(c => (
                      <span key={c.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.sub, fontWeight: 700 }}>{c.label}<GuestField g={g} col={c} {...fieldProps} /></span>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 10px", alignItems: "center" }}>
                    {GUEST_COLS.slice(1).filter(c => !c.cycle).map(c => (
                      <Fragment key={c.key}>
                        <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, whiteSpace: "nowrap" }}>{c.label}</span>
                        <div><GuestField g={g} col={c} {...fieldProps} /></div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36, cursor: "default" }}>번호</th>
                  {GUEST_COLS.map(c => <th key={c.key} onClick={() => handleSort(c.key)} title="눌러서 정렬" style={{ ...th, minWidth: c.w }}>{c.label}<span style={{ opacity: sort.key === c.key ? 1 : .55 }}>{sortMark(c.key)}</span></th>)}
                  <th style={{ ...th, width: 30, cursor: "default" }} />
                </tr>
              </thead>
              <tbody>
                {guests.map((g, i) => (
                  <tr key={g.id} style={{ borderBottom: `1px solid ${C.pink1}` }}>
                    <td style={{ textAlign: "center", fontSize: 11, color: C.sub }}>{i + 1}</td>
                    {GUEST_COLS.map(c => <td key={c.key} style={{ padding: "5px 4px", textAlign: c.cycle ? "center" : "left" }}><GuestField g={g} col={c} {...fieldProps} /></td>)}
                    <td style={{ textAlign: "center" }}><button onClick={() => confirmRemove(g)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 13, opacity: .7 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {guests.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: C.sub }}>아직 {sideInfo.label} 하객이 없어요. 아래 버튼으로 한 줄씩 추가해봐요 {sideInfo.emoji}</div>}
        <button onClick={() => addGuest(side)} style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px dashed ${sideInfo.color}`, background: "transparent", color: sideInfo.color, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>＋ {sideInfo.label} 하객 추가</button>
        <div style={{ marginTop: 10, fontSize: 11, color: C.sub, lineHeight: 1.7, background: C.pink1, borderRadius: 10, padding: "8px 12px" }}>
          💡 유형·참석·식사 칸은 누를 때마다 바뀌어요 (빈칸 → 모청/O → 종이/X → 빈칸).<br />
          📊 요약표는 이름을 적은 하객만 세요. 청첩장모임 인원은 🍽️ 청모를 고른 하객 수예요.<br />
          🍽️ 청모 칸에서 모임을 고르면 돼요. 날짜·식당·식비는 위 🍽️ 청모 버튼에서 모임별로 한 번만 적어요.
        </div>
        </>}
    </>
  );
}

// 🍽️ 청모(청첩장 모임): 모임마다 날짜·식당·총 식비를 한 번만 적고, 온 하객을 골라 넣어요.
// 청모 하나 = { id, date, place, total, memo }, 하객은 meetingId로 어느 청모에 왔는지 가리켜요.
const MEET_INFO = { key: "meet", label: "청모", emoji: "🍽️", color: "#E39B3A", bg: "#FFF4E3" };
function meetingLabel(m) {
  if (!m) return "";
  const d = m.date ? `${Number(m.date.slice(5, 7))}/${Number(m.date.slice(8))}(${DAYS_KO[parseDate(m.date).getDay()]})` : "날짜 미정";
  return `${d}${m.place ? " " + m.place : ""}`;
}
function newMeeting() { return { id: genId(), date: "", place: "", total: "", memo: "" }; }
// 예전처럼 하객마다 적었던 청모 날짜·식당·1인금액을, 날짜+식당이 같은 사람끼리 청모 하나로 묶어 옮겨요
function migrateMeetings(w) {
  const guests = { groom: [], bride: [], ...((w && w.guests) || {}) };
  const isLegacy = g => g && !g.meetingId && ((g.meetDate || "").trim() || (g.place || "").trim() || toWon(g.perPrice));
  if (!["groom", "bride"].some(k => asList(guests[k]).some(isLegacy))) return null;
  const meetings = [...asList(w.meetings)];
  const byKey = {};
  const strip = ({ meetDate, place, perPrice, ...rest }) => rest;
  const next = {};
  ["groom", "bride"].forEach(k => {
    next[k] = asList(guests[k]).map(g => {
      if (!isLegacy(g)) return strip(g);
      const key = `${g.meetDate || ""}|${(g.place || "").trim()}`;
      if (!byKey[key]) { byKey[key] = { ...newMeeting(), date: g.meetDate || "", place: (g.place || "").trim(), total: "0" }; meetings.push(byKey[key]); }
      byKey[key].total = String(toWon(byKey[key].total) + toWon(g.perPrice));
      return { ...strip(g), meetingId: byKey[key].id };
    });
  });
  return { ...w, meetings, guests: { ...guests, ...next } };
}

function MeetingView({ isMobile, wedding, setWedding }) {
  const meetings = asList(wedding.meetings);
  const all = { groom: [], bride: [], ...(wedding.guests || {}) };
  const people = GUEST_SIDES.flatMap(s => asList(all[s.key]).filter(g => (g.name || "").trim()).map(g => ({ ...g, side: s })));
  const ids = new Set(meetings.map(m => m.id));
  const members = m => people.filter(g => g.meetingId === m.id);
  const free = people.filter(g => !ids.has(g.meetingId));
  // 날짜 순으로 보여줘요. 날짜 없는 청모는 아래로 가요.
  const shown = [...meetings].sort((a, b) => (!a.date) - (!b.date) || (a.date || "").localeCompare(b.date || ""));
  const totalCost = meetings.reduce((s, m) => s + toWon(m.total), 0);
  const met = people.filter(g => ids.has(g.meetingId)).length;

  const setM = (id, patch) => setWedding(p => ({ ...p, meetings: asList(p.meetings).map(m => m.id === id ? { ...m, ...patch } : m) }));
  function assign(sideKey, gid, meetingId) {
    setWedding(p => {
      const guests = { groom: [], bride: [], ...(p.guests || {}) };
      return { ...p, guests: { ...guests, [sideKey]: asList(guests[sideKey]).map(g => g.id === gid ? { ...g, meetingId } : g) } };
    });
  }
  function removeMeeting(m) {
    const n = members(m).length;
    if (!window.confirm(`${meetingLabel(m)} 청모를 지울까요?${n ? ` 들어 있던 하객 ${n}명은 '청모 없음'으로 바뀌어요.` : ""}`)) return;
    setWedding(p => {
      const guests = { groom: [], bride: [], ...(p.guests || {}) };
      const clear = list => asList(list).map(g => g.meetingId === m.id ? { ...g, meetingId: "" } : g);
      return { ...p, meetings: asList(p.meetings).filter(x => x.id !== m.id), guests: { ...guests, groom: clear(guests.groom), bride: clear(guests.bride) } };
    });
  }

  const stat = (label, value, sub) => (
    <div style={{ background: C.white, borderRadius: 12, border: `1.5px solid ${C.border}`, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
        {stat("청모 횟수", `${meetings.length}번`)}
        {stat("만난 하객", `${met}명`, free.length ? `아직 안 만난 하객 ${free.length}명` : null)}
        {stat("청모 총 식비", `${fmtWon(totalCost)}원`, met ? `1인당 평균 ${fmtWon(Math.round(totalCost / met))}원` : null)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {shown.map(m => {
          const list = members(m);
          const per = list.length ? Math.round(toWon(m.total) / list.length) : 0;
          return (
            <div key={m.id} style={{ background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, borderTop: `5px solid ${MEET_INFO.color}`, padding: "10px 12px" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                <input type="date" value={m.date || ""} onChange={e => setM(m.id, { date: e.target.value })} style={{ ...smallInp, width: 140, flex: "none" }} />
                <KoreanInput key={"mplace-" + m.id} value={m.place || ""} onChange={v => setM(m.id, { place: v })} placeholder="🍽️ 식당" style={{ ...smallInp, flex: 1, fontWeight: 800 }} />
                <button onClick={() => removeMeeting(m)} title="청모 지우기" style={{ ...iconBtn, color: C.tomato }}>🗑️</button>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>💰 총 식비</span>
                <KoreanInput key={"mtotal-" + m.id} value={m.total || ""} inputMode="numeric" placeholder="0" onChange={v => setM(m.id, { total: v.replace(/[^\d]/g, "") })} style={{ ...smallInp, width: 110, flex: "none", textAlign: "right" }} />
                <span style={{ fontSize: 12, fontWeight: 800, color: MEET_INFO.color }}>{list.length}명{list.length ? ` · 1인당 ${fmtWon(per)}원` : ""}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {list.map(g => (
                  <span key={g.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 6px 4px 10px", borderRadius: 99, background: g.side.bg, border: `1.5px solid ${g.side.color}55`, fontSize: 12, fontWeight: 700, color: C.text }}>
                    {g.side.emoji} {g.name}
                    <button onClick={() => assign(g.side.key, g.id, "")} title="이 청모에서 빼기" style={{ ...iconBtn, fontSize: 11, padding: "0 2px" }}>✕</button>
                  </span>
                ))}
                {list.length === 0 && <span style={{ fontSize: 12, color: C.sub }}>아직 아무도 없어요. 아래에서 하객을 넣어봐요</span>}
              </div>
              <select value="" onChange={e => { const [sk, gid] = e.target.value.split(":"); if (gid) assign(sk, gid, m.id); }} style={{ ...smallInp, marginBottom: 6, color: C.sub }}>
                <option value="">＋ 하객 넣기 {free.length ? `(${free.length}명 남음)` : "(남은 하객 없음)"}</option>
                {GUEST_SIDES.map(s => {
                  const opts = free.filter(g => g.side.key === s.key);
                  return opts.length ? <optgroup key={s.key} label={`${s.emoji} ${s.label}`}>{opts.map(g => <option key={g.id} value={`${s.key}:${g.id}`}>{g.name}</option>)}</optgroup> : null;
                })}
              </select>
              <KoreanInput key={"mmemo-" + m.id} value={m.memo || ""} onChange={v => setM(m.id, { memo: v })} placeholder="메모 (예: 2차 카페, 선물 받음)" style={smallInp} />
            </div>
          );
        })}
      </div>
      {meetings.length === 0 && <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: C.sub }}>아직 청모가 없어요. 아래 버튼으로 첫 청모를 만들어봐요 🍽️</div>}
      <button onClick={() => setWedding(p => ({ ...p, meetings: [...asList(p.meetings), newMeeting()] }))} style={{ marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px dashed ${MEET_INFO.color}`, background: "transparent", color: MEET_INFO.color, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>＋ 새 청모 추가</button>
      <div style={tipBox}>
        💡 청모마다 날짜·식당·총 식비를 한 번만 적으면 인원과 1인당 비용이 자동으로 계산돼요.<br />
        👥 하객 표의 🍽️ 청모 칸에서 골라도 되고, 여기서 '하객 넣기'로 넣어도 돼요. 이름을 적은 하객만 고를 수 있어요.
      </div>
    </>
  );
}

// Firebase는 빈 배열을 저장하지 않아서, 없으면 빈 목록으로 읽어요
function asList(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
const smallInp = { width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#FFF8FA", color: C.text, padding: "6px 8px", fontFamily: "inherit" };
const dashedAddBtn = { width: "100%", padding: "9px 0", borderRadius: 10, border: `1.5px dashed ${C.rose}`, background: "transparent", color: C.rose, fontWeight: 800, fontSize: 12, cursor: "pointer" };
const tipBox = { marginTop: 10, fontSize: 11, color: C.sub, lineHeight: 1.7, background: C.pink1, borderRadius: 10, padding: "8px 12px" };
// 단계·분류 이름도 직접 추가·수정·삭제할 수 있어요. 한 번도 안 고쳤으면 기본 목록을 써요.
function sectionsOf(wedding, field, defaults) {
  const list = asList(wedding[field]);
  return list.length ? list : defaults;
}
function moveInList(list, i, dir) {
  const k = i + dir;
  if (i < 0 || k < 0 || k >= list.length) return list;
  const next = [...list];
  [next[i], next[k]] = [next[k], next[i]];
  return next;
}
const iconBtn = { background: "none", border: "none", cursor: "pointer", color: C.sub, fontSize: 13, padding: "2px 4px", flexShrink: 0 };
// 편집 모드에서 단계·분류 제목 줄: 이름 고치기 · 위아래 옮기기 · 지우기
function SectionEditHead({ id, label, onRename, onMove, onRemove, first, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0 }}>
      <KoreanInput key={"sec-" + id} value={label} onChange={onRename} style={{ ...smallInp, flex: 1, fontWeight: 800, background: C.white }} />
      <button onClick={() => onMove(-1)} disabled={first} style={{ ...iconBtn, opacity: first ? .25 : .8 }}>↑</button>
      <button onClick={() => onMove(1)} disabled={last} style={{ ...iconBtn, opacity: last ? .25 : .8 }}>↓</button>
      <button onClick={onRemove} title="이 묶음 지우기" style={{ ...iconBtn, color: C.tomato }}>🗑️</button>
    </div>
  );
}
function editBtn(on) { return { padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 13, background: on ? C.green : C.rose, flexShrink: 0 }; }

// ✅ 준비할 것: 중요한 순서대로 15단계로 묶은 체크리스트. 처음엔 비어 있고, 기본 목록을 불러온 뒤 고쳐 쓰면 돼요.
const TASK_STAGES = [
  { key: "s01", label: "01 예산과 결혼 방향 정하기", items: ["결혼 희망 시기 정하기", "총예산 정하기 (예식·신혼집·신혼여행 포함)", "양가 지원 가능 금액 확인 및 자금 계획 세우기", "항목별 예산표 만들기", "예식 스타일 정하기 (웨딩홀, 스몰웨딩, 야외, 종교 예식 등)", "예비비 10% 정도 따로 잡아두기"] },
  { key: "s02", label: "02 예식장 계약", items: ["희망 지역, 날짜, 시간대, 하객 규모 정하기", "예식장 3곳 이상 투어 및 견적 비교", "대관료, 식대, 보증 인원, 최소 인원 확인", "포함 내역 확인 (폐백실, 신부대기실, 주차, 연회장 등)", "계약금, 잔금 일정, 환불·위약금 규정 확인", "계약서 작성"] },
  { key: "s03", label: "03 신혼집 구하기", items: ["주거 형태 정하기 (전세, 월세, 매매)", "대출 가능 여부와 한도 확인 (신혼부부 전용 대출 포함)", "지역 및 출퇴근 동선 정하기", "집 보기 및 계약", "등기부등본, 보증보험 등 권리관계 확인", "입주일, 이사 일정 확정"] },
  { key: "s04", label: "04 양가 인사와 상견례", items: ["양가 부모님께 결혼 의사 전달 및 인사", "상견례 날짜 조율 및 장소 예약 (조용한 룸이 있는 곳)", "사전 조율 주제 정리 (예식 시기, 예단·예물 범위, 혼수, 신혼집, 폐백)", "상견례 당일 식사비 부담 주체 정하기", "상견례 후 양가에 감사 인사"] },
  { key: "s05", label: "05 스드메 (스튜디오·드레스·메이크업)", items: ["웨딩플래너 이용 여부 결정 (직접 진행, 플래너, 패키지)", "스튜디오 비교 및 계약 (앨범 구성, 원본 제공 여부, 촬영 컨셉)", "드레스샵 투어 및 피팅 (촬영용·본식용 드레스, 신랑 예복)", "메이크업·헤어샵 선정 (리허설, 본식 당일 출장 여부)", "추가금 항목 사전 확인 (원본 추가, 피팅비, 헬퍼 비용, 지정 비용, 드레스 업그레이드)", "계약서의 환불·변경 규정 확인"] },
  { key: "s06", label: "06 예물·예단", items: ["예물 범위와 예산 양가 합의 (반지, 시계, 목걸이, 가방 등)", "결혼반지 구입", "예단·이바지 범위 협의 (간소화 또는 생략도 가능)", "함 진행 여부 결정", "현금, 물품 등 전달 방식과 시기 정하기"] },
  { key: "s07", label: "07 혼주 준비 (한복·메이크업)", items: ["혼주 한복 대여 또는 맞춤 결정 (신랑 어머님, 신부 어머님)", "한복 색상 조율 (양가 어머님 한복이 서로 어울리는지)", "아버님 예복 준비 (양복 또는 한복)", "혼주 메이크업·헤어 예약", "한복 피팅 일정 및 대여·반납일 확인"] },
  { key: "s08", label: "08 신혼여행", items: ["여행지, 기간, 예산 정하기", "항공권·숙소 예약 (성수기는 일찍 마감)", "여권 유효기간 확인 (6개월 이상) 및 필요 시 재발급", "비자, 입국 서류, 여행자보험 확인", "환전 및 현지 일정 계획"] },
  { key: "s09", label: "09 혼수 (가전·가구)", items: ["혼수 예산과 품목 정하기", "가전 목록 (냉장고, 세탁기, 건조기, TV, 에어컨, 청소기 등)", "가구 목록 (침대, 소파, 식탁, 옷장, 수납장 등)", "주방용품, 침구, 생활용품 목록 작성", "구매 및 배송·설치 일정을 입주일에 맞춰 조율", "양가 중복 구매 방지를 위해 품목 공유"] },
  { key: "s10", label: "10 청첩장과 하객 관리", items: ["하객 명단 정리 (양가, 지인, 직장)", "예식장 보증 인원과 맞춰 인원 조정", "청첩장 디자인 선택 및 제작 (모바일 청첩장 병행)", "청첩장 전달 (예식 2~4주 전 시작)", "식권 수량 및 좌석 배치 확인"] },
  { key: "s11", label: "11 예식 구성 요소", items: ["사회자 섭외", "축가·연주 섭외", "주례 또는 성혼선언문 낭독자 정하기", "식전 영상, 웰컴보드, 포토테이블 준비", "부케·부토니에 준비", "본식 스냅·영상 업체 계약 (선택)", "폐백 여부 결정 및 준비", "답례품 준비"] },
  { key: "s12", label: "12 법적·행정 절차", items: ["혼인신고 시기 결정 (예식 전 또는 후)", "혼인신고 서류 준비 (가족관계증명서, 혼인관계증명서 등)", "주소 이전과 전입신고 일정 확인", "보험, 통장, 카드 등 명의·주소 변경 목록 정리", "신혼부부 혜택 (대출, 청약 등) 확인"] },
  { key: "s13", label: "13 본인 관리", items: ["피부·바디 관리, 체중 관리", "웨딩 슈즈, 속옷, 액세서리 준비", "신랑 예복 수선 및 구두 준비", "건강검진 (선택)"] },
  { key: "s14", label: "14 결혼식 직전 점검", items: ["모든 업체 일정과 시간 재확인", "예식장 최종 점검 (식순, 음악, 좌석, 식사)", "잔금 정리 및 사례비 준비 (헬퍼, 기사님 등)", "축의금 접수 담당자 지정", "사회자·축가자와 최종 점검", "당일 비상 키트 준비 (반창고, 핀, 손거울, 간식, 보조배터리)", "전날 충분히 쉬기"] },
  { key: "s15", label: "15 결혼식 후", items: ["축의금 정산", "하객과 도움 주신 분들께 감사 인사", "앨범·영상 수령 확인", "양가 부모님께 인사 및 선물", "혼인신고 마무리 (아직 안 했다면)"] },
];
const TASK_DEFAULT_SECTIONS = TASK_STAGES.map(({ key, label }) => ({ key, label }));
const ORPHAN = { key: "_none", label: "분류 없음" };
function TaskView({ isMobile, wedding, setWedding }) {
  const [editMode, setEditMode] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const tasks = asList(wedding.tasks);
  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const upd = fn => setWedding(p => ({ ...p, tasks: fn(asList(p.tasks)) }));
  const setTask = (id, patch) => upd(list => list.map(t => t.id === id ? { ...t, ...patch } : t));
  const stages = sectionsOf(wedding, "taskStages", TASK_DEFAULT_SECTIONS);
  const known = new Set(stages.map(s => s.key));
  const stageOf = t => known.has(t.stage) ? t.stage : ORPHAN.key;
  const hasOrphan = tasks.some(t => !known.has(t.stage));
  const updStages = fn => setWedding(p => ({ ...p, taskStages: fn(sectionsOf(p, "taskStages", TASK_DEFAULT_SECTIONS)) }));

  // 기본 목록을 불러올 때, 지워버린 기본 단계가 있으면 다시 만들어줘요
  function loadTemplate() {
    setWedding(p => {
      const cur = sectionsOf(p, "taskStages", TASK_DEFAULT_SECTIONS);
      const have = new Set(cur.map(s => s.key));
      return {
        ...p,
        taskStages: [...cur, ...TASK_DEFAULT_SECTIONS.filter(s => !have.has(s.key))],
        tasks: [...asList(p.tasks), ...TASK_STAGES.flatMap(s => s.items.map(title => ({ id: genId(), stage: s.key, title, done: false, due: "" })))],
      };
    });
  }
  function addStage() {
    const key = "st_" + genId();
    updStages(list => [...list, { key, label: "새 단계" }]);
    upd(list => [...list, { id: genId(), stage: key, title: "새 할 일", done: false, due: "" }]);
  }
  function removeStage(s) {
    const n = tasks.filter(t => t.stage === s.key).length;
    if (stages.length <= 1) { window.alert("단계는 하나 이상 있어야 해요."); return; }
    if (!window.confirm(`'${s.label}' 단계를 지울까요?${n ? ` 안에 있는 할 일 ${n}개도 같이 지워져요.` : ""}`)) return;
    updStages(list => list.filter(x => x.key !== s.key));
    upd(list => list.filter(t => t.stage !== s.key));
  }
  // 같은 단계 안에서 위아래로 옮겨요
  function moveTask(t, dir) {
    upd(list => {
      const same = list.filter(x => stageOf(x) === stageOf(t));
      const j = same.findIndex(x => x.id === t.id) + dir;
      if (j < 0 || j >= same.length) return list;
      return moveInList(list, list.findIndex(x => x.id === t.id), list.findIndex(x => x.id === same[j].id) - list.findIndex(x => x.id === t.id));
    });
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.white, borderRadius: 16, padding: "12px 16px", border: `1.5px solid ${C.border}`, marginBottom: 12, boxShadow: `0 2px 10px ${C.pink1}` }}>
        <Ring pct={pct} size={52} stroke={6} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: C.rose }}>✅ 결혼 준비 진행률</div>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginTop: 2 }}>{tasks.length ? `${done}/${tasks.length}개 완료 · 위에서부터 차례대로` : "아직 준비 목록이 없어요"}</div>
        </div>
        {!editMode && tasks.length > 0 && <button onClick={() => setHideDone(p => !p)} style={{ padding: "5px 10px", borderRadius: 99, border: `1.5px solid ${hideDone ? C.rose : C.border}`, background: hideDone ? C.rose + "18" : C.white, color: hideDone ? C.rose : C.sub, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>{hideDone ? "완료 숨김" : "완료 숨기기"}</button>}
        <button onClick={() => setEditMode(p => !p)} style={editBtn(editMode)}>{editMode ? "완료" : "편집"}</button>
      </div>

      {tasks.length === 0 && !editMode && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>중요한 순서대로 정리된 15단계 준비 목록을 불러와서 우리한테 맞게 고쳐 써봐요 💍</div>
          <button onClick={loadTemplate} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>📋 기본 준비 목록 불러오기</button>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>처음부터 직접 만들고 싶으면 <b>편집</b>을 눌러요</div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
        {[...stages, ...(hasOrphan ? [ORPHAN] : [])].map((s, si) => {
          const items = tasks.filter(t => stageOf(t) === s.key);
          if (items.length === 0 && !editMode) return null;
          const shown = hideDone && !editMode ? items.filter(t => !t.done) : items;
          const sDone = items.filter(t => t.done).length;
          const allDone = items.length > 0 && sDone === items.length;
          return (
            <div key={s.key} style={{ background: C.white, borderRadius: 14, border: `1.5px solid ${allDone ? "#9ED4B4" : C.border}`, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", background: allDone ? "#E9F6EE" : "#FFF3F1", borderBottom: `1px solid ${C.border}` }}>
                {editMode && s.key !== ORPHAN.key ? (
                  <SectionEditHead id={s.key} label={s.label} first={si === 0} last={si === stages.length - 1}
                    onRename={v => updStages(list => list.map(x => x.key === s.key ? { ...x, label: v } : x))}
                    onMove={dir => updStages(list => moveInList(list, si, dir))}
                    onRemove={() => removeStage(s)} />
                ) : (
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 900, color: allDone ? "#2E8B57" : C.rose }}>{s.label}</span>
                )}
                <span style={{ fontSize: 11, fontWeight: 800, color: allDone ? "#4CAF84" : C.sub }}>{allDone ? "✓ " : ""}{sDone}/{items.length}</span>
              </div>
              <div style={{ padding: "6px 10px" }}>
                {shown.map((t, ti) => editMode ? (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 0", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                    <KoreanInput key={"task-" + t.id} value={t.title} onChange={v => setTask(t.id, { title: v })} style={{ ...smallInp, flex: 1, minWidth: isMobile ? "100%" : 0 }} />
                    <input type="date" value={t.due || ""} onChange={e => setTask(t.id, { due: e.target.value })} title="언제까지" style={{ ...smallInp, width: 130, flex: "none" }} />
                    <select value={stageOf(t)} onChange={e => setTask(t.id, { stage: e.target.value })} title="다른 단계로 옮기기" style={{ ...smallInp, width: isMobile ? 90 : 110, flex: "none" }}>
                      {stages.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                      {stageOf(t) === ORPHAN.key && <option value={ORPHAN.key}>{ORPHAN.label}</option>}
                    </select>
                    <button onClick={() => moveTask(t, -1)} disabled={ti === 0} style={{ ...iconBtn, opacity: ti === 0 ? .25 : .8 }}>↑</button>
                    <button onClick={() => moveTask(t, 1)} disabled={ti === shown.length - 1} style={{ ...iconBtn, opacity: ti === shown.length - 1 ? .25 : .8 }}>↓</button>
                    <button onClick={() => upd(list => list.filter(x => x.id !== t.id))} style={{ ...iconBtn, color: C.tomato }}>✕</button>
                  </div>
                ) : (
                  <div key={t.id} onClick={() => setTask(t.id, { done: !t.done })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: `1px dashed ${C.pink1}`, cursor: "pointer", userSelect: "none" }}>
                    <WeeklyCheckbox checked={!!t.done} onToggle={() => {}} />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: t.done ? 500 : 700, color: t.done ? C.sub : C.text, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
                    {t.due && <span style={{ fontSize: 11, fontWeight: 700, color: !t.done && t.due < todayStr ? C.tomato : C.sub, flexShrink: 0 }}>~{t.due.slice(5).replace("-", "/")}</span>}
                  </div>
                ))}
                {!editMode && hideDone && items.length > 0 && shown.length === 0 && <div style={{ fontSize: 12, color: "#4CAF84", fontWeight: 700, padding: "8px 2px" }}>🎉 이 단계 준비 끝!</div>}
                {editMode && s.key !== ORPHAN.key && <button onClick={() => upd(list => [...list, { id: genId(), stage: s.key, title: "새 할 일", done: false, due: "" }])} style={{ ...dashedAddBtn, marginTop: 6, padding: "6px 0" }}>＋ 할 일 추가</button>}
              </div>
            </div>
          );
        })}
      </div>
      {editMode && <button onClick={addStage} style={{ ...dashedAddBtn, marginTop: 12 }}>＋ 새 단계 추가</button>}
      {editMode && (
        <div style={tipBox}>
          ✏️ 단계 이름과 할 일을 바로 고칠 수 있어요. ↑↓로 순서를 바꾸고, 할 일 옆 목록으로 다른 단계로 옮겨요.<br />
          📅 날짜를 넣으면 "~11/30"처럼 마감일이 보여요. 지난 마감일은 빨갛게 보여요.<br />
          🧹 스몰웨딩·종교 예식처럼 우리랑 상관없는 항목은 ✕로 지워서 쓰세요.<br />
          {tasks.length > 0 && <>📋 <span onClick={loadTemplate} style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 800 }}>기본 목록 한 번 더 불러오기</span> (지금 목록 뒤에 덧붙여져요)</>}
        </div>
      )}
      {tasks.length > 0 && !editMode && (
        <div style={{ ...tipBox, marginTop: 14 }}>
          <b>📌 꼭 기억하기</b><br />
          · 환불 규정, 추가금 항목, 포함 내역은 반드시 계약서로 확인해요.<br />
          · 예단, 예물, 혼주 한복처럼 의견이 갈리기 쉬운 건 초반에 양가 합의해요.<br />
          · 봄·가을 주말 예식장과 신혼여행 항공권은 빨리 마감돼요.
        </div>
      )}
    </>
  );
}

// 💰 예산표: 대분류별로 항목을 적고, 금액을 신랑·신부가 얼마씩 내는지 나눠 적어요.
const BUDGET_GROUPS = [
  { key: "meet",    label: "상견례",    color: "#F4B6C2", items: ["신랑측 부모님 선물", "신부측 부모님 선물", "식사"] },
  { key: "hall",    label: "웨딩홀",    color: "#FFD27F", items: ["예약금", "대관료", "꽃장식", "신랑측 식대", "신부측 식대"] },
  { key: "sdm",     label: "스드메",    color: "#FFE7A3", items: ["스튜디오", "드레스", "메이크업", "플래닝비", "헬퍼비", "헤어변형", "촬영 소품·간식"] },
  { key: "main",    label: "본식",      color: "#B9E3C6", items: ["신랑 예복", "혼주 메이크업", "혼주 한복", "아버님 예복", "부케·부토니에", "본식 스냅·영상", "사회자·축가 사례"] },
  { key: "jewelry", label: "예물·예단", color: "#D9C8F0", items: ["웨딩밴드", "프로포즈 반지", "예단"] },
  { key: "honey",   label: "신혼여행",  color: "#B7D7F2", items: ["항공권", "숙소", "환전", "여행 경비", "쇼핑"] },
  { key: "etc",     label: "기타",      color: "#E3DAD7", items: ["종이 청첩장", "모바일 청첩장", "답례품"] },
];
const BUDGET_COLS = [
  { key: "item",   label: "항목",   w: 120 },
  { key: "detail", label: "내용",   w: 170 },
  { key: "plan",   label: "예산",   w: 100, num: true },
  { key: "cost",   label: "금액",   w: 100, num: true },
  { key: "groom",  label: "💙 신랑", w: 100, num: true },
  { key: "bride",  label: "🩷 신부", w: 100, num: true },
  { key: "paid",   label: "낸 돈",  w: 100, num: true },
  { key: "memo",   label: "메모",   w: 140 },
];
const BUDGET_DEFAULT_SECTIONS = BUDGET_GROUPS.map(({ key, label, color }) => ({ key, label, color }));
const SECTION_COLORS = ["#F4B6C2", "#FFD27F", "#FFE7A3", "#B9E3C6", "#D9C8F0", "#B7D7F2", "#E3DAD7", "#FFC8A8"];
// 호갱 vs 실속: 릴스에서 본 결혼비용 차이 포인트
const BUDGET_TIPS = [
  ["풀패키지 (스드메+웨딩홀 2000만원)", "필요한 것만 선택계약"],
  ["앨범 추가 (추가금 300만원~)", "기본앨범 + 원본"],
  ["맞춤 예복 (브랜드 300만원~)", "기성복 (50만원~)"],
  ["제시한 보증인원 그대로", "최소 보증인원으로 협상"],
  ["혼주 한복 맞춤 (양가 300만원~)", "혼주 한복 대여 (양가 80만원~)"],
  ["서브스냅 추가 (100만원~)", "본식 스냅만 (계약 포함)"],
];
function BudgetView({ isMobile, wedding, setWedding }) {
  const [tipsOpen, setTipsOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const budget = wedding.budget || {};
  const items = asList(budget.items);
  const groups = sectionsOf(wedding, "budgetGroups", BUDGET_DEFAULT_SECTIONS);
  const groupKeys = new Set(groups.map(g => g.key));
  const groupOf = it => groupKeys.has(it.group) ? it.group : ORPHAN.key;
  const shownGroups = [...groups, ...(items.some(it => !groupKeys.has(it.group)) ? [{ ...ORPHAN, color: "#E3DAD7" }] : [])];
  const upd = fn => setWedding(p => ({ ...p, budget: fn({ ...(p.budget || {}), items: asList(p.budget && p.budget.items) }) }));
  const updGroups = fn => setWedding(p => ({ ...p, budgetGroups: fn(sectionsOf(p, "budgetGroups", BUDGET_DEFAULT_SECTIONS)) }));
  function loadTemplate() {
    setWedding(p => {
      const cur = sectionsOf(p, "budgetGroups", BUDGET_DEFAULT_SECTIONS);
      const have = new Set(cur.map(g => g.key));
      const b = p.budget || {};
      return { ...p, budgetGroups: [...cur, ...BUDGET_DEFAULT_SECTIONS.filter(g => !have.has(g.key))], budget: { ...b, items: [...asList(b.items), ...BUDGET_GROUPS.flatMap(g => g.items.map(name => newItem(g.key, name)))] } };
    });
  }
  function addGroup() {
    const key = "bg_" + genId();
    updGroups(list => [...list, { key, label: "새 분류", color: SECTION_COLORS[list.length % SECTION_COLORS.length] }]);
    upd(b => ({ ...b, items: [...b.items, newItem(key)] }));
  }
  function removeGroup(g) {
    const n = items.filter(it => it.group === g.key).length;
    if (groups.length <= 1) { window.alert("분류는 하나 이상 있어야 해요."); return; }
    if (!window.confirm(`'${g.label}' 분류를 지울까요?${n ? ` 안에 있는 항목 ${n}개도 같이 지워져요.` : ""}`)) return;
    updGroups(list => list.filter(x => x.key !== g.key));
    upd(b => ({ ...b, items: b.items.filter(it => it.group !== g.key) }));
  }
  // 같은 분류 안에서 위아래로 옮겨요
  function moveItem(it, dir) {
    upd(b => {
      const same = b.items.filter(x => groupOf(x) === groupOf(it));
      const j = same.findIndex(x => x.id === it.id) + dir;
      if (j < 0 || j >= same.length) return b;
      const i = b.items.findIndex(x => x.id === it.id);
      return { ...b, items: moveInList(b.items, i, b.items.findIndex(x => x.id === same[j].id) - i) };
    });
  }
  // 편집 모드에서 항목 옆에 나오는 분류 옮기기·순서 버튼
  const itemTools = (it, idx, len) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <select value={groupOf(it)} onChange={e => setItem(it.id, "group", e.target.value)} title="다른 분류로 옮기기" style={{ ...smallInp, width: 88, padding: "4px 4px" }}>
        {groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        {groupOf(it) === ORPHAN.key && <option value={ORPHAN.key}>{ORPHAN.label}</option>}
      </select>
      <button onClick={() => moveItem(it, -1)} disabled={idx === 0} style={{ ...iconBtn, opacity: idx === 0 ? .25 : .8 }}>↑</button>
      <button onClick={() => moveItem(it, 1)} disabled={idx === len - 1} style={{ ...iconBtn, opacity: idx === len - 1 ? .25 : .8 }}>↓</button>
    </span>
  );
  const setItem = (id, key, v) => upd(b => ({ ...b, items: b.items.map(it => it.id === id ? { ...it, [key]: v } : it) }));
  const newItem = (group, item = "") => ({ id: genId(), group, item, detail: "", plan: "", cost: "", groom: "", bride: "", paid: "", memo: "" });
  function removeItem(it) {
    if (window.confirm(`${it.item || "이"} 항목을 지울까요?`)) upd(b => ({ ...b, items: b.items.filter(x => x.id !== it.id) }));
  }
  // 📤 짠포마토의 기록 › 💍 결혼 예산 탭으로 옮길 수 있게 예산표를 글자로 복사해요
  async function exportToPomato() {
    const text = JSON.stringify({ type: "jjanto-wedding-budget", total: budget.total || "", groups, items });
    try {
      await navigator.clipboard.writeText(text);
      window.alert("예산표를 복사했어요! 짠포마토의 기록 › 💍 결혼 예산에서 '📥 플래너에서 가져오기'를 누르고 붙여넣어요.");
    } catch {
      window.prompt("아래 내용을 전부 복사해서 짠포마토의 기록에 붙여넣어요.", text);
    }
  }

  const sum = (list, k) => list.reduce((s, it) => s + toWon(it[k]), 0);
  const rest = it => Math.max(0, toWon(it.cost) - toWon(it.paid));
  // 신랑+신부로 나눈 돈이 금액과 다르면 알려줘요 (둘 다 비어 있으면 아직 안 나눈 걸로 봐요)
  const splitGap = it => (it.groom || it.bride) ? toWon(it.cost) - toWon(it.groom) - toWon(it.bride) : 0;
  const cost = sum(items, "cost"), groom = sum(items, "groom"), bride = sum(items, "bride");
  const unassigned = items.reduce((s, it) => s + (it.groom || it.bride ? 0 : toWon(it.cost)), 0);
  const balance = items.reduce((s, it) => s + rest(it), 0);
  // 예상 지출: 금액이 정해진 항목은 금액, 아직이면 예산으로 쳐요
  const expected = items.reduce((s, it) => s + (toWon(it.cost) || toWon(it.plan)), 0);
  const total = toWon(budget.total);
  const left = total - expected;

  const card = (label, value, color = C.text, sub) => (
    <div style={{ background: C.white, borderRadius: 12, border: `1.5px solid ${C.border}`, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color, marginTop: 2 }}>{fmtWon(value)}원</div>
      {sub && <div style={{ fontSize: 10, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const field = (it, c, style) => <KoreanInput key={c.key + "-" + it.id} value={it[c.key] || ""} inputMode={c.num ? "numeric" : undefined} placeholder={c.num ? "0" : ""} onChange={v => setItem(it.id, c.key, c.num ? v.replace(/[^\d]/g, "") : v)} style={{ ...smallInp, textAlign: c.num ? "right" : "left", ...style }} />;
  const gapNote = it => { const g = splitGap(it); return g ? <span style={{ fontSize: 10, color: "#C98A00", fontWeight: 700 }}>⚠️ 나눈 돈이 금액보다 {fmtWon(Math.abs(g))}원 {g > 0 ? "적어요" : "많아요"}</span> : null; };
  const th = { padding: "7px 6px", fontSize: 12, fontWeight: 800, color: C.text, whiteSpace: "nowrap", borderBottom: `1px solid ${C.border}` };
  const numTd = { padding: "6px 8px", textAlign: "right", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" };

  return (
    <>
      <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, padding: "12px 14px", marginBottom: 10, boxShadow: `0 2px 10px ${C.pink1}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.rose }}>💰 총 예산</span>
        <KoreanInput key="budget-total" value={budget.total || ""} inputMode="numeric" placeholder="예) 30000000" onChange={v => setWedding(p => ({ ...p, budget: { ...(p.budget || {}), total: v.replace(/[^\d]/g, "") } }))} style={{ ...smallInp, width: 150, textAlign: "right", fontSize: 14, fontWeight: 800 }} />
        <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{total > 0 ? `${fmtWon(total)}원` : "원"}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
        {card("지금까지 결혼비용", cost, C.rose, unassigned ? `아직 안 나눈 돈 ${fmtWon(unassigned)}원` : "금액 칸 합계")}
        {card("💙 신랑 총 결혼비용", groom)}
        {card("🩷 신부 총 결혼비용", bride)}
        {card("남은 잔금", balance, C.tomato, "금액 − 낸 돈")}
        {card(left >= 0 ? "총 예산 대비 여유" : "총 예산 초과", Math.abs(left), left >= 0 ? "#4CAF84" : C.tomato, total ? "금액이 없는 항목은 예산으로 계산" : "위에 총 예산을 적어주세요")}
      </div>

      <div style={{ background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, marginBottom: 14, overflow: "hidden" }}>
        <div onClick={() => setTipsOpen(p => !p)} style={{ padding: "10px 14px", fontSize: 13, fontWeight: 900, color: C.rose, cursor: "pointer", display: "flex" }}>
          <span style={{ flex: 1 }}>💡 결혼비용 한끗차이: 호갱 vs 실속</span><span style={{ color: C.sub }}>{tipsOpen ? "접기 ▲" : "펼치기 ▼"}</span>
        </div>
        {tipsOpen && (
          <div style={{ padding: "0 14px 12px", maxWidth: 760, display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "6px 8px", fontSize: 12, alignItems: "center" }}>
            <b style={{ color: C.tomato }}>😵 호갱</b><span /><b style={{ color: "#2E8B57" }}>😎 실속</b>
            {BUDGET_TIPS.map(([a, b]) => (
              <Fragment key={a}><span style={{ color: C.sub }}>{a}</span><span style={{ color: C.pink2 }}>→</span><span style={{ fontWeight: 700 }}>{b}</span></Fragment>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
          <button onClick={exportToPomato} style={{ ...editBtn(false), background: C.white, color: C.rose, border: `1.5px solid ${C.rose}` }}>📤 짠포마토로 보내기</button>
          <button onClick={() => setEditMode(p => !p)} style={editBtn(editMode)}>{editMode ? "완료" : "분류 편집"}</button>
        </div>
      )}
      {items.length === 0 && !editMode && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>상견례부터 신혼여행까지 자주 쓰는 항목을 불러와서 금액만 채워봐요 💰</div>
          <button onClick={loadTemplate} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>📋 기본 항목 불러오기</button>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>처음부터 직접 만들고 싶으면 <span onClick={() => setEditMode(true)} style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 800 }}>분류 편집</span>을 눌러요</div>
        </div>
      )}

      {(items.length > 0 || editMode) && shownGroups.map((g, gi) => {
        const list = items.filter(it => groupOf(it) === g.key);
        if (!editMode && list.length === 0) return null;
        const gCost = sum(list, "cost"), gGroom = sum(list, "groom"), gBride = sum(list, "bride");
        return (
          <div key={g.key} style={{ background: C.white, borderRadius: 14, border: `1.5px solid ${C.border}`, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: g.color + "66", flexWrap: "wrap" }}>
              {editMode && g.key !== ORPHAN.key ? (
                <SectionEditHead id={g.key} label={g.label} first={gi === 0} last={gi === groups.length - 1}
                  onRename={v => updGroups(l => l.map(x => x.key === g.key ? { ...x, label: v } : x))}
                  onMove={dir => updGroups(l => moveInList(l, gi, dir))}
                  onRemove={() => removeGroup(g)} />
              ) : (
                <span style={{ fontSize: 14, fontWeight: 900, color: C.text, flex: 1 }}>{g.label}</span>
              )}
              <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>총 {fmtWon(gCost)}원</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.sub }}>💙 {fmtWon(gGroom)} · 🩷 {fmtWon(gBride)}</span>
            </div>
            {isMobile ? (
              <div style={{ padding: "6px 10px" }}>
                {list.map((it, ii) => (
                  <div key={it.id} style={{ borderBottom: `1px dashed ${C.border}`, padding: "8px 0" }}>
                    {editMode && <div style={{ marginBottom: 6 }}>{itemTools(it, ii, list.length)}</div>}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
                      {field(it, BUDGET_COLS[0], { fontWeight: 800, width: 110, flex: "none" })}
                      {field(it, BUDGET_COLS[1], { flex: 1 })}
                      <button onClick={() => removeItem(it)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 14, opacity: .7 }}>✕</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {BUDGET_COLS.slice(2, 7).map(c => (
                        <label key={c.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.sub, fontWeight: 700 }}>
                          <span style={{ width: 40, flexShrink: 0 }}>{c.label}</span>{field(it, c)}
                        </label>
                      ))}
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.sub, fontWeight: 700 }}>
                        <span style={{ width: 40 }}>잔금</span><span style={{ fontSize: 13, fontWeight: 800, color: rest(it) ? C.tomato : C.sub }}>{fmtWon(rest(it))}원</span>
                      </span>
                    </div>
                    {field(it, BUDGET_COLS[7], { marginTop: 6 })}
                    {gapNote(it)}
                  </div>
                ))}
                {g.key !== ORPHAN.key && <button onClick={() => upd(b => ({ ...b, items: [...b.items, newItem(g.key)] }))} style={{ ...dashedAddBtn, margin: "8px 0 4px", padding: "6px 0" }}>＋ {g.label} 항목 추가</button>}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      {BUDGET_COLS.slice(0, 7).map(c => <th key={c.key} style={{ ...th, minWidth: c.w }}>{c.label}</th>)}
                      <th style={{ ...th, minWidth: 90 }}>잔금</th>
                      <th style={{ ...th, minWidth: BUDGET_COLS[7].w }}>메모</th>
                      <th style={{ ...th, width: 30 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((it, ii) => (
                      <Fragment key={it.id}>
                        <tr>
                          {BUDGET_COLS.slice(0, 7).map(c => <td key={c.key} style={{ padding: "4px 3px" }}>{field(it, c, c.key === "item" ? { fontWeight: 800 } : undefined)}</td>)}
                          <td style={{ ...numTd, fontWeight: 800, color: rest(it) ? C.tomato : C.sub }}>{fmtWon(rest(it))}원</td>
                          <td style={{ padding: "4px 3px" }}>{field(it, BUDGET_COLS[7])}</td>
                          <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>{editMode && itemTools(it, ii, list.length)}<button onClick={() => removeItem(it)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 13, opacity: .7 }}>✕</button></td>
                        </tr>
                        {splitGap(it) !== 0 && <tr><td /><td colSpan={9} style={{ padding: "0 4px 4px" }}>{gapNote(it)}</td></tr>}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "6px 10px 10px" }}>
                  {g.key !== ORPHAN.key && <button onClick={() => upd(b => ({ ...b, items: [...b.items, newItem(g.key)] }))} style={{ ...dashedAddBtn, padding: "6px 0" }}>＋ {g.label} 항목 추가</button>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {editMode && (
        <>
          <button onClick={addGroup} style={{ ...dashedAddBtn, marginBottom: 12 }}>＋ 새 분류 추가</button>
          <div style={{ ...tipBox, marginTop: 0, marginBottom: 12 }}>
            ✏️ 분류 이름을 고치고 ↑↓로 순서를 바꿀 수 있어요. 🗑️를 누르면 그 분류와 안의 항목이 같이 지워져요.<br />
            🔀 항목 옆 목록으로 다른 분류로 옮기고, ↑↓로 순서를 바꿔요.
            {items.length > 0 && <><br />📋 <span onClick={loadTemplate} style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 800 }}>기본 항목 한 번 더 불러오기</span> (지금 항목 뒤에 덧붙여져요)</>}
          </div>
        </>
      )}
      {items.length > 0 && (
        <div style={{ background: "#3A3A3A", color: C.white, borderRadius: 14, padding: "12px 16px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 6, fontSize: 14, fontWeight: 800 }}>
          <span>💙 신랑 총결혼비용 {fmtWon(groom)}원</span>
          <span>🩷 신부 총결혼비용 {fmtWon(bride)}원</span>
          <span>💍 총 결혼비용 {fmtWon(cost)}원</span>
        </div>
      )}
      <div style={tipBox}>
        💡 <b>예산</b>은 쓰기로 마음먹은 돈, <b>금액</b>은 실제로 계약하거나 쓴 돈이에요. 금액을 💙신랑·🩷신부 칸에 누가 얼마씩 내는지 나눠 적어요.<br />
        🧾 <b>낸 돈</b>은 계약금처럼 이미 보낸 돈이고, <b>잔금</b> = 금액 − 낸 돈이에요.
      </div>
    </>
  );
}

// 🏢 업체 관리: 항목마다 미정 → 후보 → 계약완료(또는 안 함)로 진행 상황을 봐요. 돈은 예산표에만 적어요.
const VENDOR_GROUPS = [
  { key: "all",  label: "전체" },
  { key: "hall", label: "웨딩홀" },
  { key: "sdm",  label: "스드메" },
  { key: "host", label: "혼주" },
  { key: "main", label: "본식" },
  { key: "etc",  label: "기타" },
];
const VENDOR_DEFAULT_SECTIONS = VENDOR_GROUPS.slice(1);
const VENDOR_TEMPLATE = [
  ["hall", "🏰", "웨딩홀"],
  ["sdm", "📸", "스튜디오"], ["sdm", "👰", "드레스"], ["sdm", "🤵", "예복"], ["sdm", "💄", "메이크업"], ["sdm", "💇", "헤어 변형"],
  ["host", "💄", "혼주 메이크업"], ["host", "👘", "혼주 한복"], ["host", "👔", "혼주 정장"],
  ["main", "📷", "본식 스냅"], ["main", "🎥", "본식 DVD"], ["main", "📱", "아이폰 스냅"], ["main", "🎞️", "서브스냅"], ["main", "🎤", "사회자"], ["main", "🎶", "축가"], ["main", "💐", "부케"], ["main", "🧧", "폐백"],
  ["etc", "💌", "청첩장"], ["etc", "📲", "모바일 청첩장"], ["etc", "💍", "예물"], ["etc", "🏝️", "허니문"], ["etc", "💰", "축의대"], ["etc", "🤝", "웨딩플래너"],
];
const VENDOR_STATUS = [
  { key: "",     label: "미정",     color: C.sub,     bg: C.white },
  { key: "cand", label: "후보",     color: "#C98A00", bg: "#FFF6DD" },
  { key: "done", label: "계약완료", color: "#2E8B57", bg: "#E3F4EA" },
  { key: "skip", label: "안 함",    color: "#9E9E9E", bg: "#F2F2F2" },
];
function VendorView({ isMobile, wedding, setWedding }) {
  const [group, setGroup] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const vendors = asList(wedding.vendors);
  const upd = fn => setWedding(p => ({ ...p, vendors: fn(asList(p.vendors)) }));
  const setV = (id, patch) => upd(list => list.map(v => v.id === id ? { ...v, ...patch } : v));
  const statusOf = v => VENDOR_STATUS.find(s => s.key === (v.status || "")) || VENDOR_STATUS[0];
  const nextStatus = v => VENDOR_STATUS[(VENDOR_STATUS.indexOf(statusOf(v)) + 1) % VENDOR_STATUS.length].key;
  const count = k => vendors.filter(v => (v.status || "") === k).length;
  const groups = sectionsOf(wedding, "vendorGroups", VENDOR_DEFAULT_SECTIONS);
  const groupKeys = new Set(groups.map(g => g.key));
  const updGroups = fn => setWedding(p => ({ ...p, vendorGroups: fn(sectionsOf(p, "vendorGroups", VENDOR_DEFAULT_SECTIONS)) }));
  const curGroup = group === "all" || groupKeys.has(group) ? group : "all";
  // 안 함은 맨 아래로 내려서 볼 것만 위에 남겨요 (편집할 때는 저장된 순서 그대로)
  const filtered = vendors.filter(v => curGroup === "all" || v.group === curGroup);
  const shown = editMode ? filtered : [...filtered].sort((a, b) => (a.status === "skip") - (b.status === "skip"));

  function loadTemplate() {
    setWedding(p => {
      const cur = sectionsOf(p, "vendorGroups", VENDOR_DEFAULT_SECTIONS);
      const have = new Set(cur.map(g => g.key));
      return {
        ...p,
        vendorGroups: [...cur, ...VENDOR_DEFAULT_SECTIONS.filter(g => !have.has(g.key))],
        vendors: [...asList(p.vendors), ...VENDOR_TEMPLATE.map(([g, emoji, name]) => ({ id: genId(), group: g, emoji, name, status: "", vendor: "", memo: "" }))],
      };
    });
  }
  function addGroup() {
    const key = "vg_" + genId();
    updGroups(list => [...list, { key, label: "새 분류" }]);
    setGroup(key);
  }
  function removeGroup(g) {
    const n = vendors.filter(v => v.group === g.key).length;
    if (groups.length <= 1) { window.alert("분류는 하나 이상 있어야 해요."); return; }
    if (!window.confirm(`'${g.label}' 분류를 지울까요?${n ? ` 안에 있는 업체 항목 ${n}개도 같이 지워져요.` : ""}`)) return;
    updGroups(list => list.filter(x => x.key !== g.key));
    upd(list => list.filter(v => v.group !== g.key));
  }
  // 지금 보이는 목록 안에서 위아래로 옮겨요
  function moveVendor(v, dir) {
    const j = shown.findIndex(x => x.id === v.id) + dir;
    if (j < 0 || j >= shown.length) return;
    upd(list => { const i = list.findIndex(x => x.id === v.id); return moveInList(list, i, list.findIndex(x => x.id === shown[j].id) - i); });
  }

  const stat = (label, n, color) => (
    <div style={{ background: C.white, borderRadius: 12, border: `1.5px solid ${C.border}`, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color, marginTop: 2 }}>{n}곳</div>
    </div>
  );

  if (vendors.length === 0 && !editMode) return (
    <div style={{ textAlign: "center", padding: "30px 0" }}>
      <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>웨딩홀부터 부케까지 업체를 하나씩 정해 나가는 걸 한눈에 봐요 🏢</div>
      <button onClick={loadTemplate} style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>📋 기본 업체 목록 불러오기</button>
      <div style={{ fontSize: 12, color: C.sub, marginTop: 8 }}>처음부터 직접 만들고 싶으면 <span onClick={() => setEditMode(true)} style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 800 }}>편집</span>을 눌러요</div>
    </div>
  );

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        {stat("미정", count(""), C.text)}
        {stat("후보", count("cand"), "#C98A00")}
        {stat("계약완료", count("done"), "#2E8B57")}
        {stat("안 함", count("skip"), "#9E9E9E")}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", flex: 1 }}>
          {[VENDOR_GROUPS[0], ...groups].map(g => (
            <button key={g.key} onClick={() => setGroup(g.key)} style={{ flexShrink: 0, padding: "5px 12px", border: "none", borderBottom: `3px solid ${curGroup === g.key ? C.rose : "transparent"}`, background: "transparent", color: curGroup === g.key ? C.text : C.sub, fontSize: 13, fontWeight: curGroup === g.key ? 900 : 700, cursor: "pointer" }}>{g.label}</button>
          ))}
        </div>
        <button onClick={() => setEditMode(p => !p)} style={editBtn(editMode)}>{editMode ? "완료" : "편집"}</button>
      </div>

      {editMode && (
        <div style={{ background: C.white, borderRadius: 14, border: `1.5px dashed ${C.rose}`, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.rose, marginBottom: 6 }}>📂 분류 편집</div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 6 }}>
            {groups.map((g, gi) => (
              <SectionEditHead key={g.key} id={g.key} label={g.label} first={gi === 0} last={gi === groups.length - 1}
                onRename={v => updGroups(l => l.map(x => x.key === g.key ? { ...x, label: v } : x))}
                onMove={dir => updGroups(l => moveInList(l, gi, dir))}
                onRemove={() => removeGroup(g)} />
            ))}
          </div>
          <button onClick={addGroup} style={{ ...dashedAddBtn, marginTop: 8, padding: "6px 0" }}>＋ 새 분류 추가</button>
        </div>
      )}

      <div style={{ background: C.white, borderRadius: 16, border: `1.5px solid ${C.border}`, overflow: "hidden" }}>
        {shown.map(v => {
          const st = statusOf(v);
          const open = openId === v.id;
          return (
            <div key={v.id} style={{ borderBottom: `1px solid ${C.pink1}`, opacity: v.status === "skip" ? .55 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px" }}>
                {editMode ? (
                  <>
                    <KoreanInput key={"vemoji-" + v.id} value={v.emoji || ""} onChange={x => setV(v.id, { emoji: x })} style={{ ...smallInp, width: 44, flex: "none", textAlign: "center" }} />
                    <KoreanInput key={"vname-" + v.id} value={v.name || ""} onChange={x => setV(v.id, { name: x })} style={{ ...smallInp, flex: 1 }} />
                    <select value={groupKeys.has(v.group) ? v.group : ""} onChange={e => setV(v.id, { group: e.target.value })} style={{ ...smallInp, width: 90, flex: "none" }}>
                      {!groupKeys.has(v.group) && <option value="">분류 없음</option>}
                      {groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
                    </select>
                    <button onClick={() => moveVendor(v, -1)} style={iconBtn}>↑</button>
                    <button onClick={() => moveVendor(v, 1)} style={iconBtn}>↓</button>
                    <button onClick={() => { if (window.confirm(`${v.name || "이"} 항목을 지울까요?`)) upd(list => list.filter(x => x.id !== v.id)); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 13, opacity: .7 }}>✕</button>
                  </>
                ) : (
                  <>
                    <div onClick={() => setOpenId(open ? null : v.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{v.emoji}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: C.text, whiteSpace: "nowrap" }}>{v.name}</span>
                      <span style={{ fontSize: 13, color: v.vendor ? C.text : C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>: {v.vendor || "미정"}</span>
                      {v.memo && <span style={{ fontSize: 11, flexShrink: 0 }}>📝</span>}
                    </div>
                    <button onClick={() => setV(v.id, { status: nextStatus(v) })} title="눌러서 상태 바꾸기" style={{ flexShrink: 0, minWidth: 66, padding: "4px 10px", borderRadius: 99, border: `1.5px solid ${st.color}55`, background: st.bg, color: st.color, fontSize: 12, fontWeight: 800, cursor: "pointer" }}>{st.label}</button>
                  </>
                )}
              </div>
              {open && !editMode && (
                <div style={{ padding: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <KoreanInput key={"vvendor-" + v.id} value={v.vendor || ""} onChange={x => setV(v.id, { vendor: x })} placeholder="업체 이름 (후보면 여러 곳 적어도 돼요)" style={smallInp} />
                  <KoreanTextarea key={"vmemo-" + v.id} value={v.memo || ""} onChange={x => setV(v.id, { memo: x })} rows={3} placeholder={"후보 비교, 견적, 연락처, 상담 날짜 등\n예) A홀 식대 5.5만 / B홀 식대 6만, 주차 2시간"} style={{ ...smallInp, resize: "vertical", lineHeight: 1.6 }} />
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 && <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: C.sub }}>이 분류엔 아직 항목이 없어요</div>}
      </div>
      {editMode && <button onClick={() => upd(list => [...list, { id: genId(), group: curGroup === "all" ? groups[groups.length - 1].key : curGroup, emoji: "📌", name: "새 항목", status: "", vendor: "", memo: "" }])} style={{ ...dashedAddBtn, marginTop: 10 }}>＋ 업체 항목 추가</button>}
      <div style={tipBox}>
        💡 오른쪽 상태 버튼을 누를 때마다 미정 → 후보 → 계약완료 → 안 함 순서로 바뀌어요. 안 함은 맨 아래로 내려가요.<br />
        📝 항목 이름을 누르면 업체 이름과 후보 비교 메모를 적을 수 있어요. 계약 금액은 💰 예산 탭에 적어요.
      </div>
    </>
  );
}

// 🗒️ 결혼 메모: 릴스에서 본 팁, 업체 상담 내용, 캡처 사진을 모아둬요
function WeddingMemoView({ wedding, setWedding }) {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [inputKey, setInputKey] = useState(0);
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);
  const memos = asList(wedding.memos);
  const upd = fn => setWedding(p => ({ ...p, memos: fn(asList(p.memos)) }));
  const q = search.trim().toLowerCase();
  const shown = q ? memos.filter(m => (m.text || "").toLowerCase().includes(q)) : memos;

  function add() {
    if (!text.trim() && !img) return;
    upd(list => [{ id: genId(), text: text.trim(), image: img, createdAt: new Date().toISOString() }, ...list]);
    setText(""); setImg(null); setInputKey(k => k + 1);
  }
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: C.sub }}>🔍</span>
        <KoreanInput value={search} onChange={setSearch} placeholder="결혼 메모 검색..." style={{ width: "100%", padding: "9px 12px 9px 34px", border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 13, outline: "none", fontFamily: "inherit", background: C.white, color: C.text, boxSizing: "border-box" }} />
      </div>
      {img && (
        <div style={{ position: "relative", display: "inline-block", marginBottom: 10 }}>
          <img src={img} alt="preview" style={{ maxHeight: 120, borderRadius: 8, border: `1.5px solid ${C.border}` }} />
          <button onClick={() => setImg(null)} style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", fontSize: 12, fontWeight: "bold" }}>✕</button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "flex-end" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <KoreanTextarea key={"wmemo-" + inputKey} value={text} onChange={setText} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }} placeholder="릴스에서 본 팁, 상담 내용 등... (Enter로 저장, Shift+Enter 줄바꿈)" rows={3} style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 14, fontSize: 14, outline: "none", fontFamily: "inherit", background: "#FFF8FA", color: C.text, resize: "none", lineHeight: 1.6, boxSizing: "border-box" }} />
          <div>
            <button onClick={() => fileRef.current?.click()} style={{ padding: "6px 12px", borderRadius: 10, background: C.pink1, color: C.rose, border: `1px solid ${C.border}`, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📷 사진 첨부</button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) compressImage(f, setImg); e.target.value = ""; }} />
          </div>
        </div>
        <button onClick={add} style={{ padding: "10px 18px", borderRadius: 14, background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, border: "none", fontWeight: 800, fontSize: 14, cursor: "pointer", flexShrink: 0, height: 52 }}>저장</button>
      </div>
      {memos.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: C.sub, fontSize: 13 }}><div style={{ fontSize: 32, marginBottom: 8 }}>💌</div>릴스 캡처나 상담 메모를 모아봐요!</div>}
      {memos.length > 0 && shown.length === 0 && <div style={{ textAlign: "center", padding: "30px 0", color: C.sub, fontSize: 13 }}>"{search}"에 대한 검색 결과가 없어요</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map(m => <MemoCard key={m.id} m={m}
          editMemo={(id, t, image) => upd(list => list.map(x => x.id === id ? { ...x, text: t, image, updatedAt: new Date().toISOString() } : x))}
          deleteMemo={id => { if (window.confirm("이 메모를 지울까요?")) upd(list => list.filter(x => x.id !== id)); }} />)}
      </div>
    </div>
  );
}

// 💍 결혼준비 탭: 하객 · 준비할 것 · 업체 · 예산 · 메모를 위쪽 작은 탭으로 오가요
const WEDDING_TABS = [
  { key: "guests",  label: "👥 하객" },
  { key: "tasks",   label: "✅ 준비할 것" },
  { key: "vendors", label: "🏢 업체" },
  { key: "budget",  label: "💰 예산" },
  { key: "memo",    label: "🗒️ 메모" },
];
function dDayLabel(ds) {
  if (!ds) return "";
  const diff = Math.round((parseDate(ds) - parseDate(todayStr)) / 86400000);
  return diff > 0 ? `D-${diff}` : diff === 0 ? "D-DAY 💒" : `D+${-diff}`;
}
function WeddingView(props) {
  const { isMobile, wedding, setWedding } = props;
  const [sub, setSub] = useState(() => load("jjanto_wedding_tab", "guests"));
  function pick(k) { setSub(k); save("jjanto_wedding_tab", k); }
  return (
    <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "14px 14px 80px" : "20px 28px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.sub }}>💒 결혼식</span>
          <input type="date" value={wedding.date || ""} onChange={e => setWedding(p => ({ ...p, date: e.target.value }))} style={{ ...smallInp, width: 140 }} />
          {wedding.date && <span style={{ fontSize: 16, fontWeight: 900, color: C.rose }}>{dDayLabel(wedding.date)}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
          {WEDDING_TABS.map(t => (
            <button key={t.key} onClick={() => pick(t.key)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 99, border: `2px solid ${sub === t.key ? C.rose : C.border}`, background: sub === t.key ? C.rose + "14" : C.white, color: sub === t.key ? C.rose : C.sub, fontSize: 13, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>{t.label}</button>
          ))}
        </div>
        {sub === "guests"  && <GuestView {...props} />}
        {sub === "tasks"   && <TaskView {...props} />}
        {sub === "vendors" && <VendorView {...props} />}
        {sub === "budget"  && <BudgetView {...props} />}
        {sub === "memo"    && <WeddingMemoView {...props} />}
      </div>
    </div>
  );
}

export default function App() {
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);

  const [cloudCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam) { save("jjanto_cloud_code", roomParam); return roomParam; }
    return load("jjanto_cloud_code", "");
  });

  const [tab,       setTab]       = useState("week");
  const [selDate,   setSelDate]   = useState(todayStr);
  const [restDays,  setRestDays]  = useState(()=>load("jjanto_rest_days",[]));
  const [todos,     setTodos]     = useState(()=>{
    const loaded = load("jjanto_todos", {});
    return { ...loaded, weeklyTable: loaded.weeklyTable || { weeks: {} }, jjantech: loaded.jjantech || EMPTY_JJANTECH };
  });
  const [cats,      setCats]      = useState(()=>load("jjanto_cats",  CAT_DEFAULTS));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [memos,     setMemos]     =useState(()=>load("jjanto_memos",[]));
  const [memoInput, setMemoInput] =useState("");
  const [wedding,   setWedding]   =useState(()=>load("jjanto_wedding",EMPTY_WEDDING));

  const [cloudStatus,setCloudStatus]= useState(null);

  const isLocalUpdating = useRef(false);
  const stateRef = useRef({ restDays, todos, cats, memos, wedding });
  stateRef.current = { restDays, todos, cats, memos, wedding };
  const syncTimer = useRef(null);

  useEffect(() => {
    if (!cloudCode) return;
    setCloudStatus({ type: "warn", text: "☁️ 실시간 클라우드 연결 중..." });
    const unsubscribe = subscribePlannerData(cloudCode, (remoteData) => {
      if (isLocalUpdating.current) { isLocalUpdating.current = false; return; }
      if (remoteData) {
        // Firebase는 빈 배열을 저장하지 않아서, 쉼 표시를 다 지우면 restDays가 아예 안 와요. 그때는 빈 목록으로 맞춰요.
        { const rd = remoteData.restDays || []; setRestDays(rd); save("jjanto_rest_days", rd); }
        if (remoteData.todos)  { setTodos(remoteData.todos);   save("jjanto_todos", remoteData.todos); }
        if (remoteData.cats)   { setCats(remoteData.cats);     save("jjanto_cats", remoteData.cats); }
        if (remoteData.memos)  { setMemos(remoteData.memos);   save("jjanto_memos", remoteData.memos); }
        if (remoteData.wedding){ setWedding(remoteData.wedding); save("jjanto_wedding", remoteData.wedding); }
        setCloudStatus({ type: "ok", text: `☁️ 실시간 연동 중 (${new Date().toLocaleTimeString("ko-KR", { timeStyle: "short" })})` });
      } else { setCloudStatus({ type: "ok", text: "💡 새로운 방이 생성되었습니다. 입력 시 자동 저장됩니다." }); }
    }, () => setCloudStatus({ type: "err", text: "❌ 연결 끊김 (로컬 모드)" }));
    return () => unsubscribe();
  }, [cloudCode]);

  function triggerAutoSave() {
    if (!cloudCode) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setCloudStatus({ type: "warn", text: "☁️ 변경 사항 저장 중..." });
    syncTimer.current = setTimeout(async () => {
      try {
        isLocalUpdating.current = true;
        await pushPlannerData(cloudCode, { ...stateRef.current, updatedAt: new Date().toISOString() });
        setCloudStatus({ type: "ok", text: `☁️ 실시간 연동 중 (${new Date().toLocaleTimeString("ko-KR", { timeStyle: "short" })})` });
      } catch (err) {
        isLocalUpdating.current = false;
        setCloudStatus({ type: "err", text: "❌ 저장 실패! 네트워크 확인 필요" });
      }
    }, 1200);
  }

  const setTodosS   =v=>{ const n=typeof v==="function"?v(todos):v;    setTodos(n);    save("jjanto_todos",n);     triggerAutoSave(); };
  const setMemosS   =v=>{ const n=typeof v==="function"?v(memos):v;    setMemos(n);    save("jjanto_memos",n);     triggerAutoSave(); };
  // 한 번 누를 때 여러 번 고쳐도(예: 단계 추가 + 할 일 추가) 앞의 변경이 사라지지 않게 최신 값을 이어서 써요
  const weddingRef = useRef(wedding);
  weddingRef.current = wedding;
  const setWeddingS =v=>{ const n=typeof v==="function"?v(weddingRef.current):v; weddingRef.current=n; stateRef.current={...stateRef.current, wedding:n}; setWedding(n); save("jjanto_wedding",n); triggerAutoSave(); };
  const setRestDaysS=v=>{ const n=typeof v==="function"?v(restDays):v; setRestDays(n); save("jjanto_rest_days",n); triggerAutoSave(); };
  const isRestDay = ds => restDays.includes(ds);
  function toggleRestDay(ds) { setRestDaysS(p => p.includes(ds) ? p.filter(d=>d!==ds) : [...p, ds]); }

  // 예전 성장일지 데이터가 있으면(로컬이든 클라우드든) 새 주간 표 형식으로 한 번 옮겨줘요
  useEffect(() => {
    const legacy = migrateWeeklyTable(todos.weeklyTable, todayStr);
    const base = legacy || todos.weeklyTable;
    const migrated = migrateWeeklyOff(base) || legacy;
    if (migrated) setTodosS(p => ({ ...p, weeklyTable: migrated }));
  }, [todos.weeklyTable]);

  // 주간 표 행 수정 헬퍼: 해당 주(wk)의 rows만 바꾸고 다른 주 내용은 그대로 둬요
  function updateWeekRows(wk, fn) {
    setTodosS(p => {
      const table = p.weeklyTable || {};
      const weeks = table.weeks || {};
      return { ...p, weeklyTable: { weeks: { ...weeks, [wk]: { ...weeks[wk], v: 2, rows: fn(getEffectiveWeekRows(table, wk)) } } } };
    });
  }
  // 그 주에 들어온 추가 수입(초과수당·보너스·월급 등) 건수를 늘리고 줄여요. 한 건마다 주간 뽑기가 1장 늘어요.
  function changeWeekIncome(wk, delta) {
    setTodosS(p => {
      const table = p.weeklyTable || {};
      const weeks = table.weeks || {};
      const week = weeks[wk] || {};
      return { ...p, weeklyTable: { weeks: { ...weeks, [wk]: { ...week, v: 2, rows: getEffectiveWeekRows(table, wk), income: Math.max(0, incomeCount(week) + delta) } } } };
    });
  }
  function addWeeklyRow(wk) {
    updateWeekRows(wk, rows => {
      const color = WEEKLY_ROW_COLORS[rows.length % WEEKLY_ROW_COLORS.length];
      return [...rows, { id: genId(), label: "새 항목", color, cells: emptyWeeklyCells(), checks: {}, off: {} }];
    });
  }
  function updateWeeklyLabel(wk, rowId, label) {
    updateWeekRows(wk, rows => rows.map(r => r.id === rowId ? { ...r, label } : r));
  }
  function updateWeeklyCell(wk, rowId, day, text) {
    updateWeekRows(wk, rows => rows.map(r => r.id === rowId ? { ...r, cells: { ...emptyWeeklyCells(), ...r.cells, [day]: text } } : r));
  }
  function toggleWeeklyCheck(wk, rowId, day) {
    updateWeekRows(wk, rows => rows.map(r => r.id === rowId ? { ...r, checks: { ...r.checks, [day]: !(r.checks && r.checks[day]) } } : r));
  }
  function toggleWeeklyOff(wk, rowId, day) {
    updateWeekRows(wk, rows => rows.map(r => r.id === rowId ? { ...r, off: { ...r.off, [day]: !(r.off && r.off[day]) } } : r));
  }
  function removeWeeklyRow(wk, rowId) {
    updateWeekRows(wk, rows => rows.filter(r => r.id !== rowId));
  }
  // 주간표만 처음 상태로 돌려요. 쉼 표시도 주간표에서만 쓰니까 같이 비우고, 짠테크·결혼준비·메모는 그대로 둬요.
  function resetWeeklyTable() {
    setTodosS(p => ({ ...p, weeklyTable: { weeks: {} } }));
    setRestDaysS([]);
  }

  // 짠테크 체크리스트
  const jj = todos.jjantech || EMPTY_JJANTECH;
  function updateJjantech(fn) {
    setTodosS(p => ({ ...p, jjantech: fn(p.jjantech || EMPTY_JJANTECH) }));
  }
  function toggleJjantech(ds, itemId) {
    updateJjantech(j => {
      const day = { ...((j.log || {})[ds] || {}) };
      if (day[itemId]) delete day[itemId]; else day[itemId] = true;
      return { ...j, log: { ...(j.log || {}), [ds]: day } };
    });
  }
  function addJjantechItems(titles) {
    updateJjantech(j => ({ ...j, items: [...(j.items || []), ...titles.map(title => ({ id: genId(), title }))] }));
  }
  // 예전 분류별 할일(보관함)에서 제목만 가져와 짠테크 항목으로 넣어요. 같은 이름은 한 번만 들어가요.
  const importSources = cats
    .map(cat => ({ cat, count: (Array.isArray(todos[cat.id]) ? todos[cat.id] : []).filter(t => !t.archived && (t.title || "").trim()).length }))
    .filter(x => x.count > 0)
    .sort((a, b) => (b.cat.name.includes("짠테크") ? 1 : 0) - (a.cat.name.includes("짠테크") ? 1 : 0));
  function importFromCat(catId) {
    const titles = (todos[catId] || []).filter(t => !t.archived).map(t => (t.title || "").trim()).filter(Boolean);
    updateJjantech(j => {
      const have = new Set((j.items || []).map(it => it.title.trim()));
      const fresh = [...new Set(titles)].filter(t => !have.has(t));
      return { ...j, items: [...(j.items || []), ...fresh.map(title => ({ id: genId(), title }))] };
    });
  }
  function clearJjantechItems() {
    updateJjantech(j => ({ ...j, items: [] }));
  }
  function renameJjantechItem(id, title) {
    updateJjantech(j => ({ ...j, items: (j.items || []).map(it => it.id === id ? { ...it, title } : it) }));
  }
  function removeJjantechItem(id) {
    updateJjantech(j => ({ ...j, items: (j.items || []).filter(it => it.id !== id) }));
  }
  function moveJjantechItem(id, dir) {
    updateJjantech(j => {
      const items = [...(j.items || [])];
      const i = items.findIndex(it => it.id === id), k = i + dir;
      if (i < 0 || k < 0 || k >= items.length) return j;
      [items[i], items[k]] = [items[k], items[i]];
      return { ...j, items };
    });
  }
  function openJjantech(ds) { setSelDate(ds); setTab("jjantech"); }

  // 예전 하객 표(하객마다 청모 날짜·식당·1인금액)를 청모 목록으로 한 번 옮겨줘요
  useEffect(() => {
    const migrated = migrateMeetings(wedding);
    if (migrated) setWeddingS(migrated);
  }, [wedding]);

  // 하객 관리: Firebase는 빈 배열을 저장하지 않아서 없는 쪽은 빈 목록으로 채워 읽어요
  function updateGuests(side, fn) {
    setWeddingS(p => {
      const guests = { groom: [], bride: [], ...((p && p.guests) || {}) };
      return { ...p, guests: { ...guests, [side]: fn(guests[side] || []) } };
    });
  }
  function addGuest(side) {
    updateGuests(side, list => [...list, { id: genId(), name: "", type: "", meetingId: "", attend: "", meal: "", gift: "", memo: "" }]);
  }
  function updateGuest(side, id, key, value) {
    updateGuests(side, list => list.map(g => g.id === id ? { ...g, [key]: value } : g));
  }
  function removeGuest(side, id) {
    updateGuests(side, list => list.filter(g => g.id !== id));
  }
  // 정렬은 저장된 순서 자체를 바꿔요. 그래서 고치는 도중에 줄이 갑자기 움직이지 않아요. 빈칸은 항상 맨 아래로 가요.
  function sortGuests(side, key, dir) {
    const col = GUEST_COLS.find(c => c.key === key);
    // 청모는 모임 날짜(없으면 맨 뒤)와 식당 순으로 정렬해요
    const meetings = asList(weddingRef.current && weddingRef.current.meetings);
    const meetOf = g => meetings.find(m => m.id === g.meetingId);
    const val = g => col && col.num ? toWon(g[key]) : col && col.meeting ? `${(meetOf(g) || {}).date || "9999"}|${(meetOf(g) || {}).place || ""}` : (g[key] || "");
    const empty = g => col && col.meeting ? !meetOf(g) : !(g[key] || "").toString().trim();
    updateGuests(side, list => [...list].sort((a, b) => {
      if (empty(a) || empty(b)) return empty(a) - empty(b);
      const x = val(a), y = val(b);
      return (typeof x === "number" ? x - y : String(x).localeCompare(String(y), "ko")) * dir;
    }));
  }

  function addMemo(imgData = null) { if(!memoInput.trim() && !imgData) return; setMemosS(p=>[{id:genId(), text:memoInput.trim(), image:imgData, createdAt:new Date().toISOString()}, ...p]); setMemoInput(""); }
  function editMemo(id, text, imgData) { setMemosS(p=>p.map(m=>m.id===id?{...m,text,image:imgData,updatedAt:new Date().toISOString()}:m)); }
  function deleteMemo(id) { setMemosS(p=>p.filter(m=>m.id!==id)); }

  const wk = getMonday(selDate);
  const stats = computeWeekStats(todos.weeklyTable, jj, wk, isRestDay);

  const cloudBadge = (
    <div title={cloudStatus?.text} style={{display:"flex",alignItems:"center",gap:6,background:cloudCode?"#E8F5E9":"#FFF0F0",border:cloudCode?"1.5px solid #A5D6A7":"1.5px solid #FFB3B3",borderRadius:10,padding:"5px 10px",color:cloudCode?"#2E7D32":"#C62828",fontWeight:800,fontSize:11,flexShrink:0}}>
      {cloudCode?"☁️ 연동중":"⚠️ 로컬"}
    </div>
  );

  const TABS = [
    {tab:"week",    icon:"📊",  label:"주간표"},
    {tab:"jjantech",icon:"📱",  label:"짠테크"},
    {tab:"wedding", icon:"💍",  label:"결혼준비"},
    {tab:"memo",    icon:"🗒️", label:"메모"},
    {tab:"archive", icon:"📦",  label:"보관함"},
  ];

  const content = (
    <>
      {tab==="week"&&(
        <div style={{flex:1,overflow:"auto",padding:isMobile?"14px 14px 80px":"20px 28px"}}>
          <WeeklyBoard isMobile={isMobile} selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} stats={stats} toggleRestDay={toggleRestDay} addWeeklyRow={addWeeklyRow} updateWeeklyLabel={updateWeeklyLabel} updateWeeklyCell={updateWeeklyCell} toggleWeeklyCheck={toggleWeeklyCheck} toggleWeeklyOff={toggleWeeklyOff} removeWeeklyRow={removeWeeklyRow} resetWeeklyTable={resetWeeklyTable} changeWeekIncome={changeWeekIncome} openJjantech={openJjantech} openSummary={()=>setSummaryOpen(true)} />
        </div>
      )}
      {tab==="jjantech"&&<JjantechView isMobile={isMobile} selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} jj={jj} importSources={importSources} importFromCat={importFromCat} clearJjantechItems={clearJjantechItems} toggleJjantech={toggleJjantech} addJjantechItems={addJjantechItems} renameJjantechItem={renameJjantechItem} removeJjantechItem={removeJjantechItem} moveJjantechItem={moveJjantechItem}/>}
      {tab==="memo"&&<MemoView isMobile={isMobile} memos={memos} memoInput={memoInput} setMemoInput={setMemoInput} addMemo={addMemo} editMemo={editMemo} deleteMemo={deleteMemo}/>}
      {tab==="wedding"&&<WeddingView isMobile={isMobile} wedding={wedding||EMPTY_WEDDING} setWedding={setWeddingS} addGuest={addGuest} updateGuest={updateGuest} removeGuest={removeGuest} sortGuests={sortGuests}/>}
      {tab==="archive"&&<ArchiveView isMobile={isMobile} todos={todos} cats={cats} setTodosS={setTodosS}/>}
    </>
  );

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Nunito','Apple SD Gothic Neo',sans-serif",background:C.bg,color:C.text,overflow:"hidden",flexDirection:"column"}}>
      <style>{`
        @keyframes tomato-bounce {
          from { transform: translateY(0px) rotate(-5deg); }
          to   { transform: translateY(-4px) rotate(5deg); }
        }
      `}</style>
      {!isMobile&&(
        <div style={{display:"flex",flex:1,flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderBottom:`1.5px solid ${C.border}`,background:C.white,flexWrap:"wrap"}}>
            <span style={{fontSize:16,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</span>
            {cloudBadge}
            <div style={{flex:1}}/>
            {TABS.map(({tab:v,icon,label})=>(
              <button key={v} onClick={()=>setTab(v)} style={{padding:"6px 14px",borderRadius:20,border:`2px solid ${tab===v?C.rose:C.border}`,background:tab===v?C.rose:C.white,color:tab===v?C.white:C.sub,fontSize:12,cursor:"pointer",fontWeight:700}}>{icon} {label}</button>
            ))}
          </div>
          {content}
        </div>
      )}

      {isMobile&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:C.white,borderBottom:`1.5px solid ${C.border}`,flexShrink:0,gap:8}}>
            <span style={{fontSize:15,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</span>
            {cloudBadge}
          </div>
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {content}
          </div>
          <div style={{display:"flex",background:C.white,borderTop:`1.5px solid ${C.border}`,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom)"}}>
            {TABS.map(({tab:v,icon,label})=>(
              <button key={v} onClick={()=>setTab(v)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"7px 0",border:"none",background:"transparent",cursor:"pointer",color:tab===v?C.rose:C.sub,gap:1}}>
                <span style={{fontSize:18}}>{icon}</span>
                <span style={{fontSize:9,fontWeight:tab===v?800:500}}>{label}</span>
                {tab===v&&<div style={{width:16,height:3,borderRadius:99,background:C.rose,marginTop:1}}/>}
              </button>
            ))}
          </div>
        </div>
      )}

      {summaryOpen&&<SummaryCardModal isMobile={isMobile} stats={stats} wk={wk} onClose={()=>setSummaryOpen(false)}/>}
    </div>
  );
}
