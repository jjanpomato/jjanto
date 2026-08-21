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
const MONTHS_KO = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

function genId()     { return Math.random().toString(36).slice(2,9); }
function fmtDate(d)  { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function isSame(a,b) { return fmtDate(new Date(a))===fmtDate(new Date(b)); }

function getWeekOfMonthMon(ds) {
  const d = new Date(ds);
  const y = d.getFullYear(), m = d.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const firstOffset = (firstDay + 6) % 7;
  const dayOfMonth = d.getDate();
  return Math.ceil((dayOfMonth + firstOffset) / 7);
}

// 💡 [새로운 기능] 특정 날짜가 속한 주의 '월요일 날짜'를 구하는 헬퍼 함수 (이번 주 할 일 달성 기록용)
function getMonday(ds) {
  const d = new Date(ds);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  return fmtDate(mon);
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
const tom      = fmtDate(new Date(today.getFullYear(),today.getMonth(),today.getDate()+1));

const INIT_EVENTS = [
  {id:genId(),title:"팀 스탠드업",date:todayStr,time:"09:00",color:"#FF85A1",catId:"work",    done:false},
  {id:genId(),title:"점심 약속",  date:todayStr,time:"12:30",color:"#B39DDB",catId:"personal",done:false},
  {id:genId(),title:"주간 보고",  date:tom,     time:"15:00",color:"#FF85A1",catId:"work",    done:false},
];
const INIT_TODOS = {
  work:    [{id:genId(),title:"기획서 초안 작성",    date:todayStr,done:false},{id:genId(),title:"팀 미팅 준비",    date:todayStr,done:true}],
  economy: [{id:genId(),title:"주식 포트폴리오 확인",date:todayStr,done:false},{id:genId(),title:"월 가계부 정리",  date:todayStr,done:false}],
  fitness: [{id:genId(),title:"30분 조깅",          date:todayStr,done:true}, {id:genId(),title:"스트레칭 10분",   date:todayStr,done:false}],
  personal:[{id:genId(),title:"일기 쓰기",            date:todayStr,done:false},{id:genId(),title:"비타민 챙겨먹기",date:todayStr,done:true}],
  apptech: [{id:genId(),title:"캐시워크 걷기",        date:todayStr,done:true}, {id:genId(),title:"토스 행운복권",  date:todayStr,done:false}],
  event:   [{id:genId(),title:"쿠팡 할인쿠폰 확인",  date:todayStr,done:false}],
  weekly:  [{id:genId(),title:"화장실 청소하기", doneLog:{}}, {id:genId(),title:"밀린 인강 1개 듣기", doneLog:{}}], // 💡 이번 주 할 일 초기 데이터
};

function load(key,fb){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function save(key,v){ try{ localStorage.setItem(key,JSON.stringify(v)); }catch{} }

function isRoutine(item) {
  return !item.date;
}

function routineAppliesOn(item, ds) {
  if (item.startDate && ds < item.startDate) return false;
  if (item.endDate && ds > item.endDate) return false;
  const type = item.repeatType || "daily";
  if (type === "daily") return true;
  if (type === "weekly") {
    const dow = new Date(ds).getDay();
    return Array.isArray(item.weekDays) && item.weekDays.includes(dow);
  }
  if (type === "monthly") {
    const dom = new Date(ds).getDate();
    return item.monthDay === dom;
  }
  if (type === "alternate") {
    if (!item.startDate) return false;
    const start = new Date(item.startDate);
    const cur = new Date(ds);
    const diffDays = Math.round((cur - start) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays % 2 === 0;
  }
  return true;
}

function itemAppliesOn(item, ds) {
  if (item.date) return isSame(item.date, ds);
  return routineAppliesOn(item, ds);
}

function repeatLabel(item) {
  if (!isRoutine(item)) return null;
  if (item.endDate) {
    if (item.startDate === item.endDate) return item.startDate.slice(5).replace("-","/");
    return `${item.startDate.slice(5).replace("-","/")} ~ ${item.endDate.slice(5).replace("-","/")}`;
  }
  const type = item.repeatType || "daily";
  if (type === "daily") return "매일";
  if (type === "alternate") return "격일";
  if (type === "weekly") {
    const days = (item.weekDays||[]).slice().sort();
    const isWeekday = days.length===5 && [1,2,3,4,5].every(v=>days.includes(v));
    const isWeekend = days.length===2 && [0,6].every(v=>days.includes(v));
    if (isWeekday) return "매주 평일";
    if (isWeekend) return "매주 주말";
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
  if (type === "single") {
    delete n.startDate; delete n.endDate; delete n.repeatType; delete n.weekDays; delete n.monthDay; delete n.doneLog;
  } else if (type === "period") {
    delete n.date; delete n.done; delete n.weekDays; delete n.monthDay;
    n.repeatType = "daily";
  } else {
    delete n.date; delete n.done; delete n.endDate;
    if (n.repeatType !== "weekly") delete n.weekDays;
    if (n.repeatType !== "monthly") delete n.monthDay;
  }
  return n;
}

function KoreanInput({ value, onChange, style, placeholder, autoFocus, type="text" }) {
  const composing = useRef(false);
  return (
    <input
      type={type}
      defaultValue={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={style}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(e) => { composing.current = false; onChange(e.target.value); }}
      onChange={(e) => { if (!composing.current) onChange(e.target.value); }}
    />
  );
}

function KoreanTextarea({ value, onChange, style, placeholder, rows, onKeyDown }) {
  const composing = useRef(false);
  return (
    <textarea
      defaultValue={value}
      placeholder={placeholder}
      rows={rows}
      style={style}
      onKeyDown={onKeyDown}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(e) => { composing.current = false; onChange(e.target.value); }}
      onChange={(e) => { if (!composing.current) onChange(e.target.value); }}
    />
  );
}

function ModalWrap({children, onClose, zIndex=100, isMobile}) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.38)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex}} onClick={onClose}>
      <div style={{background:C.white,borderRadius:isMobile?"20px 20px 0 0":"20px",padding:26,width:isMobile?"100%":"390px",boxShadow:`0 20px 60px ${C.pink3}55`,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>{children}</div>
    </div>
  );
}

function Ring({pct,size=56,stroke=5,color=C.rose,bg=C.pink1}) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, off=circ-(pct/100)*circ;
  return (
    <svg width={size} height={size} style={{display:"block",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dashoffset .5s"}}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        style={{fontSize:size*.22,fontWeight:700,fill:color,fontFamily:"inherit"}}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function Bar({pct,color}) {
  return (
    <div style={{flex:1,height:6,borderRadius:99,background:C.pink1,overflow:"hidden"}}>
      <div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:color,transition:"width .5s"}}/>
    </div>
  );
}

const inp = {width:"100%",padding:"9px 12px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:12,fontFamily:"inherit",background:"#FFF8FA",color:C.text};

function TomatoRow({ count }) {
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:1,marginLeft:6}}>
      {Array.from({length:count}).map((_,i)=>(
        <span key={i} style={{fontSize:14,lineHeight:1,filter:"drop-shadow(0 1px 1px rgba(0,0,0,.1))",animation:`tomato-bounce ${0.4+i*0.15}s ease-in-out infinite alternate`}}>🍅</span>
      ))}
    </span>
  );
}

