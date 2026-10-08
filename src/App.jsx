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
];
// 주간 표와 달성률은 평일(월~금)만 봐요. 주말은 밀린 걸 채우는 보충데이라 계산에서 빠져요.
const WEEKLY_ROW_COLORS = ["#FF85A1","#FFB347","#7EC8A4","#B39DDB","#64B5F6","#F06292","#4DB6AC","#9575CD"];
function emptyWeeklyCells() { return { mon:"", tue:"", wed:"", thu:"", fri:"", sat:"", sun:"" }; }
const EMPTY_JJANTECH = { items: [], log: {} };

// 주간 표는 weeklyTable.weeks[월요일 날짜] = { v:2, rows } 형태로 주마다 따로 저장돼요.
// 행(row)은 { id, label, color, checks:{mon:true...}, off:{tue:true...} } 이고, off인 칸은 "이 날은 안 함"이라 달성률에서 빠져요.
function getWeekRows(table, wk) {
  const week = table && table.weeks && table.weeks[wk];
  return (week && Array.isArray(week.rows)) ? week.rows : [];
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
  const mon = parseDate(wk), fri = parseDate(addDays(wk, 4));
  return `${mon.getMonth()+1}/${mon.getDate()} ~ ${fri.getMonth()+1}/${fri.getDate()}`;
}

// 짠테크 항목은 추가한 날(since)부터 세요. 그래야 짠테크를 만들기 전 주의 달성률이 바뀌지 않아요.
function jjItemsOn(jj, ds) { return ((jj && jj.items) || []).filter(it => !it.since || it.since <= ds); }

