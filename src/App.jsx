import { useState, useRef, useEffect } from "react";
import { pushPlannerData, pullPlannerData, subscribePlannerData } from "./firebase";

const C = {
  bg:"#FFF8F6", pink1:"#FFE0D6", pink2:"#FFBCAA", pink3:"#FF7A5C",
  rose:"#E8392A", tomato:"#C0392B", text:"#2D1A14", sub:"#9A6A5A",
  border:"#FFCFC4", white:"#FFFFFF",
};

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
  { key:"thu", label:"목" }, { key:"fri", label:"금" }, { key:"sat", label:"토" }, { key:"sun", label:"일" },
];
const WEEKLY_ROW_COLORS = ["#FF85A1","#FFB347","#7EC8A4","#B39DDB","#64B5F6","#F06292","#4DB6AC","#9575CD"];
function emptyWeeklyCells() { return { mon:"", tue:"", wed:"", thu:"", fri:"", sat:"", sun:"" }; }

function genId()     { return Math.random().toString(36).slice(2,9); }
function fmtDate(d)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function isSame(a,b) { return fmtDate(new Date(a))===fmtDate(new Date(b)); }

function getMonday(ds) {
  const d = new Date(ds);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return fmtDate(mon);
}

// selDate가 속한 주(월~일 7일)의 정보를 만들어요
function getCurrentWeek(ds) {
  const mon = new Date(ds);
  const day = mon.getDay();
  mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d2 = new Date(mon);
    d2.setDate(mon.getDate() + i);
    days.push(fmtDate(d2));
  }
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return {
    monStr: fmtDate(mon),
    label: `${mon.getMonth()+1}/${mon.getDate()}(월) ~ ${sun.getMonth()+1}/${sun.getDate()}(일)`,
    days
  };
}

function getWeekRange(ds) {
  const d = new Date(ds);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} ~ ${sun.getMonth() + 1}/${sun.getDate()}`;
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

const today    = new Date();
const todayStr = fmtDate(today);

const INIT_TODOS = {
  work:    [{id:genId(),title:"기획서 초안 작성",    date:todayStr,done:false},{id:genId(),title:"팀 미팅 준비",    date:todayStr,done:true}],
  economy: [{id:genId(),title:"주식 포트폴리오 확인",date:todayStr,done:false},{id:genId(),title:"월 가계부 정리",  date:todayStr,done:false}],
  fitness: [{id:genId(),title:"30분 조깅",          date:todayStr,done:true}, {id:genId(),title:"스트레칭 10분",   date:todayStr,done:false}],
  personal:[{id:genId(),title:"일기 쓰기",            date:todayStr,done:false},{id:genId(),title:"비타민 챙겨먹기",date:todayStr,done:true}],
  apptech: [{id:genId(),title:"캐시워크 걷기",        date:todayStr,done:true}, {id:genId(),title:"토스 행운복권",  date:todayStr,done:false}],
  event:   [{id:genId(),title:"쿠팡 할인쿠폰 확인",  date:todayStr,done:false}],
  weekly:  [{id:genId(),title:"일주일 4번 조깅하기", targetCount:4, doneLog:{}}, {id:genId(),title:"밀린 인강 1개 듣기", targetCount:1, doneLog:{}}],
};

function load(key,fb){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function save(key,v){ try{ localStorage.setItem(key,JSON.stringify(v)); }catch{} }

function isRoutine(item) { return !item.date; }
function routineAppliesOn(item, ds) {
  if (item.startDate && ds < item.startDate) return false;
  if (item.endDate && ds > item.endDate) return false;
  const type = item.repeatType || "daily";
  if (type === "daily") return true;
  if (type === "weekly") { return Array.isArray(item.weekDays) && item.weekDays.includes(new Date(ds).getDay()); }
  if (type === "monthly") { return item.monthDay === new Date(ds).getDate(); }
  if (type === "alternate") {
    if (!item.startDate) return false;
    const diffDays = Math.round((new Date(ds) - new Date(item.startDate)) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 2 === 0;
  }
  return true;
}
function itemAppliesOn(item, ds) { return item.date ? isSame(item.date, ds) : routineAppliesOn(item, ds); }

function repeatLabel(item) {
  if (!isRoutine(item)) return null;
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
  if (item.endDate) return "🗓️";
  const type = item.repeatType || "daily";
  if (type === "alternate") return "⚡";
  if (type === "weekly") return "📅";
  if (type === "monthly") return "🗓️";
  return "🔁";
}

function cleanTodoItem(t, type) {
  const n = { ...t };
  if (type === "single") { delete n.startDate; delete n.endDate; delete n.repeatType; delete n.weekDays; delete n.monthDay; delete n.doneLog; }
  else if (type === "period") { delete n.date; delete n.done; delete n.weekDays; delete n.monthDay; n.repeatType = "daily"; }
  else { delete n.date; delete n.done; delete n.endDate; if (n.repeatType !== "weekly") delete n.weekDays; if (n.repeatType !== "monthly") delete n.monthDay; }
  return n;
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
  return <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.38)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex}} onClick={onClose}><div style={{background:C.white,borderRadius:isMobile?"20px 20px 0 0":"20px",padding:26,width:isMobile?"100%":"390px",boxShadow:`0 20px 60px ${C.pink3}55`,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>{children}</div></div>;
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
function Bar({pct,color}) { return <div style={{flex:1,height:6,borderRadius:99,background:C.pink1,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:color,transition:"width .5s"}}/></div>; }
const inp = {width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12,fontFamily:"inherit",background:"#FFF8FA",color:C.text};
function TomatoRow({ count }) { return <span style={{display:"inline-flex",alignItems:"center",gap:1,marginLeft:6}}>{Array.from({length:count}).map((_,i)=><span key={i} style={{fontSize:14,lineHeight:1,filter:"drop-shadow(0 1px 1px rgba(0,0,0,.1))",animation:`tomato-bounce ${0.4+i*0.15}s ease-in-out infinite alternate`}}>🍅</span>)}</span>; }


function WeeklyCheckbox({ checked, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 20, height: 20, borderRadius: 6, cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: checked ? "none" : `1.5px solid ${C.border}`,
        background: checked ? C.rose : "transparent",
        transition: "all .15s",
      }}
    >
      {checked && <span style={{ color: C.white, fontSize: 12, fontWeight: 900, lineHeight: 1 }}>✓</span>}
    </div>
  );
}

// 짠토의 성장일지: 요일별 표 형식 주간 할 일. 체크 상태는 주(월요일 키)별로 저장되어 매주 자동으로 리셋됨.
function WeeklyGrowthLog({ selDate, todos, addWeeklyRow, updateWeeklyLabel, updateWeeklyCell, toggleWeeklyCheck, removeWeeklyRow }) {
  const [editMode, setEditMode] = useState(false);
  const captureRef = useRef(null);

  const rows = (todos.weeklyTable && todos.weeklyTable.rows) || [];
  const weekKey = getMonday(selDate);
  const rangeStr = getWeekRange(selDate);

  let total = 0, done = 0;
  rows.forEach(row => {
    WEEK_DAYS.forEach(({ key }) => {
      const text = (row.cells && row.cells[key]) || "";
      if (!text.trim()) return;
      total++;
      if (row.checks && row.checks[weekKey] && row.checks[weekKey][key]) done++;
    });
  });
  const pct = total ? Math.round((done / total) * 100) : 0;

  function handleSaveImage() {
    const capture = () => {
      const node = captureRef.current;
      if (!node) return;
      import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(() => {
        window.html2canvas(node, { scale: 2, backgroundColor: "#FFFFFF" }).then(canvas => {
          const a = document.createElement("a");
          a.download = `짠토의_성장일지_${rangeStr.replace(/\s/g, "")}.png`;
          a.href = canvas.toDataURL();
          a.click();
        });
      }).catch(() => alert("이미지 저장에 실패했어요. 화면을 길게 눌러 캡처해봐요!"));
    };
    if (editMode) { setEditMode(false); setTimeout(capture, 50); } else { capture(); }
  }

  return (
    <div style={{ background: "linear-gradient(135deg,#FFF3F1,#FFE2D8)", borderRadius: 16, padding: "14px 16px", border: `1.5px solid ${C.border}`, marginBottom: 16, boxShadow: `0 2px 10px ${C.pink1}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20 }}>🍅</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: C.rose, letterSpacing: "-0.5px" }}>짠토의 성장일지</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.rose, opacity: 0.7, background: C.rose + "1A", padding: "2px 6px", borderRadius: 6 }}>{rangeStr}</span>
        </div>
        <button onClick={() => setEditMode(p => !p)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 13, background: editMode ? "#7EC8A4" : C.rose }}>
          {editMode ? "완료" : "편집"}
        </button>
      </div>

      <div ref={captureRef} style={{ background: C.white, borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 99, background: C.pink1, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: C.rose, transition: "width .5s" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: C.rose, minWidth: 32, textAlign: "right" }}>{pct}%</span>
          <span style={{ fontSize: 11, color: C.sub, fontWeight: 700, whiteSpace: "nowrap" }}>{done}/{total} 완료</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 540 }}>
            <thead>
              <tr>
                <th style={{ position: "sticky", left: 0, zIndex: 1, background: C.white, minWidth: 90, padding: "6px 8px", fontSize: 12, color: C.sub, textAlign: "left", borderBottom: `1.5px solid ${C.border}` }} />
                {WEEK_DAYS.map(d => (
                  <th key={d.key} style={{ minWidth: 72, padding: "6px 4px", fontSize: 12, fontWeight: 800, color: C.sub, borderBottom: `1.5px solid ${C.border}` }}>{d.label}</th>
                ))}
                {editMode && <th style={{ width: 28, borderBottom: `1.5px solid ${C.border}` }} />}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td style={{ position: "sticky", left: 0, zIndex: 1, background: C.white, padding: "6px 8px", borderBottom: `1px dashed ${C.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                      {editMode ? (
                        <KoreanInput key={"rowlabel-" + row.id} value={row.label} onChange={v => updateWeeklyLabel(row.id, v)} style={{ width: 66, border: "none", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.text, outline: "none", background: "transparent", padding: "2px 0", fontFamily: "inherit" }} />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</span>
                      )}
                    </div>
                  </td>
                  {WEEK_DAYS.map(d => {
                    const text = (row.cells && row.cells[d.key]) || "";
                    const checked = !!(row.checks && row.checks[weekKey] && row.checks[weekKey][d.key]);
                    return (
                      <td key={d.key} style={{ padding: "6px 4px", borderBottom: `1px dashed ${C.border}`, textAlign: "center", verticalAlign: "top" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                          <WeeklyCheckbox checked={checked} onToggle={() => toggleWeeklyCheck(row.id, d.key, selDate)} />
                          {editMode ? (
                            <KoreanInput key={"cell-" + row.id + "-" + d.key} value={text} onChange={v => updateWeeklyCell(row.id, d.key, v)} placeholder="-" style={{ width: 60, border: "none", borderBottom: `1px solid ${C.border}`, fontSize: 11, textAlign: "center", outline: "none", background: "transparent", padding: "2px 0", fontFamily: "inherit" }} />
                          ) : (
                            <span style={{ fontSize: 11, color: checked ? C.sub : C.text, textDecoration: checked ? "line-through" : "none", maxWidth: 60, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text || "-"}</span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  {editMode && (
                    <td style={{ textAlign: "center", verticalAlign: "middle", borderBottom: `1px dashed ${C.border}` }}>
                      <button onClick={() => removeWeeklyRow(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.tomato, fontSize: 13, opacity: .7 }}>✕</button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={editMode ? 9 : 8} style={{ textAlign: "center", padding: "16px 0", fontSize: 12, color: C.sub }}>
                    {editMode ? "아래 ＋ 행 추가 버튼으로 첫 항목을 만들어봐요!" : "편집 버튼을 눌러 항목을 추가해봐요 🍅"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editMode && (
        <button onClick={addWeeklyRow} style={{ marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 10, border: `1.5px dashed ${C.rose}`, background: "transparent", color: C.rose, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>＋ 행 추가</button>
      )}

      <button onClick={handleSaveImage} style={{ marginTop: 10, width: "100%", padding: "8px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg,${C.pink3},${C.rose})`, color: C.white, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>📸 이미지로 저장</button>
    </div>
  );
}