// 💡 [새로운 기능] 이번 주 할 일 박스 컴포넌트
function WeeklyPlanBox({ selDate, todos, toggleWeeklyTodo, openAddWeekly, openEditWeekly }) {
  const wTodos = (todos.weekly || []).filter(t => !t.archived);
  const mk = getMonday(selDate); // 선택된 날짜 기준 월요일
  const pct = wTodos.length ? Math.round((wTodos.filter(t => t.doneLog && t.doneLog[mk]).length / wTodos.length) * 100) : 0;

  return (
    <div style={{ background: "linear-gradient(135deg, #FFF9C4, #FFF59D)", borderRadius: 16, padding: "14px 16px", border: "1.5px solid #FBC02D", marginBottom: 16, boxShadow: "0 2px 10px rgba(251,192,45,0.15)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#F57F17", letterSpacing: "-0.5px" }}>이번 주 할 일</div>
            <div style={{ fontSize: 10, color: "#F57F17", opacity: 0.8, marginTop: 1 }}>주 1회만 체크하면 돼요!</div>
          </div>
        </div>
        <button onClick={openAddWeekly} style={{ background: "#F57F17", border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: C.white, fontWeight: 800, fontSize: 13 }}>＋ 추가</button>
      </div>
      
      {wTodos.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 99, background: "#FFF0B3", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: "#F57F17", transition: "width .5s" }}/>
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: "#F57F17", minWidth: 32, textAlign:"right" }}>{pct}%</span>
        </div>
      )}
      
      {wTodos.length === 0 && <div style={{ fontSize: 12, color: "#F57F17", textAlign: "center", padding: "10px 0", opacity: 0.7, fontWeight: 600 }}>우측 상단의 추가 버튼을 눌러보세요!</div>}
      
      <div style={{ display: "flex", flexDirection: "column" }}>
        {wTodos.map(item => {
          const isDone = !!(item.doneLog && item.doneLog[mk]);
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px dashed rgba(245,127,23,0.3)" }}>
              <input type="checkbox" checked={isDone} onChange={() => toggleWeeklyTodo(item.id, selDate)} style={{ width: 20, height: 20, accentColor: "#F57F17", cursor: "pointer", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, color: isDone ? "#BDBDBD" : C.text, textDecoration: isDone ? "line-through" : "none", fontWeight: isDone ? 400 : 700 }}>
                {item.title}
              </span>
              <button onClick={() => openEditWeekly(item)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#F57F17", padding: 0, opacity: .7 }}>✏️</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function WeekCard({ wn, weekMap, activeCats, todos, isDone, isMobile, y, m }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  
  const days = (weekMap[wn] || []).filter(ds => {
    const dow = new Date(ds).getDay();
    return dow >= 1 && dow <= 5;
  });

  function todosOnDate(ds) {
    return activeCats.flatMap(c =>
      (todos[c.id]||[]).filter(t => !t.archived && itemAppliesOn(t, ds))
      .map(t => ({ ...t, catId: c.id, done: isDone(t, ds) }))
    );
  }

  function weekStats() {
    let total = 0, done = 0;
    const catStats = {};
    activeCats.forEach(c => { catStats[c.id] = { total: 0, done: 0 }; });
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
    return { total, done, pct: total ? Math.round(done/total*100) : null, catStats };
  }

  function dayPct(ds) {
    const items = todosOnDate(ds);
    return items.length ? Math.round(items.filter(t=>t.done).length/items.length*100) : null;
  }

  function tomatoCount(pct) {
    if (pct === 100) return 3;
    if (pct !== null && pct >= 70) return 2;
    return 1;
  }

  async function saveImage() {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      await import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      const canvas = await window.html2canvas(cardRef.current, { scale: 2, backgroundColor: "#FFF3F1", useCORS: true });
      const a = document.createElement("a");
      a.download = `짠토_${y}년${MONTHS_KO[m]}_${wn}주차.png`;
      a.href = canvas.toDataURL();
      a.click();
    } catch {
      alert("카드를 길게 눌러 저장해봐요!");
    }
    setSaving(false);
  }

  const { total, done, pct, catStats } = weekStats();
  const isCurrentWeek = days.some(ds => ds === todayStr);
  const tc = tomatoCount(pct);

  return (
    <div style={{position:"relative"}}>
      <div ref={cardRef} style={{
        background: isCurrentWeek ? "linear-gradient(135deg,#FFF3F1,#FFE2D8)" : "linear-gradient(160deg,#FFF3F1,#FFE2D8)",
        borderRadius:20,
        border: isCurrentWeek ? `2px solid ${C.rose}` : `1.5px solid ${C.border}`,
        padding: isMobile?"16px":"22px 26px",
        boxShadow: isCurrentWeek ? `0 4px 20px ${C.rose}22` : `0 2px 8px ${C.pink1}`,
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:10,borderBottom:`1.5px dashed ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:24,filter:"drop-shadow(0 2px 3px rgba(200,50,30,.25))"}}>🍅</span>
            <div>
              <div style={{fontSize:15,fontWeight:900,color:C.rose,letterSpacing:"-0.3px"}}>짠토의 플래너</div>
              <div style={{fontSize:12,color:C.sub}}>주간 달성률 리포트</div>
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color:C.sub,background:C.white,borderRadius:10,padding:"4px 12px",border:`1px solid ${C.border}`}}>{y}년 {MONTHS_KO[m]}</div>
        </div>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:4}}>
            <span style={{fontSize:20,fontWeight:900,color:C.rose}}>{wn}주차</span>
            <TomatoRow count={tc}/>
            <span style={{fontSize:13,color:C.sub,marginLeft:4}}>
              {days[0]?.slice(5).replace("-","/")} ~ {days[days.length-1]?.slice(5).replace("-","/")}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:13,color:C.sub,fontWeight:600}}>{done}/{total} 완료</span>
            <Ring pct={pct||0} size={58} stroke={6} color={isCurrentWeek?C.rose:C.pink3} bg={C.pink1}/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:`repeat(${days.length},1fr)`,gap:6,marginBottom:16}}>
          {days.slice().sort((a,b)=>a.localeCompare(b)).map(ds => {
            const dp = dayPct(ds);
            const isToday = ds === todayStr;
            const dow = new Date(ds).getDay();
            return (
              <div key={ds} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                <span style={{fontSize:12,fontWeight:isToday?800:600,color:isToday?C.rose:[0,6].includes(dow)?C.pink3:C.sub}}>{DAYS_KO[dow]}</span>
                <div style={{width:"100%",height:isMobile?44:60,borderRadius:8,background:C.pink1,position:"relative",overflow:"hidden",border:isToday?`2px solid ${C.rose}`:"none"}}>
                  {dp!==null && (
                    <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${dp}%`,
                      background:isToday?`linear-gradient(180deg,${C.rose},${C.pink3})`:dp===100?"#7EC8A4":`linear-gradient(180deg,${C.pink3},${C.pink2})`,
                      borderRadius:6,transition:"height .5s"}}/>
                  )}
                </div>
                <span style={{fontSize:11,fontWeight:700,color:isToday?C.rose:dp===100?"#7EC8A4":C.sub}}>{dp===null?"—":dp+"%"}</span>
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
                <span style={{fontSize:13,fontWeight:700,color:C.text,minWidth:isMobile?38:52,flexShrink:0}}>{cat.name}</span>
                <Bar pct={cp} color={cat.color}/>
                <span style={{fontSize:13,fontWeight:800,color:cat.color,minWidth:32,textAlign:"right"}}>{cp}%</span>
                <span style={{fontSize:11,color:C.sub,minWidth:isMobile?30:38,textAlign:"right"}}>{cs.done}/{cs.total}</span>
              </div>
            );
          })}
        </div>

        <div style={{marginTop:12,textAlign:"center",fontSize:12,color:C.sub}}>🍅 짠토의 플래너 · {new Date().toLocaleDateString("ko-KR")} 기준</div>
      </div>

      <button onClick={saveImage} disabled={saving} style={{
        position:"absolute", bottom:14, right:isMobile?14:22,
        display:"flex",alignItems:"center",gap:5,
        padding:"6px 14px",borderRadius:20,
        background:saving?"#ccc":`linear-gradient(135deg,${C.pink3},${C.rose})`,
        color:C.white,border:"none",fontWeight:800,fontSize:13,
        cursor:saving?"default":"pointer",
        boxShadow:`0 2px 8px ${C.rose}55`,
        opacity:saving?0.7:1,
      }}>
        {saving ? "저장 중…" : "📸 저장"}
      </button>
    </div>
  );
}

