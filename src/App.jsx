import { useState, useRef, useEffect } from "react";
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
            <span style={{ color: C.sub }}>짠테크·메모·보관함은 그대로 남아요.</span>
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

export default function App() {
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  useEffect(()=>{
    const h=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);

  const [cloudCode, setCloudCode] = useState(() => {
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
  // 💍 결혼준비는 짠포마토의 기록으로 옮겨서 이 기기에 남은 예전 데이터도 지워요. 클라우드 쪽은 다음 저장 때 같이 빠져요.
  useEffect(()=>{ try{ localStorage.removeItem("jjanto_wedding"); localStorage.removeItem("jjanto_wedding_tab"); }catch{} },[]);

  const [cloudStatus,setCloudStatus]= useState(null);

  const isLocalUpdating = useRef(false);
  const stateRef = useRef({ restDays, todos, cats, memos });
  stateRef.current = { restDays, todos, cats, memos };
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
        setCloudStatus({ type: "ok", text: `☁️ 실시간 연동 중 (${new Date().toLocaleTimeString("ko-KR", { timeStyle: "short" })})` });
      } else { setCloudStatus({ type: "ok", text: "💡 새로운 방이 생성되었습니다. 입력 시 자동 저장됩니다." }); }
    }, () => setCloudStatus({ type: "err", text: "❌ 연결 끊김 (로컬 모드)" }));
    return () => unsubscribe();
  }, [cloudCode]);

  // 🔑 배지를 누르면 방 코드를 직접 입력해요. 회사 컴퓨터처럼 처음 쓰는 브라우저에서도 주소에 ?room= 안 붙여도 돼요.
  function changeCloudCode() {
    const input = window.prompt("동기화 코드(방 번호)를 입력해요.\n다른 기기와 같은 코드를 넣으면 같은 데이터를 봐요.\n비우고 확인을 누르면 연동을 끊어요.", cloudCode);
    if (input === null) return;
    const next = input.trim();
    if (next === cloudCode) return;
    if (!next && !window.confirm("연동을 끊고 이 기기에서만 쓸까요?")) return;
    save("jjanto_cloud_code", next);
    // 주소에 예전 ?room=이 남아 있으면 새로고침할 때 다시 그 방으로 돌아가니까 지워요
    const url = new URL(window.location.href);
    if (url.searchParams.has("room")) { url.searchParams.delete("room"); window.history.replaceState(null, "", url); }
    setCloudStatus(null);
    setCloudCode(next);
  }

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
  // 주간표만 처음 상태로 돌려요. 쉼 표시도 주간표에서만 쓰니까 같이 비우고, 짠테크·메모는 그대로 둬요.
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

  function addMemo(imgData = null) { if(!memoInput.trim() && !imgData) return; setMemosS(p=>[{id:genId(), text:memoInput.trim(), image:imgData, createdAt:new Date().toISOString()}, ...p]); setMemoInput(""); }
  function editMemo(id, text, imgData) { setMemosS(p=>p.map(m=>m.id===id?{...m,text,image:imgData,updatedAt:new Date().toISOString()}:m)); }
  function deleteMemo(id) { setMemosS(p=>p.filter(m=>m.id!==id)); }

  const wk = getMonday(selDate);
  const stats = computeWeekStats(todos.weeklyTable, jj, wk, isRestDay);

  const cloudBadge = (
    <button onClick={changeCloudCode} title={(cloudStatus?.text ? cloudStatus.text + " · " : "") + "눌러서 동기화 코드 입력"} style={{display:"flex",alignItems:"center",gap:6,background:cloudCode?"#E8F5E9":"#FFF0F0",border:cloudCode?"1.5px solid #A5D6A7":"1.5px solid #FFB3B3",borderRadius:10,padding:"5px 10px",color:cloudCode?"#2E7D32":"#C62828",fontWeight:800,fontSize:11,flexShrink:0,cursor:"pointer",fontFamily:"inherit"}}>
      {cloudCode?"☁️ 연동중":"⚠️ 로컬 · 코드 입력"}
    </button>
  );

  const TABS = [
    {tab:"week",    icon:"📊",  label:"주간표"},
    {tab:"jjantech",icon:"📱",  label:"짠테크"},
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