// 한 주(월~금)의 일간·주간 달성률을 계산해요.
// 표의 각 칸 + 짠테크 한 줄(그날 체크리스트를 전부 끝내야 완료)로 세고, 🌿쉼으로 표시한 날은 빼요.
function computeWeekStats(table, jj, wk, isRestDay) {
  const rows = getWeekRows(table, wk);
  const days = weekdayDates(wk).map(d => {
    const rest = isRestDay(d.ds);
    const jjItems = jjItemsOn(jj, d.ds);
    const dayLog = (jj && jj.log && jj.log[d.ds]) || {};
    const jjDone = jjItems.filter(it => dayLog[it.id]).length;
    let total = 0, done = 0;
    if (!rest) {
      rows.forEach(r => {
        if (r.off && r.off[d.key]) return;
        total++;
        if (r.checks && r.checks[d.key]) done++;
      });
      if (jjItems.length) { total++; if (jjDone === jjItems.length) done++; }
    }
    return { ...d, rest, total, done, pct: total ? Math.round(done / total * 100) : null, jjDone, jjTotal: jjItems.length };
  });
  const total = days.reduce((s, d) => s + d.total, 0);
  const done = days.reduce((s, d) => s + d.done, 0);
  const workDays = days.filter(d => !d.rest);
  return {
    rows, days, total, done,
    pct: total ? Math.round(done / total * 100) : null,
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

function KoreanInput({ value, onChange, style, placeholder, autoFocus, type="text" }) {
  const composing = useRef(false);
  return <input type={type} defaultValue={value} placeholder={placeholder} autoFocus={autoFocus} style={style} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={(e)=>{composing.current=false;onChange(e.target.value);}} onChange={(e)=>{if(!composing.current)onChange(e.target.value);}}/>;
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
function tomatoCount(pct) { return pct === null ? 0 : pct === 100 ? 3 : pct >= 70 ? 2 : 1; }
const navBtn = {background:C.pink1,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.rose,fontWeight:800,fontSize:14};

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

// 주간 표: 행 = 매일 하는 항목, 열 = 월~금. 맨 아래에 일간 달성률, 위에 주간 달성률이 같이 보여요.
// 짠테크는 항목이 많아서 표에는 "짠테크" 한 줄로만 들어가고, 그날 체크리스트를 다 끝내면 완료로 쳐요.
function WeeklyBoard({ selDate, setSelDate, todayStr, stats, prevWeekKey, toggleRestDay, addWeeklyRow, updateWeeklyLabel, toggleWeeklyCheck, toggleWeeklyOff, removeWeeklyRow, copyWeekFrom, openJjantech, openSummary }) {
  const [editMode, setEditMode] = useState(false);
  const captureRef = useRef(null);
  const wk = getMonday(selDate);
  const { rows, days } = stats;
  const hasJj = days.some(d => d.jjTotal > 0);
  const range = weekRangeLabel(wk);
  const isThisWeek = wk === getMonday(todayStr);
  const tc = tomatoCount(stats.pct);
  const cols = WEEK_DAYS.length + 1 + (editMode ? 1 : 0);

  function handleSaveTable() {
    const fname = `짠토의_주간표_${range.replace(/\s/g, "")}.png`;
    if (editMode) { setEditMode(false); setTimeout(() => saveNodeAsImage(captureRef.current, fname), 80); }
    else saveNodeAsImage(captureRef.current, fname);
  }

  const labelTd = { position: "sticky", left: 0, zIndex: 1, background: C.white, padding: "8px 6px 8px 2px", borderBottom: `1px dashed ${C.border}`, maxWidth: 110 };
  const cellTd = d => ({ padding: "8px 2px", borderBottom: `1px dashed ${C.border}`, textAlign: "center", verticalAlign: "middle", background: d.ds === todayStr ? C.rose + "0D" : "transparent", opacity: d.rest ? .35 : 1 });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setSelDate(addDays(wk, -7))} style={navBtn}>‹</button>
        <span style={{ fontSize: 15, fontWeight: 800, color: C.rose, flex: 1, textAlign: "center" }}>{range}</span>
        <button onClick={() => setSelDate(addDays(wk, 7))} style={navBtn}>›</button>
        {!isThisWeek && <button onClick={() => setSelDate(todayStr)} style={{ ...navBtn, background: C.pink2, color: C.white, fontSize: 12 }}>이번 주</button>}
        <button onClick={() => setEditMode(p => !p)} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 13, background: editMode ? C.green : C.rose }}>
          {editMode ? "완료" : "편집"}
        </button>
      </div>

      <div ref={captureRef} style={{ background: C.white, borderRadius: 16, padding: 14, border: `1.5px solid ${C.border}`, boxShadow: `0 2px 10px ${C.pink1}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg,#FFF3F1,#FFE2D8)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
          <Ring pct={stats.pct || 0} size={60} stroke={7} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 15, fontWeight: 900, color: C.rose }}>🍅 주간 달성률{tc > 0 && <TomatoRow count={tc} />}</div>
            <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginTop: 3 }}>
              {stats.total ? `${stats.done}/${stats.total}칸 완료 · ${range} (월~금)` : "아직 체크할 칸이 없어요"}
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
                    <th key={d.key} onClick={editMode ? () => toggleRestDay(d.ds) : undefined} style={{ minWidth: 44, padding: "4px 2px 6px", borderBottom: `1.5px solid ${C.border}`, cursor: editMode ? "pointer" : "default", background: isToday ? C.rose + "0D" : "transparent" }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: isToday ? C.rose : C.text }}>{d.label}</div>
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
                        <KoreanInput key={"rowlabel-" + wk + "-" + row.id} value={row.label} onChange={v => updateWeeklyLabel(wk, row.id, v)} style={{ width: 76, border: "none", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text, outline: "none", background: "transparent", padding: "2px 0", fontFamily: "inherit" }} />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</span>
                      )}
                    </div>
                  </td>
                  {days.map(d => {
                    const off = !!(row.off && row.off[d.key]);
                    const checked = !!(row.checks && row.checks[d.key]);
                    return (
                      <td key={d.key} style={cellTd(d)}>
                        <div style={{ display: "flex", justifyContent: "center" }}>
                          {editMode ? (
                            <button onClick={() => toggleWeeklyOff(wk, row.id, d.key)} style={{ width: 26, height: 22, borderRadius: 7, border: `1.5px dashed ${off ? C.border : C.pink2}`, background: off ? "#F5EEEC" : C.white, color: off ? C.sub : C.pink3, fontWeight: 900, fontSize: 12, cursor: "pointer", padding: 0 }}>{off ? "—" : "○"}</button>
                          ) : off ? (
                            <span style={{ color: C.pink2, fontWeight: 900, fontSize: 13 }}>—</span>
                          ) : (
                            <WeeklyCheckbox checked={checked} onToggle={() => toggleWeeklyCheck(wk, row.id, d.key)} />
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

      {rows.length === 0 && prevWeekKey && (
        <button onClick={() => copyWeekFrom(prevWeekKey, wk)} style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10, border: `1.5px solid ${C.rose}`, background: C.white, color: C.rose, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📋 지난주 항목 그대로 가져오기</button>
      )}

      {editMode && (
        <>
          <button onClick={() => addWeeklyRow(wk)} style={{ marginTop: 10, width: "100%", padding: "9px 0", borderRadius: 10, border: `1.5px dashed ${C.rose}`, background: "transparent", color: C.rose, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>＋ 항목 추가</button>
          <div style={{ marginTop: 8, fontSize: 11, color: C.sub, lineHeight: 1.7, background: C.pink1, borderRadius: 10, padding: "8px 12px" }}>
            💡 칸(○)을 누르면 <b>—</b>로 바뀌어요. — 칸은 "그날은 안 하는 날"이라 달성률에서 빠져요.<br />
            🌿 요일 이름을 누르면 그날 전체가 쉼(공휴일 등)으로 빠져요.<br />
            📱 짠테크 줄은 짠테크 탭에 항목을 넣으면 자동으로 생겨요.
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={handleSaveTable} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.rose}`, background: C.white, color: C.rose, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📸 표 이미지 저장</button>
        <button onClick={openSummary} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>🎬 영상용 요약 카드</button>
      </div>
    </div>
  );
}

// 영상에 넣을 한 장짜리 카드: 항목 이름 없이 주간 달성률과 요일별 일간 달성률만 보여줘요
function SummaryCardModal({ isMobile, stats, wk, onClose }) {
  const ref = useRef(null);
  const range = weekRangeLabel(wk);
  const tc = tomatoCount(stats.pct);
  const msg = stats.pct === null ? "🍅 이번 주도 화이팅!" : stats.pct === 100 ? "🎉 이번 주 올클리어!" : stats.pct >= 70 ? "🌸 이번 주도 잘 해냈다!" : "🍅 다음 주엔 조금 더 힘내보자!";
  return (
    <ModalWrap onClose={onClose} zIndex={300} isMobile={isMobile}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.rose, marginBottom: 14, textAlign: "center" }}>🎬 영상용 요약 카드</div>
      <div ref={ref} style={{ background: "linear-gradient(160deg,#FFF3F1,#FFE2D8)", borderRadius: 20, padding: "22px 20px", border: `2px solid ${C.border}`, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", fontSize: 18, fontWeight: 900, color: C.rose }}>짠토의 성장일지{tc > 0 && <TomatoRow count={tc} />}</div>
            <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginTop: 3 }}>{range} · 월~금</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Ring pct={stats.pct || 0} size={78} stroke={8} />
            <div style={{ fontSize: 10, color: C.sub, fontWeight: 800, marginTop: 4 }}>주간 달성률</div>
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.sub, marginBottom: 8 }}>일간 달성률</div>
        {stats.days.map(d => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
            <span style={{ width: 18, fontSize: 14, fontWeight: 900, color: C.text }}>{d.label}</span>
            {d.rest ? (
              <span style={{ flex: 1, fontSize: 12, color: C.sub, fontWeight: 700 }}>🌿 쉬는 날</span>
            ) : (
              <div style={{ flex: 1, height: 14, borderRadius: 99, background: "rgba(255,255,255,.85)", overflow: "hidden" }}>
                <div style={{ width: `${d.pct || 0}%`, height: "100%", borderRadius: 99, background: d.pct === 100 ? C.green : `linear-gradient(90deg,${C.pink3},${C.rose})` }} />
              </div>
            )}
            <span style={{ width: 42, textAlign: "right", fontSize: 14, fontWeight: 900, color: d.pct === 100 ? "#4CAF84" : C.rose }}>{d.rest ? "" : d.pct === null ? "—" : d.pct + "%"}</span>
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
function JjantechView({ isMobile, selDate, setSelDate, todayStr, jj, toggleJjantech, addJjantechItems, renameJjantechItem, removeJjantechItem, moveJjantechItem }) {
  const [editMode, setEditMode] = useState(false);
  const [hideDone, setHideDone] = useState(false);
  const [bulk, setBulk] = useState("");
  const [bulkKey, setBulkKey] = useState(0);
  // 편집할 땐 모든 항목을, 체크할 땐 그날 이미 있던 항목만 보여줘요
  const items = editMode ? (jj.items || []) : jjItemsOn(jj, selDate);
  const log = (jj.log && jj.log[selDate]) || {};
  const done = items.filter(it => log[it.id]).length;
  const pct = items.length ? Math.round(done / items.length * 100) : 0;
  const dow = parseDate(selDate).getDay();
  const weekend = dow === 0 || dow === 6;
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
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
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
              {items.length ? `${done}/${items.length}개 완료${done === items.length ? " · 완주! 🎉" : ""}` : (jj.items || []).length ? "이 날엔 아직 짠테크 항목이 없었어요" : "편집을 눌러 짠테크 항목을 넣어봐요"}
            </div>
            {weekend && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>🌿 주말은 보충데이라 달성률에 안 들어가요</div>}
          </div>
          {!editMode && items.length > 0 && (
            <button onClick={() => setHideDone(p => !p)} style={{ padding: "5px 10px", borderRadius: 99, border: `1.5px solid ${hideDone ? C.rose : C.border}`, background: hideDone ? C.rose + "18" : C.white, color: hideDone ? C.rose : C.sub, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>{hideDone ? `완료 숨김(${done})` : "완료 숨기기"}</button>
          )}
        </div>

        {!editMode && hideDone && items.length > 0 && visible.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: C.sub, fontWeight: 700 }}>🎉 오늘 짠테크 모두 끝!</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isMobile || editMode ? "1fr" : "1fr 1fr", gap: 6 }}>
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
        if (remoteData.restDays){ setRestDays(remoteData.restDays); save("jjanto_rest_days", remoteData.restDays); }
        if (remoteData.todos)  { setTodos(remoteData.todos);   save("jjanto_todos", remoteData.todos); }
        if (remoteData.cats)   { setCats(remoteData.cats);     save("jjanto_cats", remoteData.cats); }
        if (remoteData.memos)  { setMemos(remoteData.memos);   save("jjanto_memos", remoteData.memos); }
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
      return { ...p, weeklyTable: { weeks: { ...(table.weeks || {}), [wk]: { v: 2, rows: fn(getWeekRows(table, wk)) } } } };
    });
  }
  function addWeeklyRow(wk) {
    updateWeekRows(wk, rows => {
      const color = WEEKLY_ROW_COLORS[rows.length % WEEKLY_ROW_COLORS.length];
      return [...rows, { id: genId(), label: "새 항목", color, checks: {}, off: {} }];
    });
  }
  function updateWeeklyLabel(wk, rowId, label) {
    updateWeekRows(wk, rows => rows.map(r => r.id === rowId ? { ...r, label } : r));
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
  // 지난주 항목(이름·색·안 하는 날)을 이번 주로 가져와요. 체크는 비운 채로 시작해요.
  function copyWeekFrom(fromWk, toWk) {
    const src = getWeekRows(todos.weeklyTable, fromWk);
    updateWeekRows(toWk, () => src.map(r => ({ id: genId(), label: r.label, color: r.color, checks: {}, off: { ...(r.off || {}) } })));
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
    updateJjantech(j => ({ ...j, items: [...(j.items || []), ...titles.map(title => ({ id: genId(), title, since: todayStr }))] }));
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
  const prevWeekKey = findPrevWeekKey(todos.weeklyTable, wk);

  const cloudBadge = (
    <div title={cloudStatus?.text} style={{display:"flex",alignItems:"center",gap:6,background:cloudCode?"#E8F5E9":"#FFF0F0",border:cloudCode?"1.5px solid #A5D6A7":"1.5px solid #FFB3B3",borderRadius:10,padding:"5px 10px",color:cloudCode?"#2E7D32":"#C62828",fontWeight:800,fontSize:11,flexShrink:0}}>
      {cloudCode?"☁️ 연동중":"⚠️ 로컬"}
    </div>
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
          <WeeklyBoard selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} stats={stats} prevWeekKey={prevWeekKey} toggleRestDay={toggleRestDay} addWeeklyRow={addWeeklyRow} updateWeeklyLabel={updateWeeklyLabel} toggleWeeklyCheck={toggleWeeklyCheck} toggleWeeklyOff={toggleWeeklyOff} removeWeeklyRow={removeWeeklyRow} copyWeekFrom={copyWeekFrom} openJjantech={openJjantech} openSummary={()=>setSummaryOpen(true)} />
        </div>
      )}
      {tab==="jjantech"&&<JjantechView isMobile={isMobile} selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} jj={jj} toggleJjantech={toggleJjantech} addJjantechItems={addJjantechItems} renameJjantechItem={renameJjantechItem} removeJjantechItem={removeJjantechItem} moveJjantechItem={moveJjantechItem}/>}
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