// 짠토의 성장일지 위에 얹는 "이번 주 달성률" 요약 카드. selDate가 속한 주 기준으로 계산되고,
// 쉬는 날로 표시한 날은 통계에서 제외돼요.
function WeeklyStatsCard({ selDate, activeCats, todos, isDone, todayStr, isRestDay }) {
  const week = getCurrentWeek(selDate);
  const days = week.days.filter(ds => !isRestDay(ds));
  const restCount = week.days.length - days.length;

  const catStats = {};
  activeCats.forEach(c => { catStats[c.id] = { total: 0, done: 0 }; });
  let total = 0, done = 0;
  days.forEach(ds => {
    activeCats.forEach(cat => {
      const items = (todos[cat.id]||[]).filter(t => !t.archived && itemAppliesOn(t, ds));
      items.forEach(t => {
        const d = isDone(t, ds);
        total++; if(d) done++;
        catStats[cat.id].total++;
        if(d) catStats[cat.id].done++;
      });
    });
  });
  const pct = total ? Math.round(done/total*100) : null;
  const tc = pct === 100 ? 3 : (pct !== null && pct >= 70 ? 2 : 1);

  function dayPct(ds) {
    const items = activeCats.flatMap(c => (todos[c.id]||[]).filter(t => !t.archived && itemAppliesOn(t, ds)).map(t => ({ ...t, catId: c.id, done: isDone(t, ds) })));
    return items.length ? Math.round(items.filter(t=>t.done).length/items.length*100) : null;
  }

  return (
    <div style={{background:"linear-gradient(135deg,#FFF3F1,#FFE2D8)",borderRadius:20,border:`1.5px solid ${C.border}`,padding:"18px 20px",marginBottom:16,boxShadow:`0 2px 8px ${C.pink1}`}}>
      <style>{`
        @keyframes tomato-bounce {
          from { transform: translateY(0px) rotate(-5deg); }
          to   { transform: translateY(-4px) rotate(5deg); }
        }
      `}</style>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
          <span style={{fontSize:18,fontWeight:900,color:C.rose}}>{week.label}</span>
          {pct !== null && <TomatoRow count={tc}/>}
          {restCount > 0 && <span style={{fontSize:11,fontWeight:700,color:C.sub,background:C.white,padding:"2px 8px",borderRadius:99}}>🌿 쉼 {restCount}일 제외</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:13,color:C.sub,fontWeight:600}}>{done}/{total} 완료</span>
          <Ring pct={pct||0} size={54} stroke={6} color={C.rose} bg={C.pink1}/>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,marginBottom:16}}>
        {week.days.map(ds => {
          const rest = isRestDay(ds);
          const dp = rest ? null : dayPct(ds);
          const isToday = ds === todayStr;
          const dow = new Date(ds).getDay();
          return (
            <div key={ds} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <span style={{fontSize:12,fontWeight:isToday?800:600,color:isToday?C.rose:[0,6].includes(dow)?C.pink3:C.sub}}>{DAYS_KO[dow]}</span>
              <div style={{width:"100%",height:48,borderRadius:8,background:C.pink1,position:"relative",overflow:"hidden",border:isToday?`2px solid ${C.rose}`:"none",display:rest?"flex":"block",alignItems:"center",justifyContent:"center"}}>
                {rest ? <span style={{fontSize:16}}>🌿</span> : dp!==null && (
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${dp}%`,
                    background:isToday?`linear-gradient(180deg,${C.rose},${C.pink3})`:dp===100?"#7EC8A4":`linear-gradient(180deg,${C.pink3},${C.pink2})`,
                    borderRadius:6,transition:"height .5s"}}/>
                )}
              </div>
              <span style={{fontSize:11,fontWeight:700,color:rest?C.sub:isToday?C.rose:dp===100?"#7EC8A4":C.sub}}>{rest?"쉼":dp===null?"—":dp+"%"}</span>
              <span style={{fontSize:11,color:C.sub}}>{ds.slice(8)}</span>
            </div>
          );
        })}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:7}}>
        {activeCats.map(cat => {
          const cs = catStats[cat.id];
          if (cs.total === 0) return null;
          const cp = Math.round(cs.done/cs.total*100);
          return (
            <div key={cat.id} style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:16,flexShrink:0}}>{cat.emoji}</span>
              <span style={{fontSize:13,fontWeight:700,color:C.text,minWidth:52,flexShrink:0}}>{cat.name}</span>
              <Bar pct={cp} color={cat.color}/>
              <span style={{fontSize:13,fontWeight:800,color:cat.color,minWidth:32,textAlign:"right"}}>{cp}%</span>
              <span style={{fontSize:11,color:C.sub,minWidth:38,textAlign:"right"}}>{cs.done}/{cs.total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchiveView({ isMobile, todos, cats, setTodosS }) {
  const [confirmId, setConfirmId] = useState(null);
  const archivedItems = cats.flatMap(cat =>
    (todos[cat.id]||[])
      .filter(t => t.archived)
      .map(t => ({ ...t, catId: cat.id, catName: cat.name, catEmoji: cat.emoji, catColor: cat.color }))
  );
  
  const allArchived = archivedItems;

  function restore(catId, id) {
    setTodosS(p => ({ ...p, [catId]: p[catId].map(t => t.id===id ? { ...t, archived:false } : t) }));
  }
  function deletePermanently(catId, id) {
    setTodosS(p => ({ ...p, [catId]: p[catId].filter(t => t.id!==id) }));
    setConfirmId(null);
  }

  const byCat = cats.map(cat => ({ cat, items: allArchived.filter(t=>t.catId===cat.id) })).filter(g => g.items.length > 0);

  return (
    <div style={{flex:1,overflow:"auto",padding:isMobile?"14px 14px 80px":"20px 28px"}}>
      <div style={{maxWidth:680,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <span style={{fontSize:22}}>📦</span>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:C.rose}}>루틴 보관함</div>
            <div style={{fontSize:12,color:C.sub,marginTop:2}}>삭제된 루틴들이 여기 보관돼요. 복원하거나 영구 삭제할 수 있어요.</div>
          </div>
        </div>
        <div style={{background:C.pink1,borderRadius:12,padding:"10px 14px",marginBottom:20,fontSize:12,color:C.sub,lineHeight:1.7}}>
          💡 루틴을 삭제하면 과거 달성 기록은 그대로 보존되고 여기에 보관돼요.<br/>
          🔄 복원하면 다시 할일 목록에 나타나요 · 🗑️ 영구삭제하면 기록도 모두 사라져요.
        </div>
        {allArchived.length === 0 && (
          <div style={{textAlign:"center",padding:"60px 0",color:C.sub}}>
            <div style={{fontSize:48,marginBottom:12}}>📭</div>
            <div style={{fontSize:15,fontWeight:700}}>보관된 루틴이 없어요</div>
            <div style={{fontSize:13,marginTop:6}}>루틴을 삭제하면 여기에 보관돼요 🍅</div>
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
                        <div style={{fontSize:14,color:C.sub,textDecoration:"line-through",fontWeight:500}}>{item.title}</div>
                        {item.startDate && !item.endDate && <div style={{fontSize:11,color:C.sub,marginTop:2}}>{repeatLabel(item)} · {item.startDate} 부터 시작</div>}
                        {item.endDate && <div style={{fontSize:11,color:C.sub,marginTop:2}}>🗓️ 기간 할일 · {item.startDate} ~ {item.endDate}</div>}
                        {item.doneLog && Object.keys(item.doneLog).length > 0 && (
                          <div style={{fontSize:11,color:cat.color,marginTop:2}}>✅ 완료 기록 {Object.keys(item.doneLog).length}주/일</div>
                        )}
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button onClick={()=>restore(cat.id, item.id)} style={{padding:"5px 12px",borderRadius:10,border:`1.5px solid ${cat.color}`,background:cat.color+"18",color:cat.color,fontSize:12,fontWeight:700,cursor:"pointer"}}>🔄 복원</button>
                        <button onClick={()=>setConfirmId(item.id)} style={{padding:"5px 12px",borderRadius:10,border:"1.5px solid #FFB3B3",background:"#FFF0F0",color:"#E63946",fontSize:12,fontWeight:700,cursor:"pointer"}}>🗑️ 삭제</button>
                      </div>
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


function ListView({isMobile, selDate, setSelDate, todayStr, allTodosOn, totalPctOn, catPctOn, activeCats, todos, isDone, visibleTodosOn, openAddTodo, openEditTodo, toggleTodo, hideCompleted, setHideCompleted, setCatForm, setCatModal, setShareCard, onMoveCat, addWeeklyRow, updateWeeklyLabel, updateWeeklyCell, toggleWeeklyCheck, removeWeeklyRow, cats, showCat, isRestDay, toggleRestDay}) {
  const dragItem = useRef();
  const dragOverItem = useRef();

  function handleDragStart(e, index) {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = "move";
  }
  function handleDragEnter(e, index) {
    dragOverItem.current = index;
  }
  function handleDragEnd() {
    if (dragItem.current !== undefined && dragOverItem.current !== undefined && dragItem.current !== dragOverItem.current) {
      onMoveCat(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  }

  return (
    <div style={{flex:1,overflow:"auto",padding:isMobile?"12px 14px":"16px 20px"}}>
      <div style={{display:"flex",flexDirection:isMobile?"column":"row",alignItems:isMobile?"stretch":"center",gap:8,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:800}}>‹</button>
          <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{border:`1.5px solid ${C.border}`,borderRadius:10,padding:"6px 10px",fontSize:13,color:C.text,background:C.white,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:800}}>›</button>
          <button onClick={()=>setSelDate(todayStr)} style={{background:C.pink2,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
          <button onClick={()=>toggleRestDay(selDate)} style={{background:isRestDay(selDate)?"#7EC8A4":C.white,border:`1.5px solid ${isRestDay(selDate)?"#7EC8A4":C.border}`,borderRadius:8,padding:"5px 10px",cursor:"pointer",color:isRestDay(selDate)?C.white:C.sub,fontWeight:700,fontSize:12}}>🌿 쉼</button>
        </div>
        {isRestDay(selDate) ? (
          <div style={{display:"flex",alignItems:"center",gap:10,background:"#F0FFF8",borderRadius:16,padding:isMobile?"8px 14px":"10px 16px",border:"1.5px solid #A5D6A7",flex:1,minWidth:0}}>
            <span style={{fontSize:24}}>🌿</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:"#2E7D32"}}>쉬는 중이에요</div>
              <div style={{fontSize:11,color:C.sub}}>이 날은 달성률 계산에서 빠져요. 편히 쉬어요!</div>
            </div>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"center",gap:10,background:C.white,borderRadius:16,padding:isMobile?"8px 12px":"10px 16px",border:`1.5px solid ${C.border}`,flex:1,minWidth:0,boxShadow:`0 2px 10px ${C.pink1}`}}>
            <Ring pct={totalPctOn(selDate)} size={isMobile?44:54} stroke={isMobile?5:6} color={C.rose} bg={C.pink1}/>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:800,color:C.rose}}>🍅 오늘 달성률</div>
              <div style={{fontSize:11,color:C.sub}}>{allTodosOn(selDate).filter(t=>t.done).length}/{allTodosOn(selDate).length} 완료</div>
              {totalPctOn(selDate)===100&&allTodosOn(selDate).length>0&&<div style={{fontSize:11,color:C.tomato,fontWeight:700}}>완벽해요! 🎉</div>}
            </div>
            {!isMobile&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{activeCats.map(cat=>(
              <div key={cat.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <Ring pct={catPctOn(cat.id,selDate)} size={36} stroke={4} color={cat.color} bg={C.pink1}/>
                <span style={{fontSize:9,color:C.sub}}>{cat.emoji}</span>
              </div>
            ))}</div>}
            <button onClick={()=>setShareCard(true)} style={{background:`linear-gradient(135deg,${C.pink3},${C.rose})`,border:"none",borderRadius:10,padding:"8px 10px",cursor:"pointer",color:C.white,fontSize:16,flexShrink:0}}>📸</button>
          </div>
        )}
      </div>

      <WeeklyStatsCard selDate={selDate} activeCats={activeCats} todos={todos} isDone={isDone} todayStr={todayStr} isRestDay={isRestDay}/>

      <WeeklyGrowthLog selDate={selDate} todos={todos} addWeeklyRow={addWeeklyRow} updateWeeklyLabel={updateWeeklyLabel} updateWeeklyCell={updateWeeklyCell} toggleWeeklyCheck={toggleWeeklyCheck} removeWeeklyRow={removeWeeklyRow} />

      <div style={{fontSize:11,color:C.sub,marginBottom:10,display:"flex",alignItems:"center",gap:4}}>
        <span>💡 팁: 분류 이름(상단 영역)을 마우스로 드래그하면 원하는 순서대로 위치를 바꿀 수 있어요!</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(270px,1fr))",gap:isMobile?10:14}}>
        {activeCats.map((cat, index)=>{
          const items=visibleTodosOn(cat.id,selDate);
          const pct=catPctOn(cat.id,selDate),isHiding=hideCompleted[cat.id]!==false;
          const vis=isHiding?items.filter(t=>!t.done):items, hiddenCount=items.filter(t=>t.done).length;
          return (
            <div 
              key={cat.id} draggable onDragStart={(e)=>handleDragStart(e, index)} onDragEnter={(e)=>handleDragEnter(e, index)} onDragEnd={handleDragEnd} onDragOver={(e)=>e.preventDefault()}
              style={{background:C.white,borderRadius:16,padding:"14px",border:`1.5px solid ${C.border}`,boxShadow:`0 2px 10px ${C.pink1}`,transition:"transform 0.15s"}}
            >
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,cursor:"move",userSelect:"none",paddingBottom:4,borderBottom:`1px dashed ${C.border}`}} title="드래그해서 순서 변경">
                <div style={{display:"flex",alignItems:"center",gap:6,flex:1,minWidth:0,overflow:"hidden"}}>
                  <span style={{color:C.sub,opacity:0.4,fontSize:13,letterSpacing:-2,marginRight:2}}>:::</span>
                  <span style={{fontSize:18,flexShrink:0}}>{cat.emoji}</span>
                  <span style={{fontSize:15,fontWeight:800,flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat.name}</span>
                  <span style={{fontSize:10,color:cat.color,background:cat.color+"22",padding:"2px 8px",borderRadius:99,flexShrink:0}}>{items.length}개</span>
                </div>
                <div style={{display:"flex",gap:3,alignItems:"center",flexShrink:0,marginLeft:6}}>
                  <button onClick={(e)=>{e.stopPropagation();setHideCompleted(p=>({...p,[cat.id]:!isHiding}));}} style={{padding:"3px 8px",borderRadius:99,border:`1.5px solid ${isHiding?cat.color:C.border}`,background:isHiding?cat.color+"22":C.white,color:isHiding?cat.color:C.sub,cursor:"pointer",fontSize:11,fontWeight:700}}>{isHiding?`숨김(${hiddenCount})`:"숨김해제"}</button>
                  <button onClick={(e)=>{e.stopPropagation();setCatForm({name:cat.name,emoji:cat.emoji,color:cat.color});setCatModal({id:cat.id});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.sub}}>✏️</button>
                  <button onClick={(e)=>{e.stopPropagation();openAddTodo(cat.id);}} style={{background:cat.color,border:"none",borderRadius:8,padding:"3px 10px",cursor:"pointer",color:C.white,fontWeight:800}}>+</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Bar pct={pct} color={cat.color}/><span style={{fontSize:11,fontWeight:700,color:cat.color,minWidth:28}}>{pct}%</span></div>
              {vis.length===0&&items.length===0&&<div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>할 일을 추가해봐요 🌸</div>}
              {vis.length===0&&items.length>0&&<div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>🎉 모두 완료!</div>}
              {vis.map(item=>(
                <div key={item.id} style={{padding:"6px 0",borderBottom:`1px dashed ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input type="checkbox" checked={item.done} onChange={()=>toggleTodo(cat.id,item.id,selDate)} style={{width:18,height:18,accentColor:cat.color,cursor:"pointer",flexShrink:0}}/>
                    <span style={{flex:1,fontSize:13,color:item.done?C.sub:C.text,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600}}>
                      {!item.date&&<span style={{fontSize:10,background:cat.color+"33",color:cat.color,borderRadius:4,padding:"1px 5px",marginRight:4}}>{repeatIcon(item)} {repeatLabel(item)}</span>}{item.title}
                    </span>
                    <button onClick={()=>openEditTodo(cat.id,item)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.sub,padding:0,opacity:.6}}>✏️</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div onClick={()=>{setCatForm({name:"",emoji:"⭐",color:C.pink3});setCatModal("add");}} style={{background:"#fff8fa",borderRadius:16,padding:"16px",border:`1.5px dashed ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,color:C.sub,minHeight:100}} onMouseEnter={e=>e.currentTarget.style.background=C.pink1} onMouseLeave={e=>e.currentTarget.style.background="#fff8fa"}>
          <span style={{fontSize:26}}>＋</span><span style={{fontSize:12,fontWeight:700}}>분류 추가</span>
        </div>
      </div>

      {cats.filter(c=>c.hidden).length>0&&(
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6}}>숨긴 분류</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cats.filter(c=>c.hidden).map(c=>(
              <button key={c.id} onClick={()=>showCat(c.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:99,background:C.white,border:`1.5px solid ${C.border}`,cursor:"pointer",fontSize:12,color:C.sub,fontWeight:700}}>{c.emoji} {c.name}<span style={{color:C.rose}}>복원</span></button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TodayMobileView({selDate, setSelDate, todayStr, allTodosOn, totalPctOn, catPctOn, activeCats, todos, visibleTodosOn, toggleTodo, openAddTodo, hideCompleted, setHideCompleted, cloudCode, addWeeklyRow, updateWeeklyLabel, updateWeeklyCell, toggleWeeklyCheck, removeWeeklyRow, isRestDay, toggleRestDay}) {
  return (
    <div style={{flex:1,overflow:"auto",padding:"14px 14px 80px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div><div style={{fontSize:18,fontWeight:800,color:C.rose}}>{selDate===todayStr?"오늘":selDate}</div><div style={{fontSize:12,color:C.sub}}>{new Date(selDate).toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})}</div></div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.rose,fontWeight:800}}>‹</button>
          <button onClick={()=>setSelDate(todayStr)} style={{background:C.pink2,border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.rose,fontWeight:800}}>›</button>
          <button onClick={()=>toggleRestDay(selDate)} style={{background:isRestDay(selDate)?"#7EC8A4":C.white,border:`1.5px solid ${isRestDay(selDate)?"#7EC8A4":C.border}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",color:isRestDay(selDate)?C.white:C.sub,fontWeight:700,fontSize:12}}>🌿</button>
        </div>
      </div>
      {isRestDay(selDate) ? (
        <div style={{display:"flex",alignItems:"center",gap:12,background:"#F0FFF8",borderRadius:16,padding:"12px 16px",border:"1.5px solid #A5D6A7",marginBottom:14}}>
          <span style={{fontSize:26}}>🌿</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:"#2E7D32"}}>쉬는 중이에요</div><div style={{fontSize:12,color:C.sub}}>이 날은 달성률 계산에서 빠져요</div></div>
        </div>
      ) : (
        <div style={{display:"flex",alignItems:"center",gap:12,background:C.white,borderRadius:16,padding:"12px 16px",border:`1.5px solid ${C.border}`,marginBottom:14}}>
          <Ring pct={totalPctOn(selDate)} size={52} stroke={5} color={C.rose} bg={C.pink1}/>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:C.rose}}>총 달성률</div><div style={{fontSize:12,color:C.sub}}>{allTodosOn(selDate).filter(t=>t.done).length}/{allTodosOn(selDate).length} 완료</div></div>
          <div style={{background:cloudCode?"#E8F5E9":"#FFF0F0",border:cloudCode?"1.5px solid #A5D6A7":"1.5px solid #FFB3B3",borderRadius:10,padding:"7px 12px",color:cloudCode?"#2E7D32":"#C62828",fontWeight:800,fontSize:12}}>{cloudCode?"☁️ 연동중":"⚠️ 로컬"}</div>
        </div>
      )}

      <WeeklyGrowthLog selDate={selDate} todos={todos} addWeeklyRow={addWeeklyRow} updateWeeklyLabel={updateWeeklyLabel} updateWeeklyCell={updateWeeklyCell} toggleWeeklyCheck={toggleWeeklyCheck} removeWeeklyRow={removeWeeklyRow} />

      <div style={{fontSize:12,fontWeight:800,color:C.sub,marginBottom:8}}>✅ 할 일</div>
      {activeCats.map(cat=>{
        const items=visibleTodosOn(cat.id,selDate);
        if(!items.length) return null;
        const isHiding = hideCompleted[cat.id]!==false;
        const vis = isHiding ? items.filter(t=>!t.done) : items;
        const hiddenCount = items.filter(t=>t.done).length;
        return (
        <div key={cat.id} style={{background:C.white,borderRadius:14,padding:"12px 14px",border:`1.5px solid ${C.border}`,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flex:1,overflow:"hidden"}}><span style={{fontSize:16}}>{cat.emoji}</span><span style={{fontSize:13,fontWeight:800,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cat.name}</span></div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
              <span style={{fontSize:11,fontWeight:700,color:cat.color}}>{catPctOn(cat.id,selDate)}%</span>
              {hiddenCount>0&&<button onClick={()=>setHideCompleted(p=>({...p,[cat.id]:!isHiding}))} style={{padding:"3px 7px",borderRadius:99,border:`1.5px solid ${isHiding?cat.color:C.border}`,background:isHiding?cat.color+"22":C.white,color:isHiding?cat.color:C.sub,cursor:"pointer",fontSize:10,fontWeight:700}}>{isHiding?`숨김(${hiddenCount})`:"해제"}</button>}
              <button onClick={()=>openAddTodo(cat.id)} style={{background:cat.color,border:"none",borderRadius:8,padding:"3px 10px",cursor:"pointer",color:C.white,fontWeight:800}}>+</button>
            </div>
          </div>
          <div style={{height:4,borderRadius:99,background:C.pink1,overflow:"hidden",marginBottom:8}}><div style={{width:`${catPctOn(cat.id,selDate)}%`,height:"100%",borderRadius:99,background:cat.color}}/></div>
          {vis.length===0&&<div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"6px 0"}}>🎉 모두 완료!</div>}
          {vis.map(item=>(
            <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px dashed ${C.border}`}}>
              <input type="checkbox" checked={item.done} onChange={()=>toggleTodo(cat.id,item.id,selDate)} style={{width:20,height:20,accentColor:cat.color,cursor:"pointer",flexShrink:0}}/>
              <span style={{flex:1,fontSize:14,color:item.done?C.sub:C.text,textDecoration:item.done?"line-through":"none"}}>
                {!item.date&&<span style={{fontSize:9,background:cat.color+"33",color:cat.color,borderRadius:4,padding:"1px 5px",marginRight:4}}>{repeatIcon(item)} {repeatLabel(item)}</span>}{item.title}
              </span>
            </div>
          ))}
        </div>
      );})}
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

  const [view,      setView]      = useState("list");
  const [mobileTab, setMobileTab] = useState("today");
  const [selDate,   setSelDate]   = useState(todayStr);
  const [restDays,  setRestDays]  = useState(()=>load("jjanto_rest_days",[]));
  const [todos,     setTodos]     = useState(()=>{
    const loaded = load("jjanto_todos", INIT_TODOS);
    const cleaned = {};
    Object.keys(loaded).forEach(cid=>{
      if (cid === "weeklyTable") { cleaned[cid] = loaded[cid]; return; }
      cleaned[cid] = (loaded[cid]||[]).map(t=>{
        if (cid === "weekly") return t;
        const type = t.date ? "single" : t.endDate ? "period" : "routine";
        return cleanTodoItem(t, type);
      });
    });
    if (!cleaned.weekly) cleaned.weekly = INIT_TODOS.weekly;
    if (!cleaned.weeklyTable) cleaned.weeklyTable = { rows: [] };
    return cleaned;
  });
  const [cats,      setCats]      = useState(()=>load("jjanto_cats",  CAT_DEFAULTS));
  const [hideCompleted,setHideCompleted]=useState({});
  const [shareCard, setShareCard] =useState(false);
  const [memos,     setMemos]     =useState(()=>load("jjanto_memos",[]));
  const [memoInput, setMemoInput] =useState("");
  const cardRef=useRef(null);

  const [todoModal, setTodoModal] =useState(null);
  const [todoForm,  setTodoForm]  = useState({title:"", type:"single", date:"",startDate:todayStr,endDate:todayStr, repeatType:"daily",weekDays:[],monthDay:1});
  const [catModal,  setCatModal]  =useState(null);
  const [catForm,   setCatForm]   =useState({name:"",emoji:"⭐",color:C.pink3});
  
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
  const setCatsS    =v=>{ const n=typeof v==="function"?v(cats):v;     setCats(n);     save("jjanto_cats",n);      triggerAutoSave(); };
  const setMemosS   =v=>{ const n=typeof v==="function"?v(memos):v;    setMemos(n);    save("jjanto_memos",n);     triggerAutoSave(); };
  const setRestDaysS=v=>{ const n=typeof v==="function"?v(restDays):v; setRestDays(n); save("jjanto_rest_days",n); triggerAutoSave(); };
  const isRestDay = ds => restDays.includes(ds);
  function toggleRestDay(ds) { setRestDaysS(p => p.includes(ds) ? p.filter(d=>d!==ds) : [...p, ds]); }

  function addWeeklyRow() {
    setTodosS(p => {
      const rows = (p.weeklyTable && p.weeklyTable.rows) || [];
      const color = WEEKLY_ROW_COLORS[rows.length % WEEKLY_ROW_COLORS.length];
      const newRow = { id: genId(), label: "새 항목", color, cells: emptyWeeklyCells(), checks: {} };
      return { ...p, weeklyTable: { rows: [...rows, newRow] } };
    });
  }
  function updateWeeklyLabel(rowId, label) {
    setTodosS(p => ({ ...p, weeklyTable: { rows: ((p.weeklyTable && p.weeklyTable.rows) || []).map(r => r.id === rowId ? { ...r, label } : r) } }));
  }
  function updateWeeklyCell(rowId, day, text) {
    setTodosS(p => ({ ...p, weeklyTable: { rows: ((p.weeklyTable && p.weeklyTable.rows) || []).map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [day]: text } } : r) } }));
  }
  function toggleWeeklyCheck(rowId, day, ds) {
    const wk = getMonday(ds);
    setTodosS(p => ({
      ...p,
      weeklyTable: {
        rows: ((p.weeklyTable && p.weeklyTable.rows) || []).map(r => {
          if (r.id !== rowId) return r;
          const weekChecks = { ...(r.checks && r.checks[wk]) };
          weekChecks[day] = !weekChecks[day];
          return { ...r, checks: { ...r.checks, [wk]: weekChecks } };
        })
      }
    }));
  }
  function removeWeeklyRow(rowId) {
    setTodosS(p => ({ ...p, weeklyTable: { rows: ((p.weeklyTable && p.weeklyTable.rows) || []).filter(r => r.id !== rowId) } }));
  }

  function handleMoveCat(fromIndex, toIndex) {
    const active = cats.filter(c=>!c.hidden), hidden = cats.filter(c=>c.hidden);
    const updatedActive = [...active];
    const [moved] = updatedActive.splice(fromIndex, 1);
    updatedActive.splice(toIndex, 0, moved);
    setCatsS([...updatedActive, ...hidden]);
  }

  function addMemo(imgData = null) { if(!memoInput.trim() && !imgData) return; setMemosS(p=>[{id:genId(), text:memoInput.trim(), image:imgData, createdAt:new Date().toISOString()}, ...p]); setMemoInput(""); }
  function editMemo(id, text, imgData) { setMemosS(p=>p.map(m=>m.id===id?{...m,text,image:imgData,updatedAt:new Date().toISOString()}:m)); }
  function deleteMemo(id) { setMemosS(p=>p.filter(m=>m.id!==id)); }

  const activeCats=cats.filter(c=>!c.hidden);
  const isDone=(item,ds)=>item.date ? item.done : !!(item.doneLog && item.doneLog[ds]);
  const allTodosOn=ds=>activeCats.flatMap(c=> (todos[c.id]||[]).filter(t=>!t.archived && itemAppliesOn(t, ds)).map(t=>({...t,done:isDone(t,ds)})) );
  const visibleTodosOn=(cid,ds)=>(todos[cid]||[]).filter(t=>!t.archived&&itemAppliesOn(t, ds)).map(t=>({...t,done:isDone(t,ds)}));
  const totalPctOn=ds=>{ const a=allTodosOn(ds); return a.length?Math.round(a.filter(t=>t.done).length/a.length*100):0; };
  const catPctOn=(cid,ds)=>{ const i=(todos[cid]||[]).filter(t=>!t.archived && itemAppliesOn(t, ds)); return i.length?Math.round(i.filter(t=>isDone(t,ds)).length/i.length*100):0; };


  function openAddTodo(cid){ setTodoForm({ title:"", type:"single", date:selDate, startDate:selDate||todayStr, endDate:selDate||todayStr, repeatType:"daily", weekDays:[], monthDay:1 }); setTodoModal({mode:"add",catId:cid}); }
  function openEditTodo(cid,item){ setTodoForm({ title:item.title, type: item.date ? "single" : item.endDate ? "period" : "routine", date:item.date||"", startDate:item.startDate||todayStr, endDate:item.endDate||item.startDate||todayStr, repeatType:item.repeatType||"daily", weekDays:item.weekDays||[], monthDay:item.monthDay||1 }); setTodoModal({mode:"edit",catId:cid,item}); }
  function saveTodo(){
    if(!todoForm.title.trim()) return;
    const {mode,catId,item}=todoModal;
    let base;
    if (todoForm.type === "single") base = { title: todoForm.title, date: todoForm.date, done: item?.done || false };
    else if (todoForm.type === "period") base = { title: todoForm.title, date: "", startDate: todoForm.startDate, endDate: todoForm.endDate || todoForm.startDate, repeatType: "daily" };
    else { base = { title: todoForm.title, date: "", startDate: todoForm.startDate, repeatType: todoForm.repeatType||"daily" }; if (todoForm.repeatType==="weekly") base.weekDays = todoForm.weekDays||[]; if (todoForm.repeatType==="monthly") base.monthDay = todoForm.monthDay||1; }

    if(mode==="add") setTodosS(p=>({...p,[catId]:[...(p[catId]||[]),cleanTodoItem({id:genId(),...base,doneLog:{}},todoForm.type)]}));
    else setTodosS(p=>({...p,[catId]:p[catId].map(t=>t.id===item.id?cleanTodoItem({...t,...base},todoForm.type):t)}));
    setTodoModal(null);
  }
  function deleteTodo(cid,id){ const item=(todos[cid]||[]).find(t=>t.id===id); if(item && !item.date) { setTodosS(p=>({...p,[cid]:p[cid].map(t=>t.id===id?{...t,archived:true}:t)})); } else { setTodosS(p=>({...p,[cid]:p[cid].filter(t=>t.id!==id)})); } setTodoModal(null); }
  function toggleTodo(cid,id,ds){ setTodosS(p=>({...p,[cid]:p[cid].map(t=>{ if(t.id!==id) return t; if(t.date) return {...t,done:!t.done}; const log={...(t.doneLog||{})}; if(log[ds]) delete log[ds]; else log[ds]=true; return {...t,doneLog:log}; })})); }
  function saveCat(){ if(!catForm.name.trim()) return; if(catModal==="add"){ const nid=genId(); setCatsS(p=>[...p,{id:nid,...catForm,hidden:false}]); setTodosS(p=>({...p,[nid]:[]})); } else setCatsS(p=>p.map(c=>c.id===catModal.id?{...c,...catForm}:c)); setCatModal(null); }
  function hideCat(id){ setCatsS(p=>p.map(c=>c.id===id?{...c,hidden:true}:c)); setCatModal(null); }
  function showCat(id){ setCatsS(p=>p.map(c=>c.id===id?{...c,hidden:false}:c)); }

  const commonProps = { isMobile, selDate, setSelDate, todayStr, allTodosOn, totalPctOn, catPctOn, activeCats, todos, visibleTodosOn, toggleTodo, openAddTodo, hideCompleted, setHideCompleted, cloudCode, addWeeklyRow, updateWeeklyLabel, updateWeeklyCell, toggleWeeklyCheck, removeWeeklyRow, isRestDay, toggleRestDay };
  const weekDaysInvalid = todoForm.type==="routine" && todoForm.repeatType==="weekly" && (!todoForm.weekDays||todoForm.weekDays.length===0);

  const cloudBadge = (
    <div style={{display:"flex",alignItems:"center",gap:6,background:cloudCode?"#E8F5E9":"#FFF0F0",border:cloudCode?"1.5px solid #A5D6A7":"1.5px solid #FFB3B3",borderRadius:10,padding:"5px 10px",color:cloudCode?"#2E7D32":"#C62828",fontWeight:800,fontSize:11,flexShrink:0}}>
      {cloudCode?"☁️ 연동중":"⚠️ 로컬"}
    </div>
  );

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Nunito','Apple SD Gothic Neo',sans-serif",background:C.bg,color:C.text,overflow:"hidden",flexDirection:"column"}}>
      {!isMobile&&(
        <div style={{display:"flex",flex:1,flexDirection:"column",overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderBottom:`1.5px solid ${C.border}`,background:C.white,flexWrap:"wrap"}}>
            <span style={{fontSize:16,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</span>
            {cloudBadge}
            <div style={{flex:1}}/>
            {[["list","✅ 할일"],["memo","🗒️ 메모"],["archive","📦 보관함"]].map(([v,lb])=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:20,border:`2px solid ${view===v?C.rose:C.border}`,background:view===v?C.rose:C.white,color:view===v?C.white:C.sub,fontSize:12,cursor:"pointer",fontWeight:700}}>{lb}</button>
            ))}
          </div>
          {view==="list"&&<ListView isMobile={isMobile} selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} allTodosOn={allTodosOn} totalPctOn={totalPctOn} catPctOn={catPctOn} activeCats={activeCats} todos={todos} isDone={isDone} visibleTodosOn={visibleTodosOn} openAddTodo={openAddTodo} openEditTodo={openEditTodo} toggleTodo={toggleTodo} hideCompleted={hideCompleted} setHideCompleted={setHideCompleted} setCatForm={setCatForm} setCatModal={setCatModal} setShareCard={setShareCard} onMoveCat={handleMoveCat} addWeeklyRow={addWeeklyRow} updateWeeklyLabel={updateWeeklyLabel} updateWeeklyCell={updateWeeklyCell} toggleWeeklyCheck={toggleWeeklyCheck} removeWeeklyRow={removeWeeklyRow} cats={cats} showCat={showCat} isRestDay={isRestDay} toggleRestDay={toggleRestDay} />}
          {view==="memo"&&<MemoView isMobile={isMobile} memos={memos} memoInput={memoInput} setMemoInput={setMemoInput} addMemo={addMemo} editMemo={editMemo} deleteMemo={deleteMemo}/>}
          {view==="archive"&&<ArchiveView isMobile={isMobile} todos={todos} cats={cats} setTodosS={setTodosS}/>}
        </div>
      )}

      {isMobile&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:C.white,borderBottom:`1.5px solid ${C.border}`,flexShrink:0,gap:8}}>
            <span style={{fontSize:15,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</span>
            {cloudBadge}
          </div>
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {mobileTab==="list"&&<ListView isMobile={isMobile} selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} allTodosOn={allTodosOn} totalPctOn={totalPctOn} catPctOn={catPctOn} activeCats={activeCats} todos={todos} isDone={isDone} visibleTodosOn={visibleTodosOn} openAddTodo={openAddTodo} openEditTodo={openEditTodo} toggleTodo={toggleTodo} hideCompleted={hideCompleted} setHideCompleted={setHideCompleted} setCatForm={setCatForm} setCatModal={setCatModal} setShareCard={setShareCard} onMoveCat={handleMoveCat} addWeeklyRow={addWeeklyRow} updateWeeklyLabel={updateWeeklyLabel} updateWeeklyCell={updateWeeklyCell} toggleWeeklyCheck={toggleWeeklyCheck} removeWeeklyRow={removeWeeklyRow} cats={cats} showCat={showCat} isRestDay={isRestDay} toggleRestDay={toggleRestDay} />}
            {mobileTab==="today"&&<TodayMobileView {...commonProps} openEditTodo={openEditTodo}/>}
            {mobileTab==="memo"&&<MemoView isMobile={isMobile} memos={memos} memoInput={memoInput} setMemoInput={setMemoInput} addMemo={addMemo} editMemo={editMemo} deleteMemo={deleteMemo}/>}
            {mobileTab==="archive"&&<ArchiveView isMobile={isMobile} todos={todos} cats={cats} setTodosS={setTodosS}/>}
          </div>
          <div style={{display:"flex",borderTop:`1.5px solid ${C.border}`,background:C.white,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom)"}}>
            {[
              {tab:"today",  icon:"✨",  label:"오늘"},
              {tab:"list",   icon:"✅",  label:"할일"},
              {tab:"memo",   icon:"🗒️", label:"메모"},
              {tab:"archive",icon:"📦",  label:"보관함"},
            ].map(({tab,icon,label})=>(
              <button key={tab} onClick={()=>setMobileTab(tab)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"7px 0",border:"none",background:"transparent",cursor:"pointer",color:mobileTab===tab?C.rose:C.sub,gap:1}}>
                <span style={{fontSize:18}}>{icon}</span>
                <span style={{fontSize:9,fontWeight:mobileTab===tab?800:500}}>{label}</span>
                {mobileTab===tab&&<div style={{width:16,height:3,borderRadius:99,background:C.rose,marginTop:1}}/>}
              </button>
            ))}
          </div>
        </div>
      )}

      {todoModal&&(
        <ModalWrap onClose={()=>setTodoModal(null)} isMobile={isMobile}>
          <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16}}>🌸 할 일 {todoModal.mode==="add"?"추가":"편집"}</div>
          <KoreanInput key={todoModal?.item?.id||"new-todo"} style={inp} placeholder="할 일 내용" value={todoForm.title||""} onChange={v=>setTodoForm(p=>({...p,title:v}))} autoFocus/>
          <div style={{display:"flex", gap:8, marginBottom:16}}>
            {[ {v:"single", lb:"하루 할 일", ic:"✅"}, {v:"period", lb:"기간 (여러 날)", ic:"🗓️"}, {v:"routine", lb:"반복 루틴", ic:"🔁"} ].map(opt => (
              <button key={opt.v} onClick={()=>setTodoForm(p=>({...p, type:opt.v}))} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"12px 0", borderRadius:12, border:`2px solid ${todoForm.type===opt.v?C.rose:C.border}`, background:todoForm.type===opt.v?C.rose+"12":C.white, color:todoForm.type===opt.v?C.rose:C.sub, fontWeight:todoForm.type===opt.v?800:600, fontSize:12, cursor:"pointer"}}><span style={{fontSize:20}}>{opt.ic}</span>{opt.lb}</button>
            ))}
          </div>
          {todoForm.type === "single" && (
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>📅 날짜</label>
              <input type="date" style={{...inp,marginBottom:0}} value={todoForm.date||""} onChange={e=>setTodoForm(p=>({...p,date:e.target.value}))}/>
            </div>
          )}
          {todoForm.type === "period" && (
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>🟢 시작일</label>
                <input type="date" style={{...inp,marginBottom:0}} value={todoForm.startDate||""} onChange={e=>setTodoForm(p=>({...p,startDate:e.target.value, endDate: p.endDate && p.endDate < e.target.value ? e.target.value : p.endDate}))}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>🔴 종료일</label>
                <input type="date" style={{...inp,marginBottom:0}} value={todoForm.endDate||todoForm.startDate||""} min={todoForm.startDate} onChange={e=>setTodoForm(p=>({...p,endDate:e.target.value}))}/>
              </div>
            </div>
          )}
          {todoForm.type === "routine" && (
            <>
              <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6,display:"block"}}>반복 주기</label>
              <div style={{display:"flex",gap:6,marginBottom:12}}>
                {[["daily","매일","☀️"],["alternate","격일","⚡"],["weekly","매주","📅"],["monthly","매월","🗓️"]].map(([val,lb,ic])=>(
                  <button key={val} onClick={()=>setTodoForm(p=>({...p,repeatType:val}))} style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:4,padding:"8px 0",borderRadius:10,border:`2px solid ${todoForm.repeatType===val?C.rose:C.border}`,background:todoForm.repeatType===val?C.rose+"18":C.white,color:todoForm.repeatType===val?C.rose:C.sub,fontWeight:700,fontSize:12,cursor:"pointer"}}>{ic} {lb}</button>
                ))}
              </div>
              {todoForm.repeatType==="alternate"&&(<div style={{marginBottom:12, padding:"9px 12px", background:"#FFF0F5", borderRadius:10, border:`1px solid ${C.border}`, fontSize:11, color:C.rose, lineHeight:1.5}}>💡 <b>루틴 시작일({todoForm.startDate||todayStr})</b>을 기준으로 <b>하루 걸러 하루씩(2일 간격)</b> 플래너에 나타나요!</div>)}
              {todoForm.repeatType==="weekly"&&(
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6,display:"block"}}>요일 선택 (여러 개 가능)</label>
                  <div style={{display:"flex",gap:5,marginBottom:8}}>
                    {DAYS_KO.map((d,i)=>{ const sel=(todoForm.weekDays||[]).includes(i); return (
                      <button key={i} onClick={()=>setTodoForm(p=>{ const cur=p.weekDays||[]; return {...p, weekDays: cur.includes(i)?cur.filter(x=>x!==i):[...cur,i].sort()}; })} style={{flex:1,padding:"8px 0",borderRadius:10,border:`2px solid ${sel?C.rose:C.border}`,background:sel?C.rose:C.white,color:sel?C.white:[0,6].includes(i)?C.pink3:C.sub,fontWeight:800,fontSize:13,cursor:"pointer"}}>{d}</button>
                    );})}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    {[["평일",[1,2,3,4,5]],["주말",[0,6]]].map(([lb,vals])=>{
                      const cur=todoForm.weekDays||[]; const isActive = vals.length===cur.length && vals.every(v=>cur.includes(v));
                      return <button key={lb} onClick={()=>setTodoForm(p=>({...p, weekDays: isActive ? [] : [...vals].sort()}))} style={{flex:1,padding:"6px 0",borderRadius:8,border:`1.5px solid ${isActive?C.rose:C.border}`,background:isActive?C.rose+"18":"#FFF8FA",color:isActive?C.rose:C.sub,fontWeight:700,fontSize:11,cursor:"pointer"}}>{lb}</button>;
                    })}
                  </div>
                  {weekDaysInvalid&&<div style={{fontSize:10,color:C.tomato,marginTop:5}}>⚠️ 요일을 하나 이상 선택해주세요</div>}
                </div>
              )}
              {todoForm.repeatType==="monthly"&&(
                <div style={{marginBottom:12}}>
                  <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6,display:"block"}}>매월 며칠</label>
                  <select value={todoForm.monthDay||1} onChange={e=>setTodoForm(p=>({...p,monthDay:Number(e.target.value)}))} style={{...inp,marginBottom:0,cursor:"pointer"}}>
                    {Array.from({length:31}).map((_,i)=><option key={i+1} value={i+1}>{i+1}일</option>)}
                  </select>
                  <div style={{fontSize:10,color:C.sub,marginTop:4}}>31일이 없는 달은 자동으로 건너뛰어요</div>
                </div>
              )}
              <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>📅 루틴 시작일</label>
              <input type="date" style={{...inp,marginBottom:0}} value={todoForm.startDate||todayStr} onChange={e=>setTodoForm(p=>({...p,startDate:e.target.value}))}/>
              <div style={{fontSize:10,color:C.sub,marginTop:4,marginBottom:4}}>이 날짜부터 달성률에 반영돼요</div>
            </>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:8}}>
            {todoModal.mode==="edit"&&<><button onClick={()=>deleteTodo(todoModal.catId,todoModal.item.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>{todoForm.type==="routine"&&<span style={{fontSize:10,color:C.sub,alignSelf:"center"}}>📦 과거기록 보존</span>}</> }
            <button onClick={()=>setTodoModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
            <button onClick={saveTodo} disabled={weekDaysInvalid} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:weekDaysInvalid?"default":"pointer",fontWeight:800,background:weekDaysInvalid?C.pink1:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:weekDaysInvalid?C.sub:C.white}}>저장</button>
          </div>
        </ModalWrap>
      )}

      {catModal&&(
        <ModalWrap onClose={()=>setCatModal(null)} isMobile={isMobile}>
          <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16}}>🍅 분류 {catModal==="add"?"추가":"편집"}</div>
          <KoreanInput key={"emoji-"+(catModal?.id||"new")} style={inp} placeholder="이모지" value={catForm.emoji||""} onChange={v=>setCatForm(p=>({...p,emoji:v}))}/>
          <KoreanInput key={"name-"+(catModal?.id||"new")} style={inp} placeholder="분류 이름" value={catForm.name||""} onChange={v=>setCatForm(p=>({...p,name:v}))} autoFocus/>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {[C.rose,C.tomato,C.pink3,C.pink2,"#FFB347","#7EC8A4","#B39DDB","#64B5F6","#F06292","#4DB6AC"].map(c=><div key={c} onClick={()=>setCatForm(p=>({...p,color:c}))} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",outline:catForm.color===c?`3px solid ${c}`:"none",outlineOffset:2}}/>)}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            {catModal!=="add"&&<button onClick={()=>hideCat(catModal.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#fff3e0",color:"#E65100"}}>숨기기</button>}
            <button onClick={()=>setCatModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
            <button onClick={saveCat} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>저장</button>
          </div>
          {catModal!=="add"&&<div style={{marginTop:10,fontSize:11,color:C.sub,textAlign:"center"}}>💡 숨기기는 기록을 보존해요</div>}
        </ModalWrap>
      )}

      {shareCard&&(
        <ModalWrap onClose={()=>setShareCard(false)} zIndex={300} isMobile={isMobile}>
          <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16,textAlign:"center"}}>📸 오늘의 달성률 카드</div>
          <div ref={cardRef} style={{background:"linear-gradient(135deg,#fff0f3,#ffe4ec)",borderRadius:20,padding:"24px 20px",border:`2px solid ${C.border}`,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div><div style={{fontSize:18,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</div><div style={{fontSize:12,color:C.sub}}>{selDate}</div></div>
              <Ring pct={totalPctOn(selDate)} size={66} stroke={7} color={C.rose} bg={C.pink1}/>
            </div>
            {activeCats.map(cat=>{ const pct=catPctOn(cat.id,selDate); const items=(todos[cat.id]||[]).filter(t=>!t.archived&&itemAppliesOn(t,selDate)).map(t=>({...t,done:isDone(t,selDate)})); if(!items.length) return null; return (
              <div key={cat.id} style={{background:"rgba(255,255,255,0.7)",borderRadius:12,padding:"10px 14px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:6}}><span>{cat.emoji}</span><span style={{fontSize:13,fontWeight:700}}>{cat.name}</span></div><span style={{fontSize:13,fontWeight:800,color:cat.color}}>{pct}%</span></div>
                <div style={{height:7,borderRadius:99,background:C.pink1,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:cat.color}}/></div>
              </div>
            );})}
            <div style={{marginTop:14,textAlign:"center",fontSize:12,color:C.sub,fontWeight:600}}>{totalPctOn(selDate)===100?"🎉 오늘 모두 완료! 최고예요!":totalPctOn(selDate)>=50?"🌸 절반 이상 달성!":"🍅 오늘도 화이팅!"}</div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <button onClick={()=>{ const card=cardRef.current; if(!card) return; import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(()=>{ window.html2canvas(card,{scale:2}).then(canvas=>{ const a=document.createElement("a"); a.download=`짠토_${selDate}.png`; a.href=canvas.toDataURL(); a.click(); }); }).catch(()=>alert("카드를 길게 눌러 저장해봐요!")); }} style={{padding:"10px 22px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>💾 이미지 저장</button>
            <button onClick={()=>setShareCard(false)} style={{padding:"10px 18px",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>닫기</button>
          </div>
        </ModalWrap>
      )}
    </div>
  );
}
