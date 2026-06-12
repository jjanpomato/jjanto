import { useState, useRef, useEffect } from "react";

const C = {
  bg:"#FFF5F7", pink1:"#FFD6E0", pink2:"#FFB3C6", pink3:"#FF85A1",
  rose:"#FF4D6D", tomato:"#E63946", text:"#3D2030", sub:"#B07A8A",
  border:"#FFD6E0", white:"#FFFFFF",
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
function getWeekOfMonth(ds) {
  const d=new Date(ds), fd=new Date(d.getFullYear(),d.getMonth(),1).getDay();
  return Math.ceil((d.getDate()+fd)/7);
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
  personal:[{id:genId(),title:"일기 쓰기",           date:todayStr,done:false},{id:genId(),title:"비타민 챙겨먹기",date:todayStr,done:true}],
  apptech: [{id:genId(),title:"캐시워크 걷기",        date:todayStr,done:true}, {id:genId(),title:"토스 행운복권",  date:todayStr,done:false}],
  event:   [{id:genId(),title:"쿠팡 할인쿠폰 확인",  date:todayStr,done:false}],
};

function load(key,fb){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function save(key,v){ try{ localStorage.setItem(key,JSON.stringify(v)); }catch{} }

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

function useIsMobile() {
  const [v,setV]=useState(()=>window.innerWidth<768);
  useEffect(()=>{const h=()=>setV(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  return v;
}

export default function App() {
  const isMobile = useIsMobile();

  const [view,      setView]      = useState("month");
  const [mobileTab, setMobileTab] = useState("month");
  const [curDate,   setCurDate]   = useState(new Date(today.getFullYear(),today.getMonth(),1));
  const [selDate,   setSelDate]   = useState(todayStr);
  const [events,    setEvents]    = useState(()=>load("jjanto_events",INIT_EVENTS));
  const [todos,     setTodos]     = useState(()=>load("jjanto_todos", INIT_TODOS));
  const [cats,      setCats]      = useState(()=>load("jjanto_cats",  CAT_DEFAULTS));
  const [sideOpen,  setSideOpen]  = useState(true);
  const [hideCompleted,setHideCompleted]=useState({apptech:false});
  const [sideFilter,setSideFilter]=useState("all");
  const [shareCard, setShareCard] =useState(false);
  const [syncModal, setSyncModal] =useState(false);  // ← 동기화 모달
  const [importMsg, setImportMsg] =useState(null);   // 성공/오류 메시지
  const cardRef=useRef(null);
  const importRef=useRef(null);
  const [modal,  setModal] =useState(null);
  const [form,   setForm]  =useState({});
  const [proofModal,setProofModal]=useState(null);
  const [todoModal, setTodoModal] =useState(null);
  const [todoForm,  setTodoForm]  =useState({title:"",date:todayStr});
  const [catModal,  setCatModal]  =useState(null);
  const [catForm,   setCatForm]   =useState({name:"",emoji:"⭐",color:C.pink3});

  const setEventsS=v=>{ const n=typeof v==="function"?v(events):v; setEvents(n); save("jjanto_events",n); };
  const setTodosS =v=>{ const n=typeof v==="function"?v(todos):v;  setTodos(n);  save("jjanto_todos",n);  };
  const setCatsS  =v=>{ const n=typeof v==="function"?v(cats):v;   setCats(n);   save("jjanto_cats",n);   };

  // ── 내보내기 ──────────────────────────────────────────────
  function handleExport() {
    const data = { events, todos, cats, exportedAt: new Date().toISOString(), version: 1 };
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `짠토플래너_${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 가져오기 ──────────────────────────────────────────────
  function handleImport(e) {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if(!data.events || !data.todos || !data.cats) throw new Error("올바른 파일이 아니에요");
        setEventsS(data.events);
        setTodosS(data.todos);
        setCatsS(data.cats);
        setImportMsg({ type:"ok", text:`✅ 불러오기 완료! (${data.exportedAt ? new Date(data.exportedAt).toLocaleString("ko-KR") : "날짜 없음"} 저장본)` });
      } catch(err) {
        setImportMsg({ type:"err", text:"❌ 파일을 읽을 수 없어요: "+err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── 계산 헬퍼 ─────────────────────────────────────────────
  const activeCats=cats.filter(c=>!c.hidden);
  const catById=id=>cats.find(c=>c.id===id);
  const allTodosOn=ds=>activeCats.flatMap(c=>(todos[c.id]||[]).filter(t=>!t.date||isSame(t.date,ds)));
  const totalPctOn=ds=>{ const a=allTodosOn(ds); return a.length?Math.round(a.filter(t=>t.done).length/a.length*100):0; };
  const catPctOn=(cid,ds)=>{ const i=(todos[cid]||[]).filter(t=>!t.date||isSame(t.date,ds)); return i.length?Math.round(i.filter(t=>t.done).length/i.length*100):0; };
  function weeklyPct(wn,cid) {
    const y=curDate.getFullYear(),m=curDate.getMonth(),last=new Date(y,m+1,0).getDate();
    let done=0,total=0;
    for(let d=1;d<=last;d++){
      const ds=fmtDate(new Date(y,m,d));
      if(getWeekOfMonth(ds)!==wn) continue;
      const items=cid?(todos[cid]||[]).filter(t=>t.date?isSame(t.date,ds):true):activeCats.flatMap(c=>(todos[c.id]||[]).filter(t=>t.date?isSame(t.date,ds):true));
      total+=items.length; done+=items.filter(t=>t.done).length;
    }
    return total?Math.round(done/total*100):null;
  }
  function weeksInMonth(){
    const y=curDate.getFullYear(),m=curDate.getMonth(),last=new Date(y,m+1,0).getDate();
    const ws=new Set(); for(let d=1;d<=last;d++) ws.add(getWeekOfMonth(fmtDate(new Date(y,m,d)))); return [...ws].sort();
  }
  const eventsOn=ds=>events.filter(e=>e.allDay&&e.endDate?ds>=e.date&&ds<=e.endDate:isSame(e.date,ds)).sort((a,b)=>(a.time||"").localeCompare(b.time||""));

  function openAddEvent(date){ const fc=activeCats[0]; setForm({title:"",date:date||selDate,endDate:"",time:"",allDay:false,catId:fc?.id||"",color:fc?.color||C.pink3,done:false}); setModal("addEvent"); }
  function openEditEvent(e){ setForm({...e}); setModal("editEvent"); }
  function saveEvent(){ if(!form.title.trim()) return; const cat=catById(form.catId); const c={...form,color:cat?.color||form.color}; if(modal==="addEvent") setEventsS(p=>[...p,{...c,id:genId()}]); else setEventsS(p=>p.map(e=>e.id===form.id?{...c}:e)); setModal(null); }
  function deleteEvent(id){ setEventsS(p=>p.filter(e=>e.id!==id)); setModal(null); }
  function openAddTodo(cid){ setTodoForm({title:"",date:""}); setTodoModal({mode:"add",catId:cid}); }
  function openEditTodo(cid,item){ setTodoForm({title:item.title,date:item.date||""}); setTodoModal({mode:"edit",catId:cid,item}); }
  function saveTodo(){ if(!todoForm.title.trim()) return; const {mode,catId,item}=todoModal; if(mode==="add") setTodosS(p=>({...p,[catId]:[...(p[catId]||[]),{id:genId(),title:todoForm.title,date:todoForm.date,done:false}]})); else setTodosS(p=>({...p,[catId]:p[catId].map(t=>t.id===item.id?{...t,title:todoForm.title,date:todoForm.date}:t)})); setTodoModal(null); }
  function deleteTodo(cid,id){ setTodosS(p=>({...p,[cid]:p[cid].filter(t=>t.id!==id)})); setTodoModal(null); }
  function toggleTodo(cid,id){ const item=(todos[cid]||[]).find(t=>t.id===id); if(!item) return; if(!item.done) setProofModal({catId:cid,item}); else setTodosS(p=>({...p,[cid]:p[cid].map(t=>t.id===id?{...t,done:false,proof:null}:t)})); }
  function saveProof(cid,id,url){ setTodosS(p=>({...p,[cid]:p[cid].map(t=>t.id===id?{...t,done:true,proof:url}:t)})); setProofModal(null); }
  function completeWithoutProof(cid,id){ setTodosS(p=>({...p,[cid]:p[cid].map(t=>t.id===id?{...t,done:true}:t)})); setProofModal(null); }
  function saveCat(){ if(!catForm.name.trim()) return; if(catModal==="add"){ const nid=genId(); setCatsS(p=>[...p,{id:nid,...catForm,hidden:false}]); setTodosS(p=>({...p,[nid]:[]})); } else setCatsS(p=>p.map(c=>c.id===catModal.id?{...c,...catForm}:c)); setCatModal(null); }
  function hideCat(id){ setCatsS(p=>p.map(c=>c.id===id?{...c,hidden:true}:c)); setCatModal(null); }
  function showCat(id){ setCatsS(p=>p.map(c=>c.id===id?{...c,hidden:false}:c)); }

  function buildGrid(){ const y=curDate.getFullYear(),m=curDate.getMonth(),first=new Date(y,m,1).getDay(),last=new Date(y,m+1,0).getDate(),cells=[]; for(let i=0;i<first;i++) cells.push(null); for(let d=1;d<=last;d++) cells.push(new Date(y,m,d)); return cells; }
  const cells=buildGrid(), weeks=weeksInMonth();
  const sideEvents=sideFilter==="all"?eventsOn(todayStr):eventsOn(todayStr).filter(e=>e.catId===sideFilter);

  const ModalWrap=({children,onClose,zIndex=100})=>(
    <div style={{position:"fixed",inset:0,background:"rgba(60,20,30,.38)",display:"flex",alignItems:isMobile?"flex-end":"center",justifyContent:"center",zIndex}} onClick={onClose}>
      <div style={{background:C.white,borderRadius:isMobile?"20px 20px 0 0":"20px",padding:26,width:isMobile?"100%":"390px",boxShadow:`0 20px 60px ${C.pink3}55`,maxHeight:"90vh",overflow:"auto"}} onClick={e=>e.stopPropagation()}>{children}</div>
    </div>
  );

  // ── 동기화 모달 ───────────────────────────────────────────
  const SyncModal = () => (
    <ModalWrap onClose={()=>{ setSyncModal(false); setImportMsg(null); }} zIndex={200}>
      <div style={{fontSize:16,fontWeight:800,color:C.rose,marginBottom:6}}>🔄 기기 간 데이터 동기화</div>
      <div style={{fontSize:12,color:C.sub,marginBottom:20,lineHeight:1.7}}>
        JSON 파일로 데이터를 주고받아요.<br/>
        컴퓨터 ↔ 핸드폰 어디서든 쓸 수 있어요!
      </div>

      {/* 내보내기 */}
      <div style={{background:"#FFF0F5",borderRadius:14,padding:"16px",marginBottom:12,border:`1.5px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:24}}>💾</span>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:C.text}}>내보내기</div>
            <div style={{fontSize:11,color:C.sub}}>이 기기의 데이터를 파일로 저장해요</div>
          </div>
        </div>
        <button onClick={handleExport} style={{width:"100%",padding:"11px",borderRadius:10,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:14,cursor:"pointer"}}>
          📥 파일로 저장하기
        </button>
      </div>

      {/* 가져오기 */}
      <div style={{background:"#F0FFF8",borderRadius:14,padding:"16px",border:"1.5px solid #B2DFDB"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <span style={{fontSize:24}}>📂</span>
          <div>
            <div style={{fontSize:14,fontWeight:800,color:C.text}}>가져오기</div>
            <div style={{fontSize:11,color:C.sub}}>저장된 파일을 불러와서 적용해요</div>
          </div>
        </div>
        <label style={{display:"block",width:"100%",padding:"11px",borderRadius:10,background:"#7EC8A4",color:C.white,fontWeight:800,fontSize:14,cursor:"pointer",textAlign:"center",boxSizing:"border-box"}}>
          📤 파일 선택해서 불러오기
          <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImport}/>
        </label>
        <div style={{marginTop:8,fontSize:11,color:"#555",lineHeight:1.5}}>⚠️ 현재 데이터가 파일 내용으로 <b>덮어씌워져요</b></div>
      </div>

      {/* 결과 메시지 */}
      {importMsg && (
        <div style={{marginTop:12,padding:"10px 14px",borderRadius:10,background:importMsg.type==="ok"?"#E8F5E9":"#FFEBEE",color:importMsg.type==="ok"?"#2E7D32":"#C62828",fontSize:13,fontWeight:600}}>
          {importMsg.text}
        </div>
      )}

      {/* 사용 가이드 */}
      <div style={{marginTop:16,background:"#FFF8FA",borderRadius:12,padding:"12px 14px",border:`1px dashed ${C.border}`}}>
        <div style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6}}>💡 이렇게 쓰세요</div>
        <div style={{fontSize:11,color:C.sub,lineHeight:1.8}}>
          1️⃣ 컴퓨터에서 <b>내보내기</b> → 파일 저장<br/>
          2️⃣ 파일을 카카오톡·이메일로 폰에 전송<br/>
          3️⃣ 폰에서 <b>가져오기</b> → 파일 선택
        </div>
      </div>

      <button onClick={()=>{ setSyncModal(false); setImportMsg(null); }} style={{width:"100%",marginTop:14,padding:"11px",borderRadius:10,background:C.pink1,color:C.sub,border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}>닫기</button>
    </ModalWrap>
  );

  // ── 사이드바 ──────────────────────────────────────────────
  const SidebarContent=()=>(
    <div style={{padding:"18px 14px",display:"flex",flexDirection:"column",gap:2,overflow:"auto",flex:1}}>
      {!isMobile&&<div style={{fontSize:19,fontWeight:800,color:C.rose,padding:"2px 6px 10px",display:"flex",alignItems:"center",gap:8}}>🍅 짠토의 플래너</div>}

      {/* 동기화 버튼 */}
      <button onClick={()=>setSyncModal(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderRadius:12,cursor:"pointer",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#E8F5E9,#F0FFF8)",color:"#2E7D32",border:"1.5px solid #A5D6A7",width:"100%",textAlign:"left",marginBottom:6}}>
        <span>🔄</span> 기기 간 데이터 동기화
        <span style={{marginLeft:"auto",fontSize:10,opacity:.7}}>내보내기 / 가져오기</span>
      </button>

      {!isMobile&&[["month","🗓️","월간 캘린더"],["list","✅","할 일 목록"]].map(([v,ic,lb])=>(
        <button key={v} onClick={()=>setView(v)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:12,cursor:"pointer",fontSize:14,fontWeight:view===v?700:500,background:view===v?C.pink2:"transparent",color:view===v?C.white:C.sub,border:"none",width:"100%",textAlign:"left"}}>
          <span>{ic}</span>{lb}
        </button>
      ))}

      <div style={{margin:"12px 0 6px",fontSize:11,fontWeight:800,color:C.sub,padding:"0 6px"}}>오늘 일정 🌸</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
        <button onClick={()=>setSideFilter("all")} style={{padding:"3px 9px",borderRadius:99,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:sideFilter==="all"?C.rose:C.pink1,color:sideFilter==="all"?C.white:C.sub}}>전체</button>
        {activeCats.map(cat=><button key={cat.id} onClick={()=>setSideFilter(sideFilter===cat.id?"all":cat.id)} style={{padding:"3px 8px",borderRadius:99,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:sideFilter===cat.id?cat.color:C.pink1,color:sideFilter===cat.id?C.white:C.sub}}>{cat.emoji}</button>)}
      </div>
      <div style={{background:C.white,borderRadius:12,padding:"10px 12px",border:`1px solid ${C.border}`,minHeight:60}}>
        {sideEvents.length===0&&<div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"6px 0"}}>일정이 없어요</div>}
        {sideEvents.map(e=>{ const cat=catById(e.catId); return (
          <div key={e.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,cursor:"pointer"}} onClick={()=>openEditEvent(e)}>
            <span style={{fontSize:13}}>{cat?.emoji||"📌"}</span>
            <div style={{flex:1,overflow:"hidden"}}>
              <div style={{fontSize:12,color:C.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.title}</div>
              {e.time&&<div style={{fontSize:10,color:C.sub}}>{e.time}</div>}
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

  const MonthView=()=>(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",background:C.white,borderBottom:`1px solid ${C.border}`}}>
        {DAYS_KO.map((d,i)=><div key={d} style={{padding:isMobile?"5px 0":"8px 0",textAlign:"center",fontSize:isMobile?11:12,fontWeight:800,color:[0,6].includes(i)?C.rose:C.sub}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",flex:1,overflow:"auto",background:C.bg}}>
        {cells.map((day,i)=>{
          if(!day) return <div key={i} style={{background:"#fff8fa",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`}}/>;
          const ds=fmtDate(day),isToday=isSame(ds,todayStr),isSel=ds===selDate;
          const dayEvs=eventsOn(ds),maxEvs=isMobile?1:3;
          const dPct=(()=>{ const a=allTodosOn(ds); return a.length?Math.round(a.filter(t=>t.done).length/a.length*100):null; })();
          return (
            <div key={i} onClick={()=>{ setSelDate(ds); if(isMobile) setMobileTab("today"); }} style={{padding:isMobile?"3px 2px":"5px 6px",borderRight:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,minHeight:isMobile?56:88,cursor:"pointer",background:isSel?"#fff0f3":isToday?"#fff8fb":C.white}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:isMobile?20:24,height:isMobile?20:24,borderRadius:"50%",fontSize:isMobile?11:12,fontWeight:isToday?800:500,background:isToday?C.rose:"transparent",color:isToday?C.white:[0,6].includes(day.getDay())?C.pink3:C.text}}>{day.getDate()}</div>
                {dPct!==null&&!isMobile&&<span style={{fontSize:9,fontWeight:700,color:C.sub,background:C.pink1,borderRadius:99,padding:"1px 5px"}}>{dPct}%</span>}
              </div>
              {dayEvs.slice(0,maxEvs).map(e=>{ const isStart=isSame(e.date,ds); return (
                <div key={e.id} onClick={ev=>{ev.stopPropagation();openEditEvent(e);}} style={{padding:isMobile?"1px 3px":"2px 5px",borderRadius:6,fontSize:isMobile?9:10,fontWeight:600,background:e.color+"22",color:e.color,marginTop:2,overflow:"hidden",whiteSpace:"nowrap",cursor:"pointer"}}>
                  {isStart?e.title:"↔"}
                </div>
              );})}
              {dayEvs.length>maxEvs&&<div style={{fontSize:9,color:C.sub,marginTop:1}}>+{dayEvs.length-maxEvs}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  const ListView=()=>(
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
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(270px,1fr))",gap:isMobile?10:14}}>
        {activeCats.map(cat=>{
          const items=(todos[cat.id]||[]).filter(t=>!t.date||isSame(t.date,selDate));
          const pct=catPctOn(cat.id,selDate),isHiding=!!hideCompleted[cat.id];
          const vis=isHiding?items.filter(t=>!t.done):items, hiddenCount=items.filter(t=>t.done).length;
          return (
            <div key={cat.id} style={{background:C.white,borderRadius:16,padding:"14px",border:`1.5px solid ${C.border}`,boxShadow:`0 2px 10px ${C.pink1}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>{cat.emoji}</span>
                  <span style={{fontSize:14,fontWeight:800}}>{cat.name}</span>
                  <span style={{fontSize:10,color:cat.color,background:cat.color+"22",padding:"2px 8px",borderRadius:99}}>{items.length}개</span>
                </div>
                <div style={{display:"flex",gap:3,alignItems:"center"}}>
                  {cat.id==="apptech"&&<button onClick={()=>setHideCompleted(p=>({...p,apptech:!p.apptech}))} style={{padding:"3px 8px",borderRadius:99,border:`1.5px solid ${isHiding?cat.color:C.border}`,background:isHiding?cat.color+"22":C.white,color:isHiding?cat.color:C.sub,cursor:"pointer",fontSize:11,fontWeight:700}}>{isHiding?`✅ (${hiddenCount})`:"완료숨기기"}</button>}
                  <button onClick={()=>{setCatForm({name:cat.name,emoji:cat.emoji,color:cat.color});setCatModal({id:cat.id});}} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.sub}}>✏️</button>
                  <button onClick={()=>openAddTodo(cat.id)} style={{background:cat.color,border:"none",borderRadius:8,padding:"3px 10px",cursor:"pointer",color:C.white,fontWeight:800}}>+</button>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Bar pct={pct} color={cat.color}/><span style={{fontSize:11,fontWeight:700,color:cat.color,minWidth:28}}>{pct}%</span></div>
              {vis.length===0&&items.length===0&&<div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>할 일을 추가해봐요 🌸</div>}
              {vis.length===0&&items.length>0&&<div style={{fontSize:12,color:C.sub,textAlign:"center",padding:"8px 0"}}>🎉 모두 완료!</div>}
              {vis.map(item=>(
                <div key={item.id} style={{padding:"6px 0",borderBottom:`1px dashed ${C.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <input type="checkbox" checked={item.done} onChange={()=>toggleTodo(cat.id,item.id)} style={{width:18,height:18,accentColor:cat.color,cursor:"pointer",flexShrink:0}}/>
                    <span style={{flex:1,fontSize:13,color:item.done?C.sub:C.text,textDecoration:item.done?"line-through":"none",fontWeight:item.done?400:600}}>
                      {!item.date&&<span style={{fontSize:10,background:cat.color+"33",color:cat.color,borderRadius:4,padding:"1px 5px",marginRight:4}}>🔁</span>}{item.title}
                    </span>
                    {item.done&&item.proof?<img src={item.proof} onClick={()=>setProofModal({catId:cat.id,item,viewOnly:true})} style={{width:32,height:32,borderRadius:6,objectFit:"cover",border:`2px solid ${cat.color}`,cursor:"pointer",flexShrink:0}}/>
                      :item.done?<button onClick={()=>setProofModal({catId:cat.id,item})} style={{fontSize:11,padding:"2px 7px",borderRadius:99,border:`1.5px dashed ${cat.color}`,background:"none",color:cat.color,cursor:"pointer",flexShrink:0}}>📷</button>:null}
                    <button onClick={()=>openEditTodo(cat.id,item)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:C.sub,padding:0,opacity:.6}}>✏️</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
        <div onClick={()=>{setCatForm({name:"",emoji:"⭐",color:C.pink3});setCatModal("add");}} style={{background:"#fff8fa",borderRadius:16,padding:"16px",border:`1.5px dashed ${C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:6,color:C.sub,minHeight:100,transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background=C.pink1} onMouseLeave={e=>e.currentTarget.style.background="#fff8fa"}>
          <span style={{fontSize:26}}>＋</span><span style={{fontSize:12,fontWeight:700}}>분류 추가</span>
        </div>
      </div>
    </div>
  );

  const TodayMobileView=()=>{
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
          <button onClick={()=>setSyncModal(true)} style={{background:"linear-gradient(135deg,#E8F5E9,#C8E6C9)",border:"1.5px solid #A5D6A7",borderRadius:10,padding:"7px 12px",cursor:"pointer",color:"#2E7D32",fontWeight:800,fontSize:12}}>🔄 동기화</button>
        </div>
        {evs.length>0&&<><div style={{fontSize:12,fontWeight:800,color:C.sub,marginBottom:8}}>📅 일정</div>{evs.map(e=>{ const cat=catById(e.catId); return <div key={e.id} onClick={()=>openEditEvent(e)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:C.white,borderRadius:12,marginBottom:6,border:`1.5px solid ${e.color}33`,cursor:"pointer"}}><span style={{fontSize:18}}>{cat?.emoji||"📌"}</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{e.title}</div><div style={{fontSize:11,color:C.sub}}>{e.time||"종일"}</div></div></div>; })}</>}
        <div style={{fontSize:12,fontWeight:800,color:C.sub,marginBottom:8}}>✅ 할 일</div>
        {activeCats.map(cat=>{ const items=(todos[cat.id]||[]).filter(t=>!t.date||isSame(t.date,selDate)); if(!items.length) return null; return (
          <div key={cat.id} style={{background:C.white,borderRadius:14,padding:"12px 14px",border:`1.5px solid ${C.border}`,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:16}}>{cat.emoji}</span><span style={{fontSize:13,fontWeight:800}}>{cat.name}</span></div>
              <div style={{display:"flex",gap:6}}><span style={{fontSize:11,fontWeight:700,color:cat.color}}>{catPctOn(cat.id,selDate)}%</span><button onClick={()=>openAddTodo(cat.id)} style={{background:cat.color,border:"none",borderRadius:8,padding:"3px 10px",cursor:"pointer",color:C.white,fontWeight:800}}>+</button></div>
            </div>
            <div style={{height:4,borderRadius:99,background:C.pink1,overflow:"hidden",marginBottom:8}}><div style={{width:`${catPctOn(cat.id,selDate)}%`,height:"100%",borderRadius:99,background:cat.color}}/></div>
            {items.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:`1px dashed ${C.border}`}}>
                <input type="checkbox" checked={item.done} onChange={()=>toggleTodo(cat.id,item.id)} style={{width:20,height:20,accentColor:cat.color,cursor:"pointer",flexShrink:0}}/>
                <span style={{flex:1,fontSize:14,color:item.done?C.sub:C.text,textDecoration:item.done?"line-through":"none"}}>{item.title}</span>
                {item.done&&item.proof?<img src={item.proof} onClick={()=>setProofModal({catId:cat.id,item,viewOnly:true})} style={{width:32,height:32,borderRadius:6,objectFit:"cover",border:`2px solid ${cat.color}`,cursor:"pointer"}}/>
                  :item.done?<button onClick={()=>setProofModal({catId:cat.id,item})} style={{fontSize:18,background:"none",border:"none",cursor:"pointer",padding:0}}>📷</button>:null}
              </div>
            ))}
          </div>
        );})}
        <button onClick={()=>openAddEvent(selDate)} style={{width:"100%",padding:"13px",borderRadius:14,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:15,cursor:"pointer",marginTop:4}}>🍅 일정 추가</button>
      </div>
    );
  };

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Nunito','Apple SD Gothic Neo',sans-serif",background:C.bg,color:C.text,overflow:"hidden",flexDirection:"column"}}>

      {/* 데스크탑 */}
      {!isMobile&&(
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          <aside style={{width:sideOpen?260:0,minWidth:sideOpen?260:0,background:"linear-gradient(160deg,#fff0f3,#ffe4ec)",borderRight:`1.5px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden",transition:"all .25s",flexShrink:0}}>
            <SidebarContent/>
          </aside>
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",borderBottom:`1.5px solid ${C.border}`,background:C.white,flexWrap:"wrap"}}>
              <button onClick={()=>setSideOpen(p=>!p)} style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:C.rose}}>☰</button>
              <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()-1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>‹</button>
              <button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()+1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:C.rose,fontWeight:700}}>›</button>
              <span style={{fontSize:16,fontWeight:800,color:C.rose}}>{curDate.getFullYear()}년 {MONTHS_KO[curDate.getMonth()]}</span>
              <button onClick={()=>{setCurDate(new Date(today.getFullYear(),today.getMonth(),1));setSelDate(todayStr);}} style={{background:C.pink2,border:"none",borderRadius:8,padding:"5px 12px",cursor:"pointer",color:C.white,fontWeight:700,fontSize:12}}>오늘</button>
              <div style={{flex:1}}/>
              {["month","list"].map(v=><button key={v} onClick={()=>setView(v)} style={{padding:"6px 14px",borderRadius:20,border:`2px solid ${view===v?C.rose:C.border}`,background:view===v?C.rose:C.white,color:view===v?C.white:C.sub,fontSize:12,cursor:"pointer",fontWeight:700}}>{v==="month"?"🗓 월간":"✅ 할일"}</button>)}
              <button onClick={()=>openAddEvent(selDate)} style={{padding:"7px 16px",borderRadius:20,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontWeight:800,fontSize:13,cursor:"pointer"}}>🍅 추가</button>
            </div>
            {view==="month"&&<MonthView/>}
            {view==="list"&&<ListView/>}
          </div>
        </div>
      )}

      {/* 모바일 */}
      {isMobile&&(
        <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 16px",background:C.white,borderBottom:`1.5px solid ${C.border}`,flexShrink:0}}>
            <span style={{fontSize:15,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</span>
            <div style={{display:"flex",gap:6}}>
              {mobileTab==="month"&&<><button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()-1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 9px",cursor:"pointer",color:C.rose,fontWeight:700}}>‹</button><span style={{fontSize:13,fontWeight:800,color:C.rose}}>{curDate.getFullYear()}년 {MONTHS_KO[curDate.getMonth()]}</span><button onClick={()=>{const d=new Date(curDate);d.setMonth(d.getMonth()+1);setCurDate(d);}} style={{background:C.pink1,border:"none",borderRadius:8,padding:"5px 9px",cursor:"pointer",color:C.rose,fontWeight:700}}>›</button></>}
              <button onClick={()=>openAddEvent(selDate)} style={{background:`linear-gradient(135deg,${C.pink3},${C.rose})`,border:"none",borderRadius:10,padding:"6px 12px",cursor:"pointer",color:C.white,fontWeight:800,fontSize:13}}>＋</button>
            </div>
          </div>
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            {mobileTab==="month"&&<MonthView/>}
            {mobileTab==="list"&&<ListView/>}
            {mobileTab==="today"&&<TodayMobileView/>}
          </div>
          <div style={{display:"flex",borderTop:`1.5px solid ${C.border}`,background:C.white,flexShrink:0,paddingBottom:"env(safe-area-inset-bottom)"}}>
            {[{tab:"month",icon:"🗓️",label:"캘린더"},{tab:"today",icon:"✨",label:"오늘"},{tab:"list",icon:"✅",label:"할일"},{tab:"sync",icon:"🔄",label:"동기화"}].map(({tab,icon,label})=>(
              <button key={tab} onClick={()=>tab==="sync"?setSyncModal(true):setMobileTab(tab)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 0",border:"none",background:"transparent",cursor:"pointer",color:mobileTab===tab?C.rose:C.sub,gap:2}}>
                <span style={{fontSize:tab==="sync"?18:20}}>{icon}</span>
                <span style={{fontSize:10,fontWeight:mobileTab===tab?800:500}}>{label}</span>
                {mobileTab===tab&&tab!=="sync"&&<div style={{width:20,height:3,borderRadius:99,background:C.rose,marginTop:2}}/>}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isMobile&&<button onClick={()=>openAddEvent(selDate)} style={{position:"fixed",bottom:24,right:24,width:52,height:52,borderRadius:"50%",background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white,border:"none",fontSize:26,cursor:"pointer",boxShadow:`0 4px 20px ${C.rose}66`,display:"flex",alignItems:"center",justifyContent:"center",zIndex:50}}>🍅</button>}

      {/* 동기화 모달 */}
      {syncModal&&<SyncModal/>}

      {/* 이벤트 모달 */}
      {(modal==="addEvent"||modal==="editEvent")&&(
        <ModalWrap onClose={()=>setModal(null)}>
          <div style={{fontSize:16,fontWeight:800,color:C.rose,marginBottom:16}}>🍅 {modal==="addEvent"?"새 일정 추가":"일정 편집"}</div>
          <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>제목</label>
          <input style={inp} placeholder="일정 제목" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} autoFocus/>
          <label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:6,display:"block"}}>분류</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {activeCats.map(cat=><button key={cat.id} onClick={()=>setForm(p=>({...p,catId:cat.id,color:cat.color}))} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 12px",borderRadius:99,border:`2px solid ${form.catId===cat.id?cat.color:C.border}`,background:form.catId===cat.id?cat.color+"22":C.white,color:form.catId===cat.id?cat.color:C.sub,cursor:"pointer",fontSize:12,fontWeight:700}}>{cat.emoji} {cat.name}</button>)}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 14px",background:"#FFF0F5",borderRadius:12,border:`1.5px solid ${C.border}`}}>
            <span>🌟</span><span style={{fontSize:13,fontWeight:700,flex:1}}>종일 / 기간 일정</span>
            <div onClick={()=>setForm(p=>({...p,allDay:!p.allDay,time:""}))} style={{width:42,height:24,borderRadius:99,background:form.allDay?C.rose:C.pink1,cursor:"pointer",position:"relative"}}>
              <div style={{position:"absolute",top:3,left:form.allDay?20:3,width:18,height:18,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
            </div>
          </div>
          {form.allDay?(
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>시작일</label><input type="date" style={inp} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div style={{flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>종료일</label><input type="date" style={inp} value={form.endDate||form.date} min={form.date} onChange={e=>setForm(p=>({...p,endDate:e.target.value}))}/></div>
            </div>
          ):(
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>날짜</label><input type="date" style={inp} value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></div>
              <div style={{flex:1}}><label style={{fontSize:11,fontWeight:800,color:C.sub,marginBottom:4,display:"block"}}>시간</label><input type="time" style={inp} value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))}/></div>
            </div>
          )}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
            {modal==="editEvent"&&<button onClick={()=>deleteEvent(form.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>}
            <button onClick={()=>setModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
            <button onClick={saveEvent} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>저장</button>
          </div>
        </ModalWrap>
      )}

      {/* 할일 모달 */}
      {todoModal&&(
        <ModalWrap onClose={()=>setTodoModal(null)}>
          <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16}}>🌸 할 일 {todoModal.mode==="add"?"추가":"편집"}</div>
          <input style={inp} placeholder="할 일 내용" value={todoForm.title} onChange={e=>setTodoForm(p=>({...p,title:e.target.value}))} autoFocus/>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 14px",background:"#FFF0F5",borderRadius:12,border:`1.5px solid ${C.border}`}}>
            <span>🔁</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>매일 반복 (루틴)</div><div style={{fontSize:10,color:C.sub}}>날짜 없이 등록하면 매일 보여요</div></div>
            <div onClick={()=>setTodoForm(p=>({...p,date:p.date?"":selDate}))} style={{width:42,height:24,borderRadius:99,background:!todoForm.date?C.rose:C.pink1,cursor:"pointer",position:"relative"}}>
              <div style={{position:"absolute",top:3,left:!todoForm.date?20:3,width:18,height:18,borderRadius:"50%",background:C.white,transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
            </div>
          </div>
          {todoForm.date&&<input type="date" style={inp} value={todoForm.date} onChange={e=>setTodoForm(p=>({...p,date:e.target.value}))}/>}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            {todoModal.mode==="edit"&&<button onClick={()=>deleteTodo(todoModal.catId,todoModal.item.id)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>}
            <button onClick={()=>setTodoModal(null)} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>취소</button>
            <button onClick={saveTodo} style={{padding:"8px 18px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>저장</button>
          </div>
        </ModalWrap>
      )}

      {/* 분류 모달 */}
      {catModal&&(
        <ModalWrap onClose={()=>setCatModal(null)}>
          <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16}}>🍅 분류 {catModal==="add"?"추가":"편집"}</div>
          <input style={inp} placeholder="이모지" value={catForm.emoji} onChange={e=>setCatForm(p=>({...p,emoji:e.target.value}))}/>
          <input style={inp} placeholder="분류 이름" value={catForm.name} onChange={e=>setCatForm(p=>({...p,name:e.target.value}))} autoFocus/>
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

      {/* 인증샷 모달 */}
      {proofModal&&(
        <ModalWrap onClose={()=>setProofModal(null)} zIndex={200}>
          {proofModal.viewOnly?(
            <><div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:14}}>📷 인증샷</div>
            <img src={proofModal.item.proof} style={{width:"100%",borderRadius:12,objectFit:"cover",maxHeight:280}} alt="인증샷"/>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
              <button onClick={()=>{setTodosS(p=>({...p,[proofModal.catId]:p[proofModal.catId].map(t=>t.id===proofModal.item.id?{...t,proof:null}:t)}));setProofModal(null);}} style={{padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#ffe4e4",color:C.tomato}}>삭제</button>
              <button onClick={()=>setProofModal(null)} style={{padding:"7px 18px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:800,background:`linear-gradient(135deg,${C.pink3},${C.rose})`,color:C.white}}>닫기</button>
            </div></>
          ):(
            <><div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:4}}>📷 인증샷 추가</div>
            <div style={{fontSize:12,color:C.sub,marginBottom:16}}>{proofModal.item.title}</div>
            <label style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8,padding:"28px",border:`2px dashed ${C.pink2}`,borderRadius:14,cursor:"pointer",background:"#FFF8FA",marginBottom:14}}>
              <span style={{fontSize:36}}>📷</span><span style={{fontSize:14,fontWeight:700,color:C.sub}}>사진 선택 또는 촬영</span>
              <input type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{ const f=e.target.files?.[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>saveProof(proofModal.catId,proofModal.item.id,ev.target.result); r.readAsDataURL(f); }}/>
            </label>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>completeWithoutProof(proofModal.catId,proofModal.item.id)} style={{padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:C.pink1,color:C.sub}}>인증샷 없이 완료</button>
              <button onClick={()=>setProofModal(null)} style={{padding:"7px 14px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,background:"#ffe4e4",color:C.tomato}}>취소</button>
            </div></>
          )}
        </ModalWrap>
      )}

      {/* 달성률 카드 */}
      {shareCard&&(
        <ModalWrap onClose={()=>setShareCard(false)} zIndex={300}>
          <div style={{fontSize:15,fontWeight:800,color:C.rose,marginBottom:16,textAlign:"center"}}>📸 오늘의 달성률 카드</div>
          <div ref={cardRef} style={{background:"linear-gradient(135deg,#fff0f3,#ffe4ec)",borderRadius:20,padding:"24px 20px",border:`2px solid ${C.border}`,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div><div style={{fontSize:18,fontWeight:800,color:C.rose}}>🍅 짠토의 플래너</div><div style={{fontSize:12,color:C.sub}}>{selDate}</div></div>
              <Ring pct={totalPctOn(selDate)} size={66} stroke={7} color={C.rose} bg={C.pink1}/>
            </div>
            {activeCats.map(cat=>{ const pct=catPctOn(cat.id,selDate); const items=(todos[cat.id]||[]).filter(t=>!t.date||isSame(t.date,selDate)); if(!items.length) return null; return (
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
