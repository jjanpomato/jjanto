import { useState, useRef } from "react";

// ── 팔레트 ────────────────────────────────────────────────────
const C = {
  bg:      "#FFF5F7",
  pink1:   "#FFD6E0",
  pink2:   "#FFB3C6",
  pink3:   "#FF85A1",
  rose:    "#FF4D6D",
  tomato:  "#E63946",
  text:    "#3D2030",
  sub:     "#B07A8A",
  border:  "#FFD6E0",
  white:   "#FFFFFF",
};

// ── 기본 분류 (hidden 필드 추가 — 숨기기만, 삭제 X) ────────────
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

// 해당 월의 주차 계산 (1~5)
function getWeekOfMonth(dateStr) {
  const d = new Date(dateStr);
  const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.ceil((d.getDate() + firstDay) / 7);
}

// ── 샘플 데이터 ───────────────────────────────────────────────
const today    = new Date();
const todayStr = fmtDate(today);
const tom      = fmtDate(new Date(today.getFullYear(), today.getMonth(), today.getDate()+1));

// 이벤트에 catId 추가
const INIT_EVENTS = [
  {id:genId(), title:"팀 스탠드업", date:todayStr, time:"09:00", color:"#FF85A1", catId:"work",    done:false},
  {id:genId(), title:"점심 약속",   date:todayStr, time:"12:30", color:"#B39DDB", catId:"personal",done:false},
  {id:genId(), title:"주간 보고",   date:tom,      time:"15:00", color:"#FF85A1", catId:"work",    done:false},
];

const INIT_TODOS = {
  work:    [{id:genId(),title:"기획서 초안 작성",    date:todayStr,done:false},{id:genId(),title:"팀 미팅 준비",     date:todayStr,done:true}],
  economy: [{id:genId(),title:"주식 포트폴리오 확인",date:todayStr,done:false},{id:genId(),title:"월 가계부 정리",   date:todayStr,done:false}],
  fitness: [{id:genId(),title:"30분 조깅",          date:todayStr,done:true}, {id:genId(),title:"스트레칭 10분",    date:todayStr,done:false}],
  personal:[{id:genId(),title:"일기 쓰기",           date:todayStr,done:false},{id:genId(),title:"비타민 챙겨먹기", date:todayStr,done:true}],
  apptech: [{id:genId(),title:"캐시워크 걷기",        date:todayStr,done:true}, {id:genId(),title:"토스 행운복권",   date:todayStr,done:false}],
  event:   [{id:genId(),title:"쿠팡 할인쿠폰 확인",  date:todayStr,done:false}],
};