function WeeklyView({ isMobile, curDate, setCurDate, todos, activeCats, isDone }) {
  const y = curDate.getFullYear(), m = curDate.getMonth();
  const lastDay = new Date(y, m+1, 0).getDate();
  const weekMap = {};
  for (let d = 1; d <= lastDay; d++) {
    const ds = fmtDate(new Date(y, m, d));
    const wn = getWeekOfMonthMon(ds);
    if (!weekMap[wn]) weekMap[wn] = [];
    weekMap[wn].push(ds);
  }
  const weeks = Object.keys(weekMap).map(Number).sort((a,b)=>a-b);

  return (
    <div style={{flex:1,overflow:"auto",padding:isMobile?"14px 14px 80px":"20px 28px"}}>
      <style>{`
        @keyframes tomato-bounce {
          from { transform: translateY(0px) rotate(-5deg); }
          to   { transform: translateY(-4px) rotate(5deg); }
        }
      `}</style>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()-1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>‹</button>
          <span style={{fontSize:17,fontWeight:800,color:C.rose}}>{y}년 {MONTHS_KO[m]}</span>
          <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()+1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>›</button>
        </div>
        <div style={{fontSize:13,color:C.sub,background:C.pink1,padding:"4px 10px",borderRadius:99,fontWeight:700}}>📅 월요일 기준 주차</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        {weeks.map(wn => (
          <WeekCard key={wn} wn={wn} weekMap={weekMap} activeCats={activeCats} todos={todos} isDone={isDone} isMobile={isMobile} y={y} m={m}/>
        ))}
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
  
  // 💡 이번 주 할 일 보관함 연동
  const weeklyArchived = (todos.weekly || []).filter(t => t.archived).map(t => ({
    ...t, catId: "weekly", catName: "이번 주 할 일", catEmoji: "🎯", catColor: "#F57F17"
  }));
  const allArchived = [...archivedItems, ...weeklyArchived];

  function restore(catId, id) {
    setTodosS(p => ({ ...p, [catId]: p[catId].map(t => t.id===id ? { ...t, archived:false } : t) }));
  }
  function deletePermanently(catId, id) {
    setTodosS(p => ({ ...p, [catId]: p[catId].filter(t => t.id!==id) }));
    setConfirmId(null);
  }

  const byCatIds = [...cats.map(c=>c.id), "weekly"];
  const byCat = byCatIds.map(cid => {
    const cat = cid === "weekly" ? {id: "weekly", name: "이번 주 할 일", emoji: "🎯", color: "#F57F17"} : cats.find(c=>c.id===cid);
    return { cat, items: allArchived.filter(t=>t.catId===cid) };
  }).filter(g => g.items.length > 0);

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
                      <span style={{fontSize:13,color:C.sub,flexShrink:0}}>{cat.id==="weekly"?"🎯":repeatIcon(item)}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,color:C.sub,textDecoration:"line-through",fontWeight:500}}>{item.title}</div>
                        {item.startDate && !item.endDate && <div style={{fontSize:11,color:C.sub,marginTop:2}}>{repeatLabel(item)} · {item.startDate} 부터 시작</div>}
                        {item.endDate && <div style={{fontSize:11,color:C.sub,marginTop:2}}>🗓️ 기간 할일 · {item.startDate} ~ {item.endDate}</div>}
                        {item.doneLog && Object.keys(item.doneLog).length > 0 && (
                          <div style={{fontSize:11,color:cat.color,marginTop:2}}>✅ 완료 기록 {Object.keys(item.doneLog).length}일</div>
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

function Sidebar({isMobile, view, setView, sideFilter, setSideFilter, activeCats, sideEvents, catById, weeks, weeklyPct, cats, showCat, events, openEditEvent, cloudCode, cloudStatus}) {
  return (
    <div style={{padding:"18px 14px",display:"flex",flexDirection:"column",gap:2,overflow:"auto",flex:1}}>
      {!isMobile&&<div style={{fontSize:19,fontWeight:800,color:C.rose,padding:"2px 6px 10px",display:"flex",alignItems:"center",gap:8}}>🍅 짠토의 플래너</div>}
      
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:12,fontSize:13,fontWeight:700,background:cloudCode?"linear-gradient(135deg,#E8F5E9,#F0FFF8)":"#FFF0F0",color:cloudCode?"#2E7D32":"#C62828",border:cloudCode?"1.5px solid #A5D6A7":"1.5px solid #FFB3B3",marginBottom:6}}>
        <span>{cloudCode?"☁️":"⚠️"}</span> 
        <div style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
          {cloudCode ? `방: ${cloudCode}` : "URL에 ?room=코드 필요"}
        </div>
        <span style={{fontSize:10,opacity:.8}}>{cloudCode?"실시간 연결중":"로컬 모드"}</span>
      </div>

      {!isMobile&&[["month","🗓️","월간 캘린더"],["list","✅","할 일 목록"],["weekly","📊","주간 달성률"],["memo","🗒️","메모"],["archive","📦","루틴 보관함"]].map(([v,ic,lb])=>(
        <button key={v} onClick={()=>setView(v)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:12,cursor:"pointer",fontSize:14,fontWeight:view===v?700:500,background:view===v?C.rose:"transparent",color:view===v?C.white:C.sub,border:"none",width:"100%",textAlign:"left"}}>
          <span>{ic}</span>{lb}
        </button>
      ))}
      <div style={{margin:"12px 0 6px",fontSize:11,fontWeight:800,color:C.sub,padding:"0 6px"}}>오늘 일정 🍅</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        <button onClick={()=>setSideFilter("all")} style={{padding:"3px 9px",borderRadius:99,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:sideFilter==="all"?C.rose:C.pink1,color:sideFilter==="all"?C.white:C.sub}}>전체</button>
        {activeCats.map(cat=><button key={cat.id} onClick={()=>setSideFilter(sideFilter===cat.id?"all":cat.id)} style={{padding:"3px 8px",borderRadius:99,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:sideFilter===cat.id?cat.color:C.pink1,color:sideFilter===cat.id?C.white:C.sub}}>{cat.emoji}</button>)}
      </div>
      <div style={{background:C.white,borderRadius:12,padding:"10px 12px",border:`1px solid ${C.border}`,minHeight:60}}>
        {sideEvents.length===0&&<div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"6px 0"}}>일정이 없어요</div>}
        {sideEvents.map(e=>{ const cat=catById(e.catId); const isMulti = e.endDate && e.endDate > e.date; return (
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,cursor:"pointer"}} onClick={()=>openEditEvent(e)}>
            <span style={{fontSize:13}}>{cat?.emoji||"📌"}</span>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontSize:12,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.repeatMonthly&&"🔁 "}{e.title}</div>
              {isMulti ? <div style={{fontSize:10,color:C.sub}}>{e.date.slice(5).replace("-","/")}~{e.endDate.slice(5).replace("-","/")}</div> : <div style={{fontSize:10,color:C.sub}}>{e.repeatMonthly?"매월 고정":(e.time||"종일")}</div>}
            </div>
            <span style={{width:7,height:7,borderRadius:"50%",background:e.color,flexShrink:0}}/>
          </div>
        );})}
      </div>
      <div style={{margin:"12px 0 6px",fontSize:11,fontWeight:800,color:C.sub,padding:"0 6px"}}>주차별 달성률 📊</div>
      <div style={{background:C.white,borderRadius:12,padding:"10px 12px",border:`1px solid ${C.border}`}}>
        {weeks.map(w=>{ const pct=weeklyPct(w,null); return (
          <div key={w} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{fontSize:11,fontWeight:700,color:C.sub}}>{w}주차</span>
              <span style={{fontSize:11,fontWeight:800,color:C.rose}}>{pct===null?"—":pct+"%"}</span>
            </div>
            <Bar pct={pct||0} color={C.rose}/>
            <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
              {activeCats.map(cat=>{ const cp=weeklyPct(w,cat.id); return cp===null?null:(
                <div key={cat.id} style={{display:"flex",alignItems:"center",gap:3}}>
                  <span style={{fontSize:10}}>{cat.emoji}</span>
                  <div style={{width:32,height:4,borderRadius:99,background:C.pink1,overflow:"hidden"}}>
                    <div style={{width:`${cp}%`,height:"100%",background:cat.color,borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:9,color:cat.color,fontWeight:700}}>{cp}%</span>
                </div>
              );})}
            </div>
          </div>
        );})}
      </div>
      {cats.filter(c=>c.hidden).length>0&&(
        <div style={{marginTop:8}}>
          <div style={{fontSize:11,fontWeight:800,color:C.sub,padding:"0 6px 4px"}}>숨긴 분류</div>
          {cats.filter(c=>c.hidden).map(c=><button key={c.id} onClick={()=>showCat(c.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:C.pink1,border:"none",cursor:"pointer",fontSize:12,color:C.sub,marginBottom:3,width:"100%"}}>{c.emoji} {c.name}<span style={{marginLeft:"auto",fontSize:10,color:C.rose}}>복원</span></button>)}
        </div>
      )}
      <div style={{marginTop:"auto",paddingTop:10,fontSize:11,color:C.sub,textAlign:"center"}}>총 {events.length}개 일정 🍓</div>
    </div>
  );
}

