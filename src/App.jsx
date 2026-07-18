import { useState, useRef } from "react";
import { pushPlannerData, pullPlannerData } from "./firebase";

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

const today    = new Date();
const todayStr = fmtDate(today);

// 데이터를 깔끔하게 정리하는 핵심 함수
function cleanTodoItem(t) {
  const n = { ...t };
  // 타입에 따라 필요 없는 필드를 확실히 제거
  if (n.date) {
    // 1회성 할 일 (루틴 필드 제거)
    delete n.startDate; delete n.endDate; delete n.repeatType; delete n.weekDays; delete n.monthDay; delete n.doneLog;
  } else if (n.endDate) {
    // 기간 할 일 (루틴 필드 제거, done 유지)
    delete n.weekDays; delete n.monthDay;
  } else {
    // 반복 루틴 (날짜 필드 제거)
    delete n.date; delete n.done; delete n.endDate;
  }
  return n;
}