// ── Ring SVG ──────────────────────────────────────────────────
function Ring({ pct, size=56, stroke=5, color=C.rose, bg=C.pink1 }) {
  const r    = (size - stroke*2) / 2;
  const circ = 2*Math.PI*r;
  const off  = circ - (pct/100)*circ;
  return (
    <svg width={size} height={size} style={{display:"block",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={bg} strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:"stroke-dashoffset .5s ease"}}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        style={{fontSize:size*.22, fontWeight:700, fill:color, fontFamily:"inherit"}}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function Bar({ pct, color }) {
  return (
    <div style={{flex:1, height:6, borderRadius:99, background:C.pink1, overflow:"hidden"}}>
      <div style={{width:`${pct}%`, height:"100%", borderRadius:99, background:color, transition:"width .5s"}}/>
    </div>
  );
}

// ── 입력 공용 스타일 ──────────────────────────────────────────
const inp = {
  width:"100%", padding:"9px 12px", border:`1.5px solid ${C.border}`,
  borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box",
  marginBottom:12, fontFamily:"inherit", background:"#FFF8FA", color:C.text,
};

// ── localStorage 헬퍼 ─────────────────────────────────────────
function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
  catch { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [view,      setView]      = useState("month");
  const [curDate,   setCurDate]   = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selDate,   setSelDate]   = useState(todayStr);
  const [events,    setEvents]    = useState(()=>load("jjanto_events", INIT_EVENTS));
  const [todos,     setTodos]     = useState(()=>load("jjanto_todos",  INIT_TODOS));
  const [cats,      setCats]      = useState(()=>load("jjanto_cats",   CAT_DEFAULTS));
  const [sideOpen,  setSideOpen]  = useState(true);

  // 데이터 변경시 자동 저장
  const setEventsS = v => { const n = typeof v==="function"?v(events):v; setEvents(n); save("jjanto_events",n); };
  const setTodosS  = v => { const n = typeof v==="function"?v(todos):v;  setTodos(n);  save("jjanto_todos",n);  };
  const setCatsS   = v => { const n = typeof v==="function"?v(cats):v;   setCats(n);   save("jjanto_cats",n);   };

  const [hideCompleted, setHideCompleted] = useState({apptech: false});
  // 사이드바 오늘 일정 필터 탭
  const [sideFilter, setSideFilter] = useState("all"); // "all" | catId

  // 공유 카드
  const [shareCard, setShareCard] = useState(false);
  const cardRef = useRef(null);

  // 이벤트 모달
  const [modal,  setModal]  = useState(null);
  const [form,   setForm]   = useState({});

  // 인증샷 모달
  const [proofModal, setProofModal] = useState(null); // {catId, item} | null

  // 할 일 모달
  const [todoModal, setTodoModal] = useState(null);
  const [todoForm,  setTodoForm]  = useState({title:"", date:todayStr});

  // 분류 모달
  const [catModal, setCatModal] = useState(null);
  const [catForm,  setCatForm]  = useState({name:"", emoji:"⭐", color:C.pink3});

  // ── 계산 ────────────────────────────────────────────────────
  const activeCats = cats.filter(c => !c.hidden);

  function catById(id) { return cats.find(c=>c.id===id); }

  function todayTodosOf(dateStr, catId) {
    return (todos[catId]||[]).filter(t => !t.date || isSame(t.date, dateStr));
  }
  function allTodosOn(dateStr) {
    return activeCats.flatMap(c=>(todos[c.id]||[]).filter(t => !t.date || isSame(t.date,dateStr)));
  }
  function totalPctOn(dateStr) {
    const all = allTodosOn(dateStr);
    return all.length===0 ? 0 : Math.round(all.filter(t=>t.done).length/all.length*100);
  }
  function catPctOn(catId, dateStr) {
    const items = (todos[catId]||[]).filter(t => !t.date || isSame(t.date,dateStr));
    return items.length===0 ? 0 : Math.round(items.filter(t=>t.done).length/items.length*100);
  }

  // 주차별 달성률 (현재 보는 달 기준)
  function weeklyPct(weekNum, catId) {
    const y = curDate.getFullYear(), m = curDate.getMonth();
    const lastDay = new Date(y, m+1, 0).getDate();
    let done=0, total=0;
    for(let d=1; d<=lastDay; d++) {
      const ds = fmtDate(new Date(y,m,d));
      if(getWeekOfMonth(ds) !== weekNum) continue;
      const items = catId
        ? (todos[catId]||[]).filter(t => t.date ? isSame(t.date,ds) : true)
        : activeCats.flatMap(c=>(todos[c.id]||[]).filter(t => t.date ? isSame(t.date,ds) : true));
      total += items.length;
      done  += items.filter(t=>t.done).length;
    }
    return total===0 ? null : Math.round(done/total*100);
  }

  // 현재 달 주차 목록
  function weeksInMonth() {
    const y = curDate.getFullYear(), m = curDate.getMonth();
    const last = new Date(y,m+1,0).getDate();
    const ws = new Set();
    for(let d=1;d<=last;d++) ws.add(getWeekOfMonth(fmtDate(new Date(y,m,d))));
    return [...ws].sort();
  }

  // 날짜가 이벤트 기간 안에 포함되는지 체크 (종일/기간 포함)
  function eventsOn(ds) {
    return events.filter(e => {
      if(e.allDay && e.endDate) {
        return ds >= e.date && ds <= e.endDate;
      }
      return isSame(e.date, ds);
    }).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
  }
  function openAddEvent(date) {
    const firstCat = activeCats[0];
    setForm({title:"", date:date||selDate, endDate:"", time:"", allDay:false, catId:firstCat?.id||"", color:firstCat?.color||C.pink3, done:false});
    setModal("addEvent");
  }
  function openEditEvent(e) { setForm({...e}); setModal("editEvent"); }
  function saveEvent() {
    if(!form.title.trim()) return;
    // 색상을 선택된 분류 색상으로 자동 맞추기
    const cat = catById(form.catId);
    const colored = {...form, color: cat?.color || form.color};
    if(modal==="addEvent") setEventsS(p=>[...p, {...colored, id:genId()}]);
    else setEventsS(p=>p.map(e=>e.id===form.id ? {...colored} : e));
    setModal(null);
  }
  function deleteEvent(id) { setEventsS(p=>p.filter(e=>e.id!==id)); setModal(null); }

  // ── 할 일 helpers ────────────────────────────────────────────
  function openAddTodo(catId) { setTodoForm({title:"", date:""}); setTodoModal({mode:"add", catId}); }
  function openEditTodo(catId, item) { setTodoForm({title:item.title, date:item.date||""}); setTodoModal({mode:"edit", catId, item}); }
  function saveTodo() {
    if(!todoForm.title.trim()) return;
    const {mode, catId, item} = todoModal;
    if(mode==="add") {
      setTodosS(p=>({...p, [catId]:[...(p[catId]||[]), {id:genId(), title:todoForm.title, date:todoForm.date, done:false}]}));
    } else {
      setTodosS(p=>({...p, [catId]:p[catId].map(t=>t.id===item.id ? {...t, title:todoForm.title, date:todoForm.date} : t)}));
    }
    setTodoModal(null);
  }
  function deleteTodo(catId, id) { setTodosS(p=>({...p, [catId]:p[catId].filter(t=>t.id!==id)})); setTodoModal(null); }
  function toggleTodo(catId, id) {
    const item = (todos[catId]||[]).find(t=>t.id===id);
    if(!item) return;
    // 완료로 바꾸는 경우 인증샷 모달 열기, 해제는 그냥 토글
    if(!item.done) {
      setProofModal({catId, item});
    } else {
      setTodosS(p=>({...p, [catId]:p[catId].map(t=>t.id===id?{...t,done:false,proof:null}:t)}));
    }
  }
  function saveProof(catId, id, photoUrl) {
    setTodosS(p=>({...p, [catId]:p[catId].map(t=>t.id===id?{...t,done:true,proof:photoUrl}:t)}));
    setProofModal(null);
  }
  function completeWithoutProof(catId, id) {
    setTodosS(p=>({...p, [catId]:p[catId].map(t=>t.id===id?{...t,done:true}:t)}));
    setProofModal(null);
  }

  // ── 분류 helpers ─────────────────────────────────────────────
  function saveCat() {
    if(!catForm.name.trim()) return;
    if(catModal==="add") {
      const nid = genId();
      setCatsS(p=>[...p, {id:nid, ...catForm, hidden:false}]);
      setTodosS(p=>({...p, [nid]:[]}));
    } else {
      setCatsS(p=>p.map(c=>c.id===catModal.id ? {...c, ...catForm} : c));
    }
    setCatModal(null);
  }
  // 삭제 대신 숨기기 — 데이터 보존
  function hideCat(id) {
    setCatsS(p=>p.map(c=>c.id===id ? {...c, hidden:true} : c));
    setCatModal(null);
  }
  function showCat(id) { setCatsS(p=>p.map(c=>c.id===id ? {...c, hidden:false} : c)); }

  // ── 월 그리드 ────────────────────────────────────────────────
  function buildGrid() {
    const y=curDate.getFullYear(), m=curDate.getMonth();
    const first=new Date(y,m,1).getDay(), last=new Date(y,m+1,0).getDate();
    const cells=[];
    for(let i=0;i<first;i++) cells.push(null);
    for(let d=1;d<=last;d++) cells.push(new Date(y,m,d));
    return cells;
  }
  const cells = buildGrid();
  const weeks  = weeksInMonth();

  // 사이드바 오늘 일정 필터링
  const sideEvents = sideFilter==="all"
    ? eventsOn(todayStr)
    : eventsOn(todayStr).filter(e=>e.catId===sideFilter);

  return (
    <div style={{display:"flex", height:"100vh", fontFamily:"'Nunito','Apple SD Gothic Neo',sans-serif", background:C.bg, color:C.text, overflow:"hidden"}}>

      {/* ══ SIDEBAR ══ */}
      <aside style={{width:sideOpen?248:0, minWidth:sideOpen?248:0, background:"linear-gradient(160deg,#fff0f3,#ffe4ec)", borderRight:`1.5px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden", transition:"all .25s", flexShrink:0}}>
        <div style={{padding:"18px 14px", display:"flex", flexDirection:"column", gap:2, overflow:"auto", flex:1}}>

          {/* 로고 */}
          <div style={{fontSize:19, fontWeight:800, color:C.rose, padding:"2px 6px 14px", display:"flex", alignItems:"center", gap:8}}>
            🍅 짠토의 플래너
          </div>

          {/* 뷰 전환 */}
          {[["month","🗓️","월간 캘린더"],["list","✅","할 일 목록"]].map(([v,ic,lb])=>(
            <button key={v} onClick={()=>setView(v)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:12,cursor:"pointer",fontSize:14,fontWeight:view===v?700:500,background:view===v?C.pink2:"transparent",color:view===v?C.white:C.sub,border:"none",width:"100%",textAlign:"left",transition:"all .15s"}}>
              <span>{ic}</span>{lb}
            </button>
          ))}

          <div style={{margin:"12px 0 6px", fontSize:11, fontWeight:800, color:C.sub, padding:"0 6px", letterSpacing:".05em"}}>오늘 일정 🌸</div>

          {/* 분류 필터 탭 */}
          <div style={{display:"flex", flexWrap:"wrap", gap:4, marginBottom:8}}>
            <button onClick={()=>setSideFilter("all")} style={{padding:"3px 9px", borderRadius:99, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:sideFilter==="all"?C.rose:C.pink1, color:sideFilter==="all"?C.white:C.sub}}>전체</button>
            {activeCats.map(cat=>(
              <button key={cat.id} onClick={()=>setSideFilter(sideFilter===cat.id?"all":cat.id)} style={{padding:"3px 8px", borderRadius:99, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:sideFilter===cat.id?cat.color:C.pink1, color:sideFilter===cat.id?C.white:C.sub, transition:"all .15s"}}>
                {cat.emoji}
              </button>
            ))}
          </div>

          {/* 오늘 일정 리스트 */}
          <div style={{background:C.white, borderRadius:12, padding:"10px 12px", border:`1px solid ${C.border}`, minHeight:60}}>
            {sideEvents.length===0 && <div style={{fontSize:12, color:C.sub, textAlign:"center", padding:"6px 0"}}>일정이 없어요</div>}
            {sideEvents.map(e=>{
              const cat = catById(e.catId);
              return (
                <div key={e.id} style={{display:"flex", alignItems:"center", gap:6, marginBottom:5, cursor:"pointer"}} onClick={()=>openEditEvent(e)}>
                  <span style={{fontSize:13}}>{cat?.emoji||"📌"}</span>
                  <div style={{flex:1, overflow:"hidden"}}>
                    <div style={{fontSize:12, color:C.text, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{e.allDay && <span style={{fontSize:10,background:C.rose,color:C.white,borderRadius:4,padding:"1px 4px",marginRight:4}}>종일</span>}{e.title}</div>
                    {e.allDay && e.endDate && e.endDate!==e.date
                      ? <div style={{fontSize:10,color:C.sub}}>{e.date} ~ {e.endDate}</div>
                      : e.time && <div style={{fontSize:10, color:C.sub}}>{e.time}</div>
                    }
                  </div>
                  <span style={{width:7,height:7,borderRadius:"50%",background:e.color,flexShrink:0}}/>
                </div>
              );
            })}
          </div>

          {/* 주차별 달성률 */}
          <div style={{margin:"12px 0 6px", fontSize:11, fontWeight:800, color:C.sub, padding:"0 6px", letterSpacing:".05em"}}>이번 달 주차별 달성률 📊</div>
          <div style={{background:C.white, borderRadius:12, padding:"10px 12px", border:`1px solid ${C.border}`}}>
            {weeks.map(w=>{
              const pct = weeklyPct(w, null);
              return (
                <div key={w} style={{marginBottom:8}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3}}>
                    <span style={{fontSize:11, fontWeight:700, color:C.sub}}>{w}주차</span>
                    <span style={{fontSize:11, fontWeight:800, color:C.rose}}>{pct===null?"—":pct+"%"}</span>
                  </div>
                  <Bar pct={pct||0} color={C.rose}/>
                  {/* 분류별 미니 */}
                  <div style={{display:"flex", gap:6, marginTop:5, flexWrap:"wrap"}}>
                    {activeCats.map(cat=>{
                      const cp = weeklyPct(w, cat.id);
                      return cp===null ? null : (
                        <div key={cat.id} style={{display:"flex", alignItems:"center", gap:3}}>
                          <span style={{fontSize:10}}>{cat.emoji}</span>
                          <div style={{width:32, height:4, borderRadius:99, background:C.pink1, overflow:"hidden"}}>
                            <div style={{width:`${cp}%`, height:"100%", background:cat.color, borderRadius:99}}/>
                          </div>
                          <span style={{fontSize:9, color:cat.color, fontWeight:700}}>{cp}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 숨김 분류 복원 */}
          {cats.filter(c=>c.hidden).length>0 && (
            <div style={{marginTop:8}}>
              <div style={{fontSize:11, fontWeight:800, color:C.sub, padding:"0 6px 4px", letterSpacing:".05em"}}>숨긴 분류</div>
              {cats.filter(c=>c.hidden).map(c=>(
                <button key={c.id} onClick={()=>showCat(c.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:C.pink1,border:"none",cursor:"pointer",fontSize:12,color:C.sub,marginBottom:3,width:"100%"}}>
                  {c.emoji} {c.name} <span style={{marginLeft:"auto",fontSize:10,color:C.rose}}>복원</span>
                </button>
              ))}
            </div>
          )}

          <div style={{marginTop:"auto", paddingTop:10, fontSize:11, color:C.sub, textAlign:"center"}}>총 {events.length}개 일정 🍓</div>
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>

        {/* 툴바 */}
        <div style={{display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderBottom:`1.5px solid ${C.border}`, background:C.white, flexWrap:"wrap"}}>
          <button onClick={()=>setSideOpen(p=>!p)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.rose}}>☰</button>
          <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()-1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>‹</button>
          <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()+1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>›</button>
          <span style={{fontSize:16,fontWeight:800,color:C.rose}}>{curDate.getFullYear()}년 {MONTHS_KO[curDate.getMonth()]}</span>
          <button onClick={()=>{setCurDate(new Date(today.getFullYear(),today.getMonth(),1));setSelDate(todayStr);}} style={{background:C.pink2,border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
          <div style={{flex:1}}/>
          {["month","list"].map(v=>(
            <button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:20,border:`2px solid ${view===v?C.rose:C.border}`,background:view===v?C.rose:C.white,color:view===v?C.white:C.sub,fontSize:12,cursor:"pointer",fontWeight:700,transition:"all .15s"}}>
              {v==="month"?"🗓 월간":"✅ 할일"}
            </button>
          ))}
          <button onClick={()=>openAddEvent(selDate)} style={{padding:"7px 16px",borderRadius:20,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:13,cursor:"pointer",boxShadow:`0 3px 12px ${C.pink2}`}}>
            🍅 추가
          </button>
        </div>

        {/* ── 월간 뷰 ── */}
        {view==="month" && (
          <div style={{display:"flex", flexDirection:"column", flex:1, overflow:"hidden"}}>
            <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", background:C.white, borderBottom:`1px solid ${C.border}`}}>
              {DAYS_KO.map((d,i)=><div key={d} style={{padding:"8px 0",textAlign:"center",fontSize:12,fontWeight:800,color:[0,6].includes(i)?C.rose:C.sub}}>{d}</div>)}
            </div>
            <div style={{display:"grid", gridTemplateColumns:"repeat(7,1fr)", flex:1, overflow:"auto", background:C.bg}}>
              {cells.map((day,i)=>{
                if(!day) return <div key={i} style={{background:"#fff8fa",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}/>;
                const ds = fmtDate(day);
                const isToday = isSame(ds,todayStr), isSel = ds===selDate;
                const dayEvs  = eventsOn(ds);
                const dPct    = (() => { const all=allTodosOn(ds); return all.length?Math.round(all.filter(t=>t.done).length/all.length*100):null; })();
                return (
                  <div key={i} onClick={()=>setSelDate(ds)} style={{padding:"5px 6px",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,minHeight:88,cursor:"pointer",background:isSel?"#fff0f3":isToday?"#fff8fb":C.white,transition:"background .1s",position:"relative"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:24,height:24,borderRadius:"50%",fontSize:12,fontWeight:isToday?800:500,background:isToday?C.rose:"transparent",color:isToday?C.white:[0,6].includes(day.getDay())?C.pink3:C.text}}>{day.getDate()}</div>
                      {dPct!==null && <span style={{fontSize:9,fontWeight:700,color:C.sub,background:C.pink1,borderRadius:99,padding:"1px 5px"}}>{dPct}%</span>}
                    </div>
                    {dayEvs.slice(0,3).map(e=>{
                      const cat = catById(e.catId);
                      const isStart = isSame(e.date, ds);
                      const isSpan  = e.allDay && e.endDate && e.date !== e.endDate;
                      return (
                        <div key={e.id} onClick={ev=>{ev.stopPropagation();openEditEvent(e);}}
                          style={{display:"flex",alignItems:"center",gap:3,padding:"2px 5px",
                            borderRadius: isSpan ? (isStart?"6px 2px 2px 6px":"2px") : 6,
                            fontSize:10,fontWeight:600,
                            background: isSpan ? e.color+"44" : e.color+"22",
                            color:e.color,marginTop:2,overflow:"hidden",whiteSpace:"nowrap",cursor:"pointer",
                            borderLeft: isSpan && isStart ? `3px solid ${e.color}` : "none"}}>
                          {!isSpan && <span style={{fontSize:9}}>{cat?.emoji||"📌"}</span>}
                          {isStart && <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{e.allDay ? "🌟 " : (e.time ? e.time+" " : "")}{e.title}</span>}
                          {!isStart && isSpan && <span style={{opacity:.6}}>↔ {e.title}</span>}
                        </div>
                      );
                    })}
                    {dayEvs.length>3 && <div style={{fontSize:9,color:C.sub,marginTop:1}}>+{dayEvs.length-3}개 더</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 할일 뷰 ── */}
        {view==="list" && (
          <div style={{flex:1, overflow:"auto", padding:"16px 20px"}}>

            {/* 날짜 선택 + 총 달성률 */}
            <div style={{display:"flex", alignItems:"center", gap:12, marginBottom:16, flexWrap:"wrap"}}>
              <div style={{display:"flex", alignItems:"center", gap:6}}>
                <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:800}}>‹</button>
                <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{border:`1.5px solid ${C.border}`,borderRadius:10,padding:"6px 10px",fontSize:13,color:C.text,background:C.white,fontFamily:"inherit",outline:"none"}}/>
                <button onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);setSelDate(fmtDate(d));}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:800}}>›</button>
                <button onClick={()=>setSelDate(todayStr)} style={{background:C.pink2,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
              </div>

              {/* 총 달성률 배너 */}
              <div style={{display:"flex",alignItems:"center",gap:14,background:C.white,borderRadius:16,padding:"10px 16px",border:`1.5px solid ${C.border}`,boxShadow:`0 2px 12px ${C.pink2}33`,flex:1,minWidth:220}}>
                <Ring pct={totalPctOn(selDate)} size={58} stroke={6} color={C.rose} bg={C.pink1}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:800,color:C.rose}}>🍅 오늘 총 달성률</div>
                  <div style={{fontSize:11,color:C.sub,marginTop:2}}>
                    {allTodosOn(selDate).filter(t=>t.done).length} / {allTodosOn(selDate).length} 완료
                  </div>
                  {totalPctOn(selDate)===100 && allTodosOn(selDate).length>0 && <div style={{fontSize:11,color:C.tomato,fontWeight:700,marginTop:2}}>완벽해요! 🎉</div>}
                </div>
                <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                  {activeCats.map(cat=>(
                    <div key={cat.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                      <Ring pct={catPctOn(cat.id,selDate)} size={36} stroke={4} color={cat.color} bg={C.pink1}/>
                      <span style={{fontSize:9,color:C.sub}}>{cat.emoji}</span>
                    </div>
                  ))}
                </div>
                {/* 캡처 버튼 */}
                <button onClick={()=>setShareCard(true)} style={{flexShrink:0,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,border:"none",borderRadius:10,padding:"8px 10px",cursor:"pointer",color:C.white,fontSize:16,boxShadow:`0 2px 8px ${C.pink2}`}} title="달성률 카드 만들기">📸</button>
              </div>
            </div>

            {/* 분류 카드 그리드 */}
            <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))", gap:14}}>
              {activeCats.map(cat=>{
                const items = (todos[cat.id]||[]).filter(t => !t.date || isSame(t.date,selDate));
                const pct   = catPctOn(cat.id, selDate);
                const isHiding = !!hideCompleted[cat.id];
                const visibleItems = isHiding ? items.filter(t=>!t.done) : items;
                const hiddenCount  = items.filter(t=>t.done).length;
                return (
                  <div key={cat.id} style={{background:C.white,borderRadius:16,padding:"16px",border:`1.5px solid ${C.border}`,boxShadow:`0 2px 10px ${C.pink1}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:20}}>{cat.emoji}</span>
                        <span style={{fontSize:15,fontWeight:800,color:C.text}}>{cat.name}</span>
                        <span style={{fontSize:10,fontWeight:700,color:cat.color,background:cat.color+"22",padding:"2px 8px",borderRadius:99}}>{items.length}개</span>
                      </div>
                      <div style={{display:"flex",gap:3,alignItems:"center"}}>
                        {/* 앱테크 전용 완료 숨기기 토글 */}
                        {cat.id==="apptech" && (
                          <button onClick={()=>setHideCompleted(p=>({...p,apptech:!p.apptech}))}
                            style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:99,border:`1.5px solid ${isHiding?cat.color:C.border}`,background:isHiding?cat.color+"22":C.white,color:isHiding?cat.color:C.sub,cursor:"pointer",fontSize:11,fontWeight:700,transition:"all .15s"}}>
                            {isHiding ? `✅ 완료 숨김 (${hiddenCount})` : "완료 숨기기"}
                          </button>
                        )}
                        <button onClick={()=>{setCatForm({name:cat.name,emoji:cat.emoji,color:cat.color});setCatModal({id:cat.id});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.sub,padding:"2px 4px"}}>✏️</button>
                        <button onClick={()=>openAddTodo(cat.id)} style={{background:cat.color,border:"none",borderRadius:8,padding:"3px 10px",cursor:"pointer",color:C.white,fontWeight:800,fontSize:13}}>+</button>
                      </div>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                      <Bar pct={pct} color={cat.color}/>
                      <span style={{fontSize:11,fontWeight:700,color:cat.color,minWidth:28}}>{pct}%</span>
                    </div>
                    {visibleItems.length===0 && items.length===0 && <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>할 일을 추가해봐요 🌸</div>}
                    {visibleItems.length===0 && items.length>0 && <div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>🎉 모두 완료했어요!</div>}
                    {visibleItems.map(item=>(
                      <div key={item.id} style={{padding:"6px 0",borderBottom:`1px dashed ${C.border}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <input type="checkbox" checked={item.done} onChange={()=>toggleTodo(cat.id,item.id)} style={{width:16,height:16,accentColor:cat.color,cursor:"pointer",flexShrink:0}}/>
                          <span style={{flex:1,fontSize:13,color:item.done?C.sub:C.text,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600}}>
                            {!item.date && <span style={{fontSize:10,background:cat.color+"33",color:cat.color,borderRadius:4,padding:"1px 5px",marginRight:4,fontWeight:700}}>🔁 루틴</span>}
                            {item.title}
                          </span>
                          {/* 인증샷 버튼/썸네일 */}
                          {item.done && item.proof
                            ? <img src={item.proof} onClick={()=>setProofModal({catId:cat.id,item,viewOnly:true})} style={{width:32,height:32,borderRadius:6,objectFit:"cover",cursor:"pointer",border:`2px solid ${cat.color}`,flexShrink:0}} title="인증샷 보기"/>
                            : item.done
                              ? <button onClick={()=>setProofModal({catId:cat.id,item})} style={{fontSize:11,padding:"2px 7px",borderRadius:99,border:`1.5px dashed ${cat.color}`,background:"none",color:cat.color,cursor:"pointer",flexShrink:0,fontWeight:700}}>📷 인증</button>
                              : null
                          }
                          <button onClick={()=>openEditTodo(cat.id,item)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.sub,padding:0,opacity:.6,flexShrink:0}}>✏️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* 분류 추가 카드 */}
              <div onClick={()=>{setCatForm({name:"",emoji:"⭐",color:C.pink3});setCatModal("add");}} style={{background:"#fff8fa",borderRadius:16,padding:"16px",border:`1.5px dashed ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,color:C.sub,minHeight:100,transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.pink1} onMouseLeave={e=>e.currentTarget.style.background="#fff8fa"}>
                <span style={{fontSize:26}}>＋</span>
                <span style={{fontSize:12,fontWeight:700}}>분류 추가</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <button onClick={()=>openAddEvent(selDate)} style={{position:"fixed",bottom:24,right:24,width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontSize:26,cursor:"pointer",boxShadow:`0 4px 20px ${C.rose}66`,display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>🍅</button>

      {/* ══ 이벤트 모달 ══ */}
      {(modal==="addEvent"||modal==="editEvent") && (
        <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.38)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setModal(null)}>
          <div style={{background:C.white,borderRadius:20,padding:26,width:370,boxShadow:`0 20px 60px ${C.pink3}55`,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:800,color:C.rose,marginBottom:16}}>🍅 {modal==="addEvent"?"새 일정 추가":"일정 편집"}</div>

            <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>제목</label>
            <input style={inp} placeholder="일정 제목" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} autoFocus/>

            {/* 분류 선택 */}
            <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6,display:"block"}}>분류</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
              {activeCats.map(cat=>(
                <button key={cat.id} onClick={()=>setForm(p=>({...p,catId:cat.id,color:cat.color}))} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:99,border:`2px solid ${form.catId===cat.id?cat.color:C.border}`,background:form.catId===cat.id?cat.color+"22":C.white,color:form.catId===cat.id?cat.color:C.sub,cursor:"pointer",fontSize:12,fontWeight:700,transition:"all .15s"}}>
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>

            {/* 종일 토글 */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 14px",background:"#FFF0F5",borderRadius:12,border:`1.5px solid ${C.border}`}}>
              <span style={{fontSize:14}}>🌟</span>
              <span style={{fontSize:13,fontWeight:700,color:C.text,flex:1}}>종일 / 기간 일정</span>
              <div onClick={()=>setForm(p=>({...p,allDay:!p.allDay, time:""}))} style={{width:42,height:24,borderRadius:99,background:form.allDay?C.rose:C.pink1,cursor:"pointer",position:"relative",transition:"background .2s"}}>
                <div style={{position:"absolute",top:3,left:form.allDay?20:3,width:18,height:18,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
              </div>
            </div>

            {form.allDay ? (
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>시작일</label>
                  <input type="date" style={inp} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>종료일 <span style={{fontWeight:400,color:C.pink2}}>(당일이면 같게)</span></label>
                  <input type="date" style={inp} value={form.endDate||form.date} min={form.date} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}/>
                </div>
              </div>
            ) : (
              <div style={{display:"flex",gap:10}}>
                <div style={{flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>날짜</label><input type="date" style={inp} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
                <div style={{flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>시간 (선택)</label><input type="time" style={inp} value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}/></div>
              </div>
            )}

            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              {modal==="editEvent" && <button onClick={()=>deleteEvent(form.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>}
              <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
              <button onClick={saveEvent} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 할 일 모달 ══ */}
      {todoModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.38)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setTodoModal(null)}>
          <div style={{background:C.white,borderRadius:20,padding:26,width:340,boxShadow:`0 20px 60px ${C.pink3}55`}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16}}>🌸 할 일 {todoModal.mode==="add"?"추가":"편집"}</div>
            <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>할 일</label>
            <input style={inp} placeholder="할 일 내용" value={todoForm.title} onChange={e=>setTodoForm(p=>({...p,title:e.target.value}))} autoFocus/>

            {/* 루틴 토글 */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",background:"#FFF0F5",borderRadius:12,border:`1.5px solid ${C.border}`}}>
              <span style={{fontSize:14}}>🔁</span>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.text}}>매일 반복 (루틴)</div>
                <div style={{fontSize:10,color:C.sub}}>날짜 없이 등록하면 매일 보여요</div>
              </div>
              <div onClick={()=>setTodoForm(p=>({...p, date: p.date ? "" : selDate}))} style={{width:42,height:24,borderRadius:99,background:!todoForm.date?C.rose:C.pink1,cursor:"pointer",position:"relative",transition:"background .2s"}}>
                <div style={{position:"absolute",top:3,left:!todoForm.date?20:3,width:18,height:18,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
              </div>
            </div>

            {todoForm.date !== "" && (
              <>
                <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>날짜</label>
                <input type="date" style={inp} value={todoForm.date} onChange={e=>setTodoForm(p=>({...p,date:e.target.value}))}/>
              </>
            )}

            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              {todoModal.mode==="edit" && <button onClick={()=>deleteTodo(todoModal.catId,todoModal.item.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>}
              <button onClick={()=>setTodoModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
              <button onClick={saveTodo} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 분류 모달 ══ */}
      {catModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.38)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setCatModal(null)}>
          <div style={{background:C.white,borderRadius:20,padding:26,width:320,boxShadow:`0 20px 60px ${C.pink3}55`}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16}}>🍅 분류 {catModal==="add"?"추가":"편집"}</div>
            <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>이모지</label>
            <input style={inp} placeholder="이모지 (예: 💼)" value={catForm.emoji} onChange={e=>setCatForm(p=>({...p,emoji:e.target.value}))}/>
            <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>분류 이름</label>
            <input style={inp} placeholder="분류 이름" value={catForm.name} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))} autoFocus/>
            <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6,display:"block"}}>색상</label>
            <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
              {[C.rose,C.tomato,C.pink3,C.pink2,"#FFB347","#7EC8A4","#B39DDB","#64B5F6","#F06292","#4DB6AC"].map(c=>(
                <div key={c} onClick={()=>setCatForm(p=>({...p,color:c}))} style={{width:26,height:26,borderRadius:"50%",background:c,cursor:"pointer",outline:catForm.color===c?`3px solid ${c}`:"none",outlineOffset:2,transition:"outline .1s"}}/>
              ))}
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              {catModal!=="add" && (
                <button onClick={()=>hideCat(catModal.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:"#fff3e0",color:"#E65100"}}>숨기기</button>
              )}
              <button onClick={()=>setCatModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
              <button onClick={saveCat} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>저장</button>
            </div>
            {catModal!=="add" && <div style={{marginTop:10,fontSize:11,color:C.sub,textAlign:"center"}}>💡 숨기기는 기록을 보존해요. 언제든 복원할 수 있어요!</div>}
          </div>
        </div>
      )}

      {/* ══ 인증샷 모달 ══ */}
      {proofModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={()=>setProofModal(null)}>
          <div style={{background:C.white,borderRadius:20,padding:26,width:340,boxShadow:`0 20px 60px ${C.pink3}66`}} onClick={e=>e.stopPropagation()}>
            {proofModal.viewOnly ? (
              <>
                <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:14}}>📷 인증샷</div>
                <img src={proofModal.item.proof} style={{width:"100%",borderRadius:12,objectFit:"cover",maxHeight:280}} alt="인증샷"/>
                <div style={{marginTop:10,fontSize:13,fontWeight:700,color:C.text,textAlign:"center"}}>{proofModal.item.title}</div>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
                  <button onClick={()=>{
                    setTodosS(p=>({...p,[proofModal.catId]:p[proofModal.catId].map(t=>t.id===proofModal.item.id?{...t,proof:null}:t)}));
                    setProofModal(null);
                  }} style={{padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>
                  <button onClick={()=>setProofModal(null)} style={{padding:"7px 18px",borderRadius:10,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>닫기</button>
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:4}}>📷 인증샷 추가</div>
                <div style={{fontSize:12,color:C.sub,marginBottom:16}}>{proofModal.item.title}</div>
                <label style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,padding:"24px",border:`2px dashed ${C.pink2}`,borderRadius:14,cursor:"pointer",background:"#FFF8FA",marginBottom:14}}>
                  <span style={{fontSize:32}}>📷</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.sub}}>사진을 선택하거나 찍어주세요</span>
                  <span style={{fontSize:11,color:C.pink2}}>갤러리 또는 카메라</span>
                  <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{
                    const file = e.target.files?.[0];
                    if(!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => saveProof(proofModal.catId, proofModal.item.id, ev.target.result);
                    reader.readAsDataURL(file);
                  }}/>
                </label>
                <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                  <button onClick={()=>completeWithoutProof(proofModal.catId,proofModal.item.id)} style={{padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:C.pink1,color:C.sub}}>인증샷 없이 완료</button>
                  <button onClick={()=>setProofModal(null)} style={{padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:700,background:"#ffe4e4",color:C.tomato}}>취소</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ 달성률 공유 카드 모달 ══ */}
      {shareCard && (
        <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300}} onClick={()=>setShareCard(false)}>
          <div style={{background:C.white,borderRadius:24,padding:28,width:360,boxShadow:`0 20px 60px ${C.pink3}66`}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16,textAlign:"center"}}>📸 오늘의 달성률 카드</div>

            {/* 카드 미리보기 */}
            <div ref={cardRef} style={{background:"linear-gradient(135deg,#fff0f3,#ffe4ec)",borderRadius:20,padding:"24px 20px",border:`2px solid ${C.border}`,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div>
                  <div style={{fontSize:18,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</div>
                  <div style={{fontSize:12,color:C.sub,marginTop:2}}>{selDate} 달성률</div>
                </div>
                <Ring pct={totalPctOn(selDate)} size={66} stroke={7} color={C.rose} bg={C.pink1}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {activeCats.map(cat=>{
                  const pct = catPctOn(cat.id,selDate);
                  const items = (todos[cat.id]||[]).filter(t=> !t.date || isSame(t.date,selDate));
                  if(items.length===0) return null;
                  return (
                    <div key={cat.id} style={{background:"rgba(255,255,255,0.7)",borderRadius:12,padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span style={{fontSize:15}}>{cat.emoji}</span>
                          <span style={{fontSize:13,fontWeight:700,color:C.text}}>{cat.name}</span>
                        </div>
                        <span style={{fontSize:13,fontWeight:800,color:cat.color}}>{pct}%</span>
                      </div>
                      <div style={{height:7,borderRadius:99,background:C.pink1,overflow:"hidden"}}>
                        <div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:cat.color}}/>
                      </div>
                      <div style={{fontSize:10,color:C.sub,marginTop:4,textAlign:"right"}}>{items.filter(t=>t.done).length}/{items.length} 완료</div>
                    </div>
                  );
                })}
              </div>
              <div style={{marginTop:14,textAlign:"center",fontSize:12,color:C.sub,fontWeight:600}}>
                {totalPctOn(selDate)===100?"🎉 오늘 모두 완료! 최고예요!":totalPctOn(selDate)>=50?"🌸 절반 이상 달성! 잘하고 있어요!":"🍅 오늘도 화이팅!"}
              </div>
            </div>

            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button onClick={()=>{
                const card = cardRef.current;
                if(!card) return;
                import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js").then(()=>{
                  window.html2canvas(card,{scale:2,backgroundColor:null,useCORS:true}).then(canvas=>{
                    const a=document.createElement("a");
                    a.download=`짠토플래너_${selDate}.png`;
                    a.href=canvas.toDataURL("image/png");
                    a.click();
                  });
                }).catch(()=>alert("저장 기능을 사용할 수 없어요. 카드를 길게 눌러서 저장해봐요!"));
              }} style={{padding:"10px 22px",borderRadius:12,border:"none",cursor:"pointer",fontSize:14,fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,boxShadow:`0 3px 12px ${C.pink2}`}}>
                💾 이미지 저장
              </button>
              <button onClick={()=>setShareCard(false)} style={{padding:"10px 18px",borderRadius:12,border:"none",cursor:"pointer",fontSize:14,fontWeight:700,background:C.pink1,color:C.sub}}>닫기</button>
            </div>
            <div style={{marginTop:10,fontSize:11,color:C.sub,textAlign:"center"}}>📱 모바일에선 카드를 길게 눌러서 저장할 수 있어요!</div>
          </div>
        </div>
      )}
    </div>
  );
}