function MonthView({isMobile, cells, eventsOn, allTodosOn, selDate, todayStr, setSelDate, setMobileTab, openEditEvent}) {
  return (
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:C.white,borderBottom:`1px solid ${C.border}`}}>
        {DAYS_KO.map((d,i)=><div key={d} style={{padding:isMobile?"6px 0":"9px 0",textAlign:"center",fontSize:isMobile?13:15,fontWeight:800,color:[0,6].includes(i)?C.rose:C.sub}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",flex:1,overflow:"auto",background:C.bg}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={i} style={{background:"#fff8fa",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}/>;
          const ds=fmtDate(day),isToday=isSame(ds,todayStr),isSel=ds===selDate;
          const dayEvs=eventsOn(ds),maxEvs=isMobile?1:3;
          const a=allTodosOn(ds), dPct=a.length?Math.round(a.filter(t=>t.done).length/a.length*100):null;
          const isPerfectDay = a.length>0 && dPct===100;
          return (
            <div key={i} onClick={()=>{ setSelDate(ds); if(isMobile) setMobileTab("today"); }} style={{position:"relative",padding:isMobile?"4px 3px":"6px 7px",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,minHeight:isMobile?62:96,cursor:"pointer",background:isSel?"#fff0f3":isToday?"#fff8fb":C.white}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:isMobile?23:27,height:isMobile?23:27,borderRadius:"50%",fontSize:isMobile?13:15,fontWeight:isToday?800:600,background:isToday?C.rose:"transparent",color:isToday?C.white:[0,6].includes(day.getDay())?C.pink3:C.text}}>{day.getDate()}</div>
                {dPct!==null&&!isMobile&&<span style={{fontSize:11,fontWeight:700,color:C.sub,background:C.pink1,borderRadius:99,padding:"1px 6px"}}>{dPct}%</span>}
              </div>
              {dayEvs.slice(0,maxEvs).map(e=>{ const isStart=isSame(e.date,ds); return (
                <div key={e.id} onClick={ev=>{ev.stopPropagation();openEditEvent(e);}} style={{padding:isMobile?"1px 4px":"2px 6px",borderRadius:6,fontSize:isMobile?10:12,fontWeight:600,background:e.color+"22",color:e.color,marginTop:2,overflow:"hidden",whiteSpace:"nowrap",cursor:"pointer"}}>
                  {e.repeatMonthly ? `🔁 ${e.title}` : (isStart?e.title:(isMobile?"↔":"↔ "+e.title))}
                </div>
              );})}
              {dayEvs.length>maxEvs&&<div style={{fontSize:10,color:C.sub,marginTop:1}}>+{dayEvs.length-maxEvs}</div>}
              {isPerfectDay && (
                <span title="오늘 100% 달성!" style={{position:"absolute",bottom:isMobile?2:4,right:isMobile?2:4,fontSize:isMobile?14:18,filter:"drop-shadow(0 1px 2px rgba(200,50,30,.35))",lineHeight:1}}>🍅</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 💡 [새로운 기능] ListView에 이번 주 할 일 컴포넌트 추가
function ListView({isMobile, selDate, setSelDate, todayStr, allTodosOn, totalPctOn, catPctOn, activeCats, todos, visibleTodosOn, openAddTodo, openEditTodo, toggleTodo, hideCompleted, setHideCompleted, setCatForm, setCatModal, setShareCard, onMoveCat, toggleWeeklyTodo, openAddWeekly, openEditWeekly}) {
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
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:800}}>‹</button>
          <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{border:`1.5px solid ${C.border}`,borderRadius:10,padding:"6px 10px",fontSize:13,color:C.text,background:C.white,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:800}}>›</button>
          <button onClick={()=>setSelDate(todayStr)} style={{background:C.pink2,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
        </div>
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
      </div>
      
      {/* 💡 [새로운 기능] 이번 주 할 일 표시 */}
      <WeeklyPlanBox selDate={selDate} todos={todos} toggleWeeklyTodo={toggleWeeklyTodo} openAddWeekly={openAddWeekly} openEditWeekly={openEditWeekly} />

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
              key={cat.id} 
              draggable 
              onDragStart={(e)=>handleDragStart(e, index)}
              onDragEnter={(e)=>handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e)=>e.preventDefault()}
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
    </div>
  );
}

// 💡 [새로운 기능] TodayMobileView에 이번 주 할 일 컴포넌트 추가
function TodayMobileView({selDate, setSelDate, todayStr, eventsOn, catById, allTodosOn, totalPctOn, catPctOn, activeCats, todos, visibleTodosOn, toggleTodo, openAddTodo, openAddEvent, hideCompleted, setHideCompleted, cloudCode, toggleWeeklyTodo, openAddWeekly, openEditWeekly}) {
  const evs=eventsOn(selDate);
  return (
    <div style={{flex:1,overflow:"auto",padding:"14px 14px 80px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
        <div><div style={{fontSize:18,fontWeight:800,color:C.rose}}>{selDate===todayStr?"오늘":selDate}</div><div style={{fontSize:12,color:C.sub}}>{new Date(selDate).toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"short"})}</div></div>
        <div style={{display:"flex",gap:6}}>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.rose,fontWeight:800}}>‹</button>
          <button onClick={()=>setSelDate(todayStr)} style={{background:C.pink2,border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
          <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",color:C.rose,fontWeight:800}}>›</button>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,background:C.white,borderRadius:16,padding:"12px 16px",border:`1.5px solid ${C.border}`,marginBottom:14}}>
        <Ring pct={totalPctOn(selDate)} size={52} stroke={5} color={C.rose} bg={C.pink1}/>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,color:C.rose}}>총 달성률</div><div style={{fontSize:12,color:C.sub}}>{allTodosOn(selDate).filter(t=>t.done).length}/{allTodosOn(selDate).length} 완료</div></div>
        <div style={{background:cloudCode?"#E8F5E9":"#FFF0F0",border:cloudCode?"1.5px solid #A5D6A7":"1.5px solid #FFB3B3",borderRadius:10,padding:"7px 12px",color:cloudCode?"#2E7D32":"#C62828",fontWeight:800,fontSize:12}}>{cloudCode?"☁️ 연동중":"⚠️ 로컬"}</div>
      </div>
      
      {/* 💡 [새로운 기능] 모바일 오늘 탭 이번 주 할 일 표시 */}
      <WeeklyPlanBox selDate={selDate} todos={todos} toggleWeeklyTodo={toggleWeeklyTodo} openAddWeekly={openAddWeekly} openEditWeekly={openEditWeekly} />

      {evs.length>0&&<><div style={{fontSize:12,fontWeight:800,color:C.sub,marginBottom:8}}>📅 일정</div>{evs.map(e=>{ const cat=catById(e.catId); const isMulti = e.endDate && e.endDate > e.date; return <div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:C.white,borderRadius:12,marginBottom:6,border:`1.5px solid ${e.color}33`,cursor:"pointer"}}><span style={{fontSize:18}}>{cat?.emoji||"📌"}</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{e.repeatMonthly&&"🔁 "}{e.title}</div><div style={{fontSize:11,color:C.sub}}>{isMulti ? `${e.date.slice(5).replace("-","/")} ~ ${e.endDate.slice(5).replace("-","/")}${e.time ? " ("+e.time+")" : ""}` : (e.repeatMonthly?"매월 고정":(e.time||"종일"))}</div></div></div>; })}</>}
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
      <button onClick={()=>openAddEvent(selDate)} style={{width:"100%",padding:"13px",borderRadius:14,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:4}}>🍅 일정 추가</button>
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
          <KoreanTextarea
            value={draft}
            onChange={setDraft}
            onKeyDown={e=>{ if(e.key==="Escape") cancel(); }}
            rows={4}
            style={{width:"100%",padding:"8px 10px",border:`1.5px solid ${C.border}`,borderRadius:10,fontSize:14,outline:"none",fontFamily:"inherit",background:"#FFF8FA",color:C.text,resize:"none",lineHeight:1.6,boxSizing:"border-box",marginBottom:10}}
          />
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
  const fileRef = useRef(null);

  function handleAdd() {
    if(!memoInput.trim() && !memoImg) return;
    addMemo(memoImg);
    setMemoImg(null);
  }

  function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (file) compressImage(file, setMemoImg);
    e.target.value = "";
  }

  return (
    <div style={{flex:1,overflow:"auto",padding:isMobile?"14px 14px 80px":"20px 24px"}}>
      <div style={{maxWidth:600,margin:"0 auto"}}>
        <div style={{fontSize:18,fontWeight:800,color:C.rose,marginBottom:16}}>🗒️ 메모</div>
        
        {memoImg && (
          <div style={{position:"relative",display:"inline-block",marginBottom:10}}>
            <img src={memoImg} alt="preview" style={{maxHeight:120,borderRadius:8,border:`1.5px solid ${C.border}`}}/>
            <button onClick={()=>setMemoImg(null)} style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",color:"white",border:"none",borderRadius:"50%",width:22,height:22,cursor:"pointer",fontSize:12,fontWeight:"bold"}}>✕</button>
          </div>
        )}

        <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"flex-end"}}>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
            <KoreanTextarea
              key={memos.length}
              value={memoInput}
              onChange={setMemoInput}
              onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); handleAdd(); } }}
              placeholder="메모를 입력하세요... (Enter로 저장)"
              rows={3}
              style={{width:"100%",padding:"10px 14px",border:`1.5px solid ${C.border}`,borderRadius:14,fontSize:14,outline:"none",fontFamily:"inherit",background:"#FFF8FA",color:C.text,resize:"none",lineHeight:1.6,boxSizing:"border-box"}}
            />
            <div style={{display:"flex",justifyContent:"flex-start"}}>
              <button onClick={()=>fileRef.current?.click()} style={{padding:"6px 12px",borderRadius:10,background:C.pink1,color:C.rose,border:`1px solid ${C.border}`,fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}>
                <span>📷</span> 사진 첨부
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleImageSelect}/>
            </div>
          </div>
          <button onClick={handleAdd} style={{padding:"10px 18px",borderRadius:14,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:14,cursor:"pointer",flexShrink:0,height:52}}>저장</button>
        </div>

        {memos.length===0&&(
          <div style={{textAlign:"center",padding:"40px 0",color:C.sub,fontSize:14}}>
            <div style={{fontSize:36,marginBottom:8}}>🗒️</div>메모가 없어요. 사진이나 글을 남겨봐요!
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {memos.map(m=>(
            <MemoCard key={m.id} m={m} editMemo={editMemo} deleteMemo={deleteMemo}/>
          ))}
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
    if (roomParam) {
      save("jjanto_cloud_code", roomParam);
      return roomParam;
    }
    return load("jjanto_cloud_code", "");
  });

  const [view,      setView]      = useState("month");
  const [mobileTab, setMobileTab] = useState("month");
  const [curDate,   setCurDate]   = useState(new Date(today.getFullYear(),today.getMonth(),1));
  const [selDate,   setSelDate]   = useState(todayStr);
  const [events,    setEvents]    = useState(()=>load("jjanto_events",INIT_EVENTS));
  const [todos,     setTodos]     = useState(()=>{
    const loaded = load("jjanto_todos", INIT_TODOS);
    const cleaned = {};
    Object.keys(loaded).forEach(cid=>{
      cleaned[cid] = (loaded[cid]||[]).map(t=>{
        // 이번 주 할 일 (weekly) 배열 처리 방어 코드
        if (cid === "weekly") return t; 
        const type = t.date ? "single" : t.endDate ? "period" : "routine";
        return cleanTodoItem(t, type);
      });
    });
    // weekly 초기값이 없으면 넣어주기
    if (!cleaned.weekly) cleaned.weekly = INIT_TODOS.weekly;
    return cleaned;
  });
  const [cats,      setCats]      = useState(()=>load("jjanto_cats",  CAT_DEFAULTS));
  const [sideOpen,  setSideOpen]  = useState(true);
  const [hideCompleted,setHideCompleted]=useState({});
  const [sideFilter,setSideFilter]=useState("all");
  const [shareCard, setShareCard] =useState(false);
  const [memos,     setMemos]     =useState(()=>load("jjanto_memos",[]));
  const [memoInput, setMemoInput] =useState("");
  const cardRef=useRef(null);
  
  // 💡 [새로운 기능] 이번 주 할 일 모달 상태
  const [weeklyModal, setWeeklyModal] = useState(null); // null | {mode: 'add'} | {mode: 'edit', item}
  const [weeklyFormTitle, setWeeklyFormTitle] = useState("");

  const [modal,  setModal] =useState(null);
  const [form,   setForm]  =useState({});
  const [todoModal, setTodoModal] =useState(null);
  const [todoForm,  setTodoForm]  = useState({title:"", type:"single", date:"",startDate:todayStr,endDate:todayStr, repeatType:"daily",weekDays:[],monthDay:1});
  const [catModal,  setCatModal]  =useState(null);
  const [catForm,   setCatForm]   =useState({name:"",emoji:"⭐",color:C.pink3});
  
  const [cloudStatus,setCloudStatus]= useState(null);

  const isLocalUpdating = useRef(false);
  const stateRef = useRef({ events, todos, cats, memos });
  stateRef.current = { events, todos, cats, memos };
  const syncTimer = useRef(null);

  useEffect(() => {
    if (!cloudCode) return;
    setCloudStatus({ type: "warn", text: "☁️ 실시간 클라우드 연결 중..." });
    const unsubscribe = subscribePlannerData(
      cloudCode,
      (remoteData) => {
        if (isLocalUpdating.current) {
          isLocalUpdating.current = false;
          return;
        }
        if (remoteData) {
          if (remoteData.events) { setEvents(remoteData.events); save("jjanto_events", remoteData.events); }
          if (remoteData.todos)  { setTodos(remoteData.todos);   save("jjanto_todos", remoteData.todos); }
          if (remoteData.cats)   { setCats(remoteData.cats);     save("jjanto_cats", remoteData.cats); }
          if (remoteData.memos)  { setMemos(remoteData.memos);   save("jjanto_memos", remoteData.memos); }
          setCloudStatus({ type: "ok", text: `☁️ 실시간 연동 중 (${new Date().toLocaleTimeString("ko-KR", { timeStyle: "short" })})` });
        } else {
          setCloudStatus({ type: "ok", text: "💡 새로운 방이 생성되었습니다. 입력 시 자동 저장됩니다." });
        }
      },
      (err) => {
        setCloudStatus({ type: "err", text: "❌ 연결 끊김 (로컬 모드)" });
      }
    );
    return () => unsubscribe();
  }, [cloudCode]);

  function triggerAutoSave() {
    if (!cloudCode) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    setCloudStatus({ type: "warn", text: "☁️ 변경 사항 저장 중..." });
    syncTimer.current = setTimeout(async () => {
      try {
        isLocalUpdating.current = true;
        const payload = {
          ...stateRef.current,
          updatedAt: new Date().toISOString(),
        };
        await pushPlannerData(cloudCode, payload);
        setCloudStatus({ 
          type: "ok", 
          text: `☁️ 실시간 연동 중 (${new Date().toLocaleTimeString("ko-KR", { timeStyle: "short" })})` 
        });
      } catch (err) {
        isLocalUpdating.current = false;
        setCloudStatus({ type: "err", text: "❌ 저장 실패! 네트워크 확인 필요" });
      }
    }, 1200);
  }

  const setEventsS=v=>{ const n=typeof v==="function"?v(events):v; setEvents(n); save("jjanto_events",n); triggerAutoSave(); };
  const setTodosS =v=>{ const n=typeof v==="function"?v(todos):v;  setTodos(n);  save("jjanto_todos",n);  triggerAutoSave(); };
  const setCatsS  =v=>{ const n=typeof v==="function"?v(cats):v;   setCats(n);   save("jjanto_cats",n);   triggerAutoSave(); };
  const setMemosS =v=>{ const n=typeof v==="function"?v(memos):v;  setMemos(n);  save("jjanto_memos",n);  triggerAutoSave(); };

  // 💡 [새로운 기능] 이번 주 할 일 조작 함수들
  function toggleWeeklyTodo(id, ds) {
    const mk = getMonday(ds);
    setTodosS(p => {
      const w = p.weekly || [];
      return {
        ...p,
        weekly: w.map(t => {
          if (t.id !== id) return t;
          const log = { ...(t.doneLog || {}) };
          if (log[mk]) delete log[mk]; else log[mk] = true;
          return { ...t, doneLog: log };
        })
      };
    });
  }

  function openAddWeekly() {
    setWeeklyFormTitle("");
    setWeeklyModal({ mode: "add" });
  }

  function openEditWeekly(item) {
    setWeeklyFormTitle(item.title);
    setWeeklyModal({ mode: "edit", item });
  }

  function saveWeekly() {
    if (!weeklyFormTitle.trim()) return;
    if (weeklyModal.mode === "add") {
      const newItem = { id: genId(), title: weeklyFormTitle.trim(), doneLog: {} };
      setTodosS(p => ({ ...p, weekly: [...(p.weekly || []), newItem] }));
    } else {
      setTodosS(p => ({
        ...p,
        weekly: (p.weekly || []).map(t => t.id === weeklyModal.item.id ? { ...t, title: weeklyFormTitle.trim() } : t)
      }));
    }
    setWeeklyModal(null);
  }

  function deleteWeekly(id) {
    setTodosS(p => {
      const w = p.weekly || [];
      const item = w.find(t => t.id === id);
      if (item && Object.keys(item.doneLog || {}).length > 0) {
        return { ...p, weekly: w.map(t => t.id === id ? { ...t, archived: true } : t) };
      }
      return { ...p, weekly: w.filter(t => t.id !== id) };
    });
    setWeeklyModal(null);
  }

  function handleMoveCat(fromIndex, toIndex) {
    const active = cats.filter(c=>!c.hidden);
    const hidden = cats.filter(c=>c.hidden);
    const updatedActive = [...active];
    const [moved] = updatedActive.splice(fromIndex, 1);
    updatedActive.splice(toIndex, 0, moved);
    setCatsS([...updatedActive, ...hidden]);
  }

  function addMemo(imgData = null) {
    if(!memoInput.trim() && !imgData) return;
    setMemosS(p=>[{id:genId(), text:memoInput.trim(), image:imgData, createdAt:new Date().toISOString()}, ...p]);
    setMemoInput("");
  }
  function editMemo(id, text, imgData) { 
    setMemosS(p=>p.map(m=>m.id===id?{...m,text,image:imgData,updatedAt:new Date().toISOString()}:m)); 
  }
  function deleteMemo(id) { setMemosS(p=>p.filter(m=>m.id!==id)); }

  const activeCats=cats.filter(c=>!c.hidden);
  const catById=id=>cats.find(c=>c.id===id);
  const isDone=(item,ds)=>item.date ? item.done : !!(item.doneLog && item.doneLog[ds]);
  const allTodosOn=ds=>activeCats.flatMap(c=>
    (todos[c.id]||[]).filter(t=>!t.archived && itemAppliesOn(t, ds))
    .map(t=>({...t,done:isDone(t,ds)}))
  );

  const visibleTodosOn=(cid,ds)=>(todos[cid]||[]).filter(t=>!t.archived&&itemAppliesOn(t, ds)).map(t=>({...t,done:isDone(t,ds)}));
  const totalPctOn=ds=>{ const a=allTodosOn(ds); return a.length?Math.round(a.filter(t=>t.done).length/a.length*100):0; };

  const catPctOn=(cid,ds)=>{
    const i=(todos[cid]||[]).filter(t=>!t.archived && itemAppliesOn(t, ds));
    return i.length?Math.round(i.filter(t=>isDone(t,ds)).length/i.length*100):0;
  };

  function weeklyPct(wn, cid) {
    const y=curDate.getFullYear(), m=curDate.getMonth(), last=new Date(y,m+1,0).getDate();
    let done=0, total=0;
    for(let d=1; d<=last; d++) {
      const ds = fmtDate(new Date(y,m,d));
      if(getWeekOfMonthMon(ds) !== wn) continue;
      
      const dow = new Date(ds).getDay();
      if(dow === 0 || dow === 6) continue;

      const catList = cid ? [cid] : activeCats.map(c=>c.id);
      catList.forEach(cId => {
        const items = (todos[cId]||[]).filter(t => !t.archived && itemAppliesOn(t, ds));
        items.forEach(t => {
          total++;
          if(isDone(t, ds)) done++;
        });
      });
    }
    return total ? Math.round(done/total*100) : null;
  }

  function weeksInMonth(){
    const y=curDate.getFullYear(),m=curDate.getMonth(),last=new Date(y,m+1,0).getDate();
    const ws=new Set();
    for(let d=1;d<=last;d++) ws.add(getWeekOfMonthMon(fmtDate(new Date(y,m,d))));
    return [...ws].sort();
  }

  const eventsOn = ds => events.filter(e => {
    if (e.repeatMonthly) {
      const startDay = new Date(e.date).getDate();
      const curDateObj = new Date(ds);
      const curDay = curDateObj.getDate();
      const lastDayOfCurMonth = new Date(curDateObj.getFullYear(), curDateObj.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(startDay, lastDayOfCurMonth);
      return ds >= e.date && curDay === targetDay;
    }
    const hasEnd = e.endDate && e.endDate >= e.date;
    return hasEnd ? (ds >= e.date && ds <= e.endDate) : isSame(e.date, ds);
  }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));

  function openAddEvent(date){ 
    const fc=activeCats[0]; 
    setForm({
      title:"", date:date||selDate||todayStr, endDate:"", time:"",
      isPeriod:false, allDay:false, repeatMonthly:false, catId:fc?.id||"", color:fc?.color||C.pink3, done:false
    }); 
    setModal("addEvent"); 
  }

  function openEditEvent(e){ 
    setForm({ ...e, isPeriod: !!(e.endDate && e.endDate > e.date), repeatMonthly: !!e.repeatMonthly }); 
    setModal("editEvent"); 
  }

  function saveEvent(){
    if(!form.title.trim()) return;
    const cat=catById(form.catId);
    const end = (form.isPeriod && !form.repeatMonthly) ? (form.endDate || form.date) : "";
    const c={...form, endDate:end, color:cat?.color||form.color};
    if(modal==="addEvent"){
      setEventsS(p=>[...p,{...c,id:genId()}]);
      if(form.catId){
        if(form.isPeriod && !form.repeatMonthly && end && end > form.date){
          const newTodo={id:genId(), title:form.title.trim(), date:"", startDate:form.date, endDate:end, repeatType:"daily", doneLog:{}};
          setTodosS(p=>({...p,[form.catId]:[...(p[form.catId]||[]), newTodo]}));
        } else if(!form.repeatMonthly) {
          const newTodo={id:genId(), title:form.title.trim(), date:form.date, done:false};
          setTodosS(p=>({...p,[form.catId]:[...(p[form.catId]||[]), newTodo]}));
        }
      }
    } else {
      setEventsS(p=>p.map(e=>e.id===form.id?{...c}:e));
    }
    setModal(null);
  }

  function deleteEvent(id){ setEventsS(p=>p.filter(e=>e.id!==id)); setModal(null); }

  function openAddTodo(cid){ 
    setTodoForm({
      title:"", type:"single", date:selDate, startDate:selDate||todayStr,
      endDate:selDate||todayStr, repeatType:"daily", weekDays:[], monthDay:1
    }); 
    setTodoModal({mode:"add",catId:cid}); 
  }
  
  function openEditTodo(cid,item){ 
    setTodoForm({
      title:item.title, type: item.date ? "single" : item.endDate ? "period" : "routine",
      date:item.date||"", startDate:item.startDate||todayStr, endDate:item.endDate||item.startDate||todayStr,
      repeatType:item.repeatType||"daily", weekDays:item.weekDays||[], monthDay:item.monthDay||1
    }); 
    setTodoModal({mode:"edit",catId:cid,item}); 
  }
  
  function saveTodo(){
    if(!todoForm.title.trim()) return;
    const {mode,catId,item}=todoModal;
    let base;
    if (todoForm.type === "single") {
      base = { title: todoForm.title, date: todoForm.date, done: item?.done || false };
    } else if (todoForm.type === "period") {
      base = { title: todoForm.title, date: "", startDate: todoForm.startDate, endDate: todoForm.endDate || todoForm.startDate, repeatType: "daily" };
    } else {
      base = { title: todoForm.title, date: "", startDate: todoForm.startDate, repeatType: todoForm.repeatType||"daily" };
      if (todoForm.repeatType==="weekly") base.weekDays = todoForm.weekDays||[];
      if (todoForm.repeatType==="monthly") base.monthDay = todoForm.monthDay||1;
    }

    if(mode==="add") setTodosS(p=>({...p,[catId]:[...(p[catId]||[]),cleanTodoItem({id:genId(),...base,doneLog:{}},todoForm.type)]}));
    else setTodosS(p=>({...p,[catId]:p[catId].map(t=>t.id===item.id?cleanTodoItem({...t,...base},todoForm.type):t)}));
    setTodoModal(null);
  }

  function deleteTodo(cid,id){
    const item=(todos[cid]||[]).find(t=>t.id===id);
    if(item && !item.date) {
      setTodosS(p=>({...p,[cid]:p[cid].map(t=>t.id===id?{...t,archived:true}:t)}));
    } else {
      setTodosS(p=>({...p,[cid]:p[cid].filter(t=>t.id!==id)}));
    }
    setTodoModal(null);
  }
  function toggleTodo(cid,id,ds){
    setTodosS(p=>({...p,[cid]:p[cid].map(t=>{
      if(t.id!==id) return t;
      if(t.date) return {...t,done:!t.done};
      const log={...(t.doneLog||{})};
      if(log[ds]) delete log[ds]; else log[ds]=true;
      return {...t,doneLog:log};
    })}));
  }
  function saveCat(){ if(!catForm.name.trim()) return; if(catModal==="add"){ const nid=genId(); setCatsS(p=>[...p,{id:nid,...catForm,hidden:false}]); setTodosS(p=>({...p,[nid]:[]})); } else setCatsS(p=>p.map(c=>c.id===catModal.id?{...c,...catForm}:c)); setCatModal(null); }
  function hideCat(id){ setCatsS(p=>p.map(c=>c.id===id?{...c,hidden:true}:c)); setCatModal(null); }
  function showCat(id){ setCatsS(p=>p.map(c=>c.id===id?{...c,hidden:false}:c)); }

  function buildGrid(){ const y=curDate.getFullYear(),m=curDate.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate(),cells=[]; for(let i=0;i<first;i++) cells.push(null); for(let d=1;d<=last;d++) cells.push(new Date(y,m,d)); return cells; }
  const cells=buildGrid(), weeks=weeksInMonth();
  const sideEvents=sideFilter==="all"?eventsOn(todayStr):eventsOn(todayStr).filter(e=>e.catId===sideFilter);

  // 💡 [새로운 기능] props에 이번 주 할 일 관련 함수 추가
  const commonProps = { isMobile, selDate, setSelDate, todayStr, allTodosOn, totalPctOn, catPctOn, activeCats, todos, visibleTodosOn, toggleTodo, openAddTodo, openAddEvent, eventsOn, catById, hideCompleted, setHideCompleted, cloudCode, toggleWeeklyTodo, openAddWeekly, openEditWeekly };
  const weeklyProps = { isMobile, curDate, setCurDate, todos, activeCats, isDone };
  const weekDaysInvalid = todoForm.type==="routine" && todoForm.repeatType==="weekly" && (!todoForm.weekDays||todoForm.weekDays.length===0);

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Nunito','Apple SD Gothic Neo',sans-serif",background:C.bg,color:C.text,overflow:"hidden",flexDirection:"column"}}>
      {!isMobile&&(
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          <aside style={{width:sideOpen?260:0,minWidth:sideOpen?260:0,background:"linear-gradient(160deg,#FFF3F1,#FFE2D8)",borderRight:`1.5px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden",transition:"all .25s",flexShrink:0}}>
            <Sidebar isMobile={isMobile} view={view} setView={setView} sideFilter={sideFilter} setSideFilter={setSideFilter} activeCats={activeCats} sideEvents={sideEvents} catById={catById} weeks={weeks} weeklyPct={weeklyPct} cats={cats} showCat={showCat} events={events} openEditEvent={openEditEvent} cloudCode={cloudCode} cloudStatus={cloudStatus}/>
          </aside>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderBottom:`1.5px solid ${C.border}`,background:C.white,flexWrap:"wrap"}}>
              <button onClick={()=>setSideOpen(p=>!p)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.rose}}>☰</button>
              <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()-1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>‹</button>
              <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()+1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>›</button>
              <span style={{fontSize:16,fontWeight:800,color:C.rose}}>{curDate.getFullYear()}년 {MONTHS_KO[curDate.getMonth()]}</span>
              <button onClick={()=>{setCurDate(new Date(today.getFullYear(),today.getMonth(),1));setSelDate(todayStr);}} style={{background:C.pink2,border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
              <div style={{flex:1}}/>
              {[["month","🗓 월간"],["list","✅ 할일"],["weekly","📊 주간"],["memo","🗒️ 메모"],["archive","📦 보관함"]].map(([v,lb])=>(
                <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:20,border:`2px solid ${view===v?C.rose:C.border}`,background:view===v?C.rose:C.white,color:view===v?C.white:C.sub,fontSize:12,cursor:"pointer",fontWeight:700}}>{lb}</button>
              ))}
              <button onClick={()=>openAddEvent(selDate)} style={{padding:"7px 16px",borderRadius:20,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:13,cursor:"pointer"}}>🍅 추가</button>
            </div>
            {view==="month"&&<MonthView isMobile={isMobile} cells={cells} eventsOn={eventsOn} allTodosOn={allTodosOn} selDate={selDate} todayStr={todayStr} setSelDate={setSelDate} setMobileTab={setMobileTab} openEditEvent={openEditEvent}/>}
            {view==="list"&&<ListView isMobile={isMobile} selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} allTodosOn={allTodosOn} totalPctOn={totalPctOn} catPctOn={catPctOn} activeCats={activeCats} todos={todos} visibleTodosOn={visibleTodosOn} openAddTodo={openAddTodo} openEditTodo={openEditTodo} toggleTodo={toggleTodo} hideCompleted={hideCompleted} setHideCompleted={setHideCompleted} setCatForm={setCatForm} setCatModal={setCatModal} setShareCard={setShareCard} onMoveCat={handleMoveCat} toggleWeeklyTodo={toggleWeeklyTodo} openAddWeekly={openAddWeekly} openEditWeekly={openEditWeekly} />}
            {view==="weekly"&&<WeeklyView {...weeklyProps}/>}
            {view==="memo"&&<MemoView isMobile={isMobile} memos={memos} memoInput={memoInput} setMemoInput={setMemoInput} addMemo={addMemo} editMemo={editMemo} deleteMemo={deleteMemo}/>}
            {view==="archive"&&<ArchiveView isMobile={isMobile} todos={todos} cats={cats} setTodosS={setTodosS}/>}
          </div>
        </div>
      )}

      {isMobile&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:C.white,borderBottom:`1.5px solid ${C.border}`,flexShrink:0}}>
            <span style={{fontSize:15,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</span>
            <div style={{display:"flex",gap:6}}>
              {(mobileTab==="month"||mobileTab==="weekly")&&<><button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()-1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 9px",cursor:"pointer",color:C.rose,fontWeight:700}}>‹</button><span style={{fontSize:13,fontWeight:800,color:C.rose}}>{curDate.getFullYear()}년 {MONTHS_KO[curDate.getMonth()]}</span><button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()+1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 9px",cursor:"pointer",color:C.rose,fontWeight:700}}>›</button></>}
              <button onClick={()=>openAddEvent(selDate)} style={{background:`linear-gradient(135deg,${C.pink3},${C.rose})`,border:"none",borderRadius:10,padding:"6px 12px",cursor:"pointer",color:C.white,fontWeight:800,fontSize:13}}>＋</button>
            </div>
          </div>
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {mobileTab==="month"&&<MonthView isMobile={isMobile} cells={cells} eventsOn={eventsOn} allTodosOn={allTodosOn} selDate={selDate} todayStr={todayStr} setSelDate={setSelDate} setMobileTab={setMobileTab} openEditEvent={openEditEvent}/>}
            {mobileTab==="list"&&<ListView isMobile={isMobile} selDate={selDate} setSelDate={setSelDate} todayStr={todayStr} allTodosOn={allTodosOn} totalPctOn={totalPctOn} catPctOn={catPctOn} activeCats={activeCats} todos={todos} visibleTodosOn={visibleTodosOn} openAddTodo={openAddTodo} openEditTodo={openEditTodo} toggleTodo={toggleTodo} hideCompleted={hideCompleted} setHideCompleted={setHideCompleted} setCatForm={setCatForm} setCatModal={setCatModal} setShareCard={setShareCard} onMoveCat={handleMoveCat} toggleWeeklyTodo={toggleWeeklyTodo} openAddWeekly={openAddWeekly} openEditWeekly={openEditWeekly} />}
            {mobileTab==="today"&&<TodayMobileView {...commonProps} openEditTodo={openEditTodo}/>}
            {mobileTab==="weekly"&&<WeeklyView {...weeklyProps}/>}
            {mobileTab==="memo"&&<MemoView isMobile={isMobile} memos={memos} memoInput={memoInput} setMemoInput={setMemoInput} addMemo={addMemo} editMemo={editMemo} deleteMemo={deleteMemo}/>}
            {mobileTab==="archive"&&<ArchiveView isMobile={isMobile} todos={todos} cats={cats} setTodosS={setTodosS}/>}
          </div>
          <div style={{display:"flex",borderTop:`1.5px solid ${C.border}`,background:C.white,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom)"}}>
            {[
              {tab:"month",  icon:"🗓️", label:"캘린더"},
              {tab:"today",  icon:"✨",  label:"오늘"},
              {tab:"list",   icon:"✅",  label:"할일"},
              {tab:"weekly", icon:"📊",  label:"주간"},
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

      {!isMobile&&<button onClick={()=>openAddEvent(selDate)} style={{position:"fixed",bottom:24,right:24,width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontSize:26,cursor:"pointer",boxShadow:`0 4px 20px ${C.rose}66`,display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>🍅</button>}

      {/* 💡 [새로운 기능] 이번 주 할 일 전용 추가/편집 모달 */}
      {weeklyModal && (
        <ModalWrap onClose={() => setWeeklyModal(null)} isMobile={isMobile}>
          <div style={{fontSize:16, fontWeight:800, color:"#F57F17", marginBottom:16}}>🎯 이번 주 할 일 {weeklyModal.mode==="add"?"추가":"편집"}</div>
          <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>할 일 내용</label>
          <KoreanInput style={inp} placeholder="예: 이번 주에 화장실 청소하기" value={weeklyFormTitle} onChange={setWeeklyFormTitle} autoFocus/>
          <div style={{fontSize:11, color:C.sub, background:"#FFF9C4", padding:"10px 14px", borderRadius:10, marginBottom:16, lineHeight:1.5}}>
            💡 한 번 추가해두면 <b>매주 자동으로</b> 나타나요!<br/>이번 주 안에 언제든 1번만 체크하면 달성 완료됩니다.
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
            {weeklyModal.mode==="edit"&&<button onClick={()=>deleteWeekly(weeklyModal.item.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>}
            <button onClick={()=>setWeeklyModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
            <button onClick={saveWeekly} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:800,background:"#F57F17",color:C.white}}>저장</button>
          </div>
        </ModalWrap>
      )}

      {(modal==="addEvent"||modal==="editEvent")&&(
        <ModalWrap onClose={()=>setModal(null)} isMobile={isMobile}>
          <div style={{fontSize:16,fontWeight:800,color:C.rose,marginBottom:16}}>🍅 {modal==="addEvent"?"새 일정 추가":"일정 편집"}</div>
          <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>제목</label>
          <KoreanInput key={form.id||"new-event"} style={inp} placeholder="일정 제목" value={form.title||""} onChange={v=>setForm(p=>({...p,title:v}))} autoFocus/>
          <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6,display:"block"}}>분류</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {activeCats.map(cat=><button key={cat.id} onClick={()=>setForm(p=>({...p,catId:cat.id,color:cat.color}))} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:99,border:`2px solid ${form.catId===cat.id?cat.color:C.border}`,background:form.catId===cat.id?cat.color+"22":C.white,color:form.catId===cat.id?cat.color:C.sub,cursor:"pointer",fontSize:12,fontWeight:700}}>{cat.emoji} {cat.name}</button>)}
          </div>
          
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 12px",background:"#FFF0F5",borderRadius:10,border:`1px solid ${C.border}`}}>
            <input type="checkbox" id="repeatMonthlyChk" checked={form.repeatMonthly||false} onChange={e=>setForm(p=>({...p, repeatMonthly:e.target.checked, isPeriod: e.target.checked ? false : p.isPeriod}))} style={{width:16,height:16,accentColor:C.rose,cursor:"pointer"}}/>
            <label htmlFor="repeatMonthlyChk" style={{fontSize:12,fontWeight:800,color:C.rose,cursor:"pointer"}}>🔁 매월 이 날짜에 반복 (월간 고정 일정)</label>
          </div>

          {!form.repeatMonthly && (
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",background:"#FFF0F5",borderRadius:12,border:`1.5px solid ${C.border}`}}>
              <span>🗓️</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700}}>기간(여러 날) 일정</div>
                <div style={{fontSize:10,color:C.sub}}>시작일과 종료일을 지정해요</div>
              </div>
              <div onClick={()=>setForm(p=>({...p, isPeriod:!p.isPeriod, endDate:!p.isPeriod?(p.endDate||p.date):""}))} style={{width:42,height:24,borderRadius:99,background:form.isPeriod?C.rose:C.pink1,cursor:"pointer",position:"relative"}}>
                <div style={{position:"absolute",top:3,left:form.isPeriod?20:3,width:18,height:18,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
              </div>
            </div>
          )}

          {form.isPeriod && !form.repeatMonthly ? (
            <div style={{display:"flex",gap:10,background:C.white,padding:"10px",borderRadius:12,border:`1px solid ${C.border}`,marginBottom:12}}>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>🟢 시작일</label>
                <input type="date" style={{...inp,marginBottom:0}} value={form.date||""} onChange={e=>setForm(p=>({...p,date:e.target.value, endDate: p.endDate && p.endDate < e.target.value ? e.target.value : p.endDate}))}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>🔴 종료일</label>
                <input type="date" style={{...inp,marginBottom:0}} value={form.endDate||form.date||""} min={form.date} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}/>
              </div>
            </div>
          ) : (
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>{form.repeatMonthly ? "📅 기준 날짜 (매월 이 날짜에 나타나요)" : "📅 날짜"}</label>
              <input type="date" style={{...inp,marginBottom:0}} value={form.date||""} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
            </div>
          )}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"#FFF8FA",borderRadius:10,border:`1px dashed ${C.border}`,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <input type="checkbox" id="allDayChk" checked={form.allDay||false} onChange={e=>setForm(p=>({...p, allDay:e.target.checked, time:""}))} style={{width:16,height:16,accentColor:C.rose,cursor:"pointer"}}/>
              <label htmlFor="allDayChk" style={{fontSize:12,fontWeight:700,color:C.text,cursor:"pointer"}}>⏰ 종일 일정 (시간 미지정)</label>
            </div>
            {!form.allDay && (
              <input type="time" style={{...inp,width:"120px",marginBottom:0,padding:"4px 8px"}} value={form.time||""} onChange={e=>setForm(p=>({...p,time:e.target.value}))}/>
            )}
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
            {modal==="editEvent"&&<button onClick={()=>deleteEvent(form.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>}
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
            <button onClick={saveEvent} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>저장</button>
          </div>
        </ModalWrap>
      )}

      {todoModal&&(
        <ModalWrap onClose={()=>setTodoModal(null)} isMobile={isMobile}>
          <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16}}>🌸 할 일 {todoModal.mode==="add"?"추가":"편집"}</div>
          <KoreanInput key={todoModal?.item?.id||"new-todo"} style={inp} placeholder="할 일 내용" value={todoForm.title||""} onChange={v=>setTodoForm(p=>({...p,title:v}))} autoFocus/>
          <div style={{display:"flex", gap:8, marginBottom:16}}>
            {[
              {v:"single", lb:"하루 할 일", ic:"✅"},
              {v:"period", lb:"기간 (여러 날)", ic:"🗓️"},
              {v:"routine", lb:"반복 루틴", ic:"🔁"}
            ].map(opt => (
              <button key={opt.v} onClick={()=>setTodoForm(p=>({...p, type:opt.v}))} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6, padding:"12px 0", borderRadius:12, border:`2px solid ${todoForm.type===opt.v?C.rose:C.border}`, background:todoForm.type===opt.v?C.rose+"12":C.white, color:todoForm.type===opt.v?C.rose:C.sub, fontWeight:todoForm.type===opt.v?800:600, fontSize:12, cursor:"pointer"}}>
                <span style={{fontSize:20}}>{opt.ic}</span>
                {opt.lb}
              </button>
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
              
              {todoForm.repeatType==="alternate"&&(
                <div style={{marginBottom:12, padding:"9px 12px", background:"#FFF0F5", borderRadius:10, border:`1px solid ${C.border}`, fontSize:11, color:C.rose, lineHeight:1.5}}>
                  💡 <b>루틴 시작일({todoForm.startDate||todayStr})</b>을 기준으로 <b>하루 걸러 하루씩(2일 간격)</b> 플래너에 나타나요!
                </div>
              )}

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
                      const cur=todoForm.weekDays||[];
                      const isActive = vals.length===cur.length && vals.every(v=>cur.includes(v));
                      return (
                        <button key={lb} onClick={()=>setTodoForm(p=>({...p, weekDays: isActive ? [] : [...vals].sort()}))} style={{flex:1,padding:"6px 0",borderRadius:8,border:`1.5px solid ${isActive?C.rose:C.border}`,background:isActive?C.rose+"18":"#FFF8FA",color:isActive?C.rose:C.sub,fontWeight:700,fontSize:11,cursor:"pointer"}}>{lb}</button>
                      );
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
