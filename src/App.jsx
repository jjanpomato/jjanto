<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>🧂 짠짠의 기록</title>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Poor+Story&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:"Poor Story",cursive;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:20px 12px 60px;gap:16px;background:#f0f7ff;}
.app-header{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center; width:100%; max-width:1100px;}
.app-header h1{font-size:clamp(20px,4vw,32px);text-shadow:2px 2px 0 rgba(0,0,0,.08); display:flex; align-items:center; gap:6px;}
.ver{font-size:14px; background:#fff; color:#5c9ad6; padding:2px 8px; border-radius:10px; border:1px solid #cbe0f5; box-shadow:0 2px 4px rgba(0,0,0,.05);}
.potato-deco{font-size:26px;animation:bounce 1.8s infinite ease-in-out;}
@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.tab-bar{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;width:100%;max-width:1100px;}
.tab-btn{padding:8px 14px;border-radius:999px;border:2px solid #cbe0f5;background:#fff;color:#4a78a6;font-family:"Poor Story",cursive;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;}
.tab-btn.active{color:#fff;background:linear-gradient(135deg,#5c9ad6,#7fb3eb);}
.tab-page{display:none;width:100%;max-width:1100px;}
.tab-page.active{display:block;}
.panel{background:#fff;border:2px solid #cbe0f5;border-radius:20px;padding:18px;display:flex;flex-direction:column;gap:12px;box-shadow:0 4px 18px rgba(0,0,0,.05);}
.pt{font-size:15px;color:#5c9ad6;}
.sg{display:flex;flex-direction:column;gap:6px;}
input.ti{width:100%;background:#fafcff;border:2px solid #cbe0f5;border-radius:10px;color:#1c2d3d;font-family:"Poor Story",cursive;font-size:13px;padding:7px 11px;outline:none;}
input.ti:focus{border-color:#5c9ad6;}
.div{border:none;border-top:1.5px dashed #cbe0f5;}
.dl{width:100%;padding:12px;border-radius:13px;color:#fff;font-family:"Poor Story",cursive;font-size:15px;border:none;cursor:pointer;}
.dl:hover{opacity:.9;} .dl:disabled{opacity:.4;cursor:not-allowed;}
.bsm{border:1.5px solid #cbe0f5;font-size:11px;padding:4px 10px;border-radius:999px;cursor:pointer;font-family:"Poor Story",cursive;font-weight:700;background:#e1effc;color:#5c9ad6;}
.bsm:hover{background:#cbe0f5;}
.te{width:100%;border-collapse:collapse;font-size:15px;}
.te td,.te th{border:1.5px solid #cbe0f5;padding:0;background:#fff;position:relative;}
.te th{background:#e1effc;}
.te input{width:100%;background:transparent;border:none;color:#1c2d3d;padding:8px 10px;font-size:15px;font-family:"Poor Story",cursive;outline:none;}
.te input:focus{background:#e6f0fa;}
.ft{display:flex;flex-direction:column;gap:16px;}
.mb{background:#fff;border:2px solid #cbe0f5;border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.mb h2{font-size:17px;white-space:nowrap;}
.sc{font-family:"Poor Story",cursive;font-size:14px;border:2px solid #cbe0f5;border-radius:10px;padding:6px 10px;background:#fafcff;color:#1c2d3d;outline:none;cursor:pointer;}
.pill{border-radius:999px;padding:5px 14px;font-size:14px;font-weight:700;white-space:nowrap;background:#b3d4f5;color:#2b4f73;}
.sav{margin-left:auto;padding:8px 16px;border-radius:999px;color:#fff;font-family:"Poor Story",cursive;font-size:13px;font-weight:700;border:none;cursor:pointer;white-space:nowrap;background:linear-gradient(135deg,#5c9ad6,#7fb3eb);}
.cs{background:#fff;border:2px solid #cbe0f5;border-radius:16px;padding:16px 18px;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.cs h3{font-size:14px;margin-bottom:12px;}
.crow{display:flex;align-items:center;gap:20px;flex-wrap:wrap;}
.dw{position:relative;flex-shrink:0;}
.dc{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;}
.dc .dl2{font-size:10px;color:#4a78a6;}
.dc .dv{font-size:14px;font-weight:700;}
.ll2{display:flex;flex-direction:column;gap:5px;flex:1;min-width:140px;}
.li{display:flex;align-items:center;gap:7px;font-size:12px;}
.ld{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
.lp{margin-left:auto;font-weight:700;color:#4a78a6;font-size:11px;}
.cm{background:#fff;border:2px solid #cbe0f5;border-radius:16px;padding:14px 18px;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.cm h3{font-size:14px;margin-bottom:10px;}
.cw{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px;}
.chip{display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:999px;font-family:"Poor Story",cursive;font-size:12px;font-weight:700;border:1.5px solid rgba(0,0,0,.08);}
.chip .xd{cursor:pointer;font-size:10px;opacity:.6;margin-left:2px;}
.chip .xd:hover{opacity:1;color:#5c9ad6;}
.car{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-top:8px;}
.cni{font-family:"Poor Story",cursive;font-size:13px;border:2px solid #cbe0f5;border-radius:10px;padding:5px 10px;outline:none;width:120px;background:#fafcff;}
.cni:focus{border-color:#5c9ad6;}
.pr{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:4px;}
.pd{width:26px;height:26px;border-radius:50%;cursor:pointer;border:2.5px solid transparent;flex-shrink:0;}
.pd:hover{transform:scale(1.15);}
.pd.sel{border-color:#333;transform:scale(1.15);}
.cac{padding:6px 14px;border-radius:999px;color:#fff;font-family:"Poor Story",cursive;font-size:12px;font-weight:700;border:none;cursor:pointer;background:#5c9ad6;}
.fs{background:#fff;border:2px solid #cbe0f5;border-radius:14px;padding:12px 16px;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.fbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.fl{font-size:12px;color:#4a78a6;font-weight:700;white-space:nowrap;}
.fc{padding:4px 12px;border-radius:999px;border:1.5px solid rgba(0,0,0,.1);background:#f8f8f8;color:#333;font-family:"Poor Story",cursive;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;}
.fc.active{border-color:transparent;box-shadow:0 2px 6px rgba(0,0,0,.15);background:#5c9ad6;color:#fff;}
.dtw{background:#fff;border:2px solid #cbe0f5;border-radius:16px;overflow:hidden;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.dt{width:100%;border-collapse:collapse;font-size:13px;}
.dt thead th{font-weight:700;padding:10px 12px;text-align:center;border-bottom:2px solid #cbe0f5;white-space:nowrap;background:#e1effc;color:#3a5f85;}
.dt tbody tr{border-bottom:1px solid #e1effc;}
.dt tbody tr:hover{background:#fafcff;}
.dt tbody td{padding:7px 10px;vertical-align:middle;}
.dt tbody td input{width:100%;background:transparent;border:none;font-family:"Poor Story",cursive;font-size:13px;color:#1c2d3d;outline:none;padding:2px 0;}
.dt tbody td input:focus{background:#e6f0fa;border-radius:4px;padding:2px 4px;}
.dt tbody td select{background:transparent;border:none;font-family:"Poor Story",cursive;font-size:12px;color:#1c2d3d;outline:none;cursor:pointer;}
.cpc{text-align:center;padding:6px 8px!important;}
.cps{display:inline-block;padding:3px 12px;border-radius:999px;font-family:"Poor Story",cursive;font-size:12px;font-weight:700;border:none;cursor:pointer;outline:none;-webkit-appearance:none;text-align:center;}
.arb{width:100%;padding:10px;background:#fafcff;border:none;border-top:1.5px dashed #cbe0f5;color:#4a78a6;font-family:"Poor Story",cursive;font-size:13px;cursor:pointer;}
.arb:hover{background:#e1effc;color:#5c9ad6;}
.stit{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.stit h3{font-size:13px;color:#4a78a6;}
.stag{border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700;background:#b3d4f5;color:#2b4f73;}
.ws{background:#fff;border:2px solid #cbe0f5;border-radius:16px;padding:16px;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.wt{font-size:14px;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.ag{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
@media(max-width:700px){.ag{grid-template-columns:1fr;}}
.ai{width:14px;height:14px;border-radius:50%;flex-shrink:0;cursor:pointer;}
.an{font-family:"Poor Story",cursive;font-size:13px;border:none;background:transparent;outline:none;flex:1;color:#1c2d3d;min-width:60px;}
.av{font-family:"Poor Story",cursive;font-size:13px;border:none;background:transparent;outline:none;width:110px;text-align:right;font-weight:700;}
.ap{font-size:11px;color:#4a78a6;width:38px;text-align:right;white-space:nowrap;}
.arow{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #cbe0f5;}
.arow:last-of-type{border-bottom:none;}
.mo{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;align-items:center;justify-content:center;}
.mo.open{display:flex;}
.mb2{background:#fff;border-radius:20px;padding:24px;max-width:560px;width:92%;display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 40px rgba(0,0,0,.2);max-height:90vh;overflow-y:auto;}
.mt2{font-size:16px;font-weight:700;}
.mf{width:100%;border-radius:12px;overflow:hidden;border:2px solid #cbe0f5;}
.mc{width:100%;display:flex;flex-direction:column;padding:20px;position:relative;overflow:hidden;gap:8px;background:linear-gradient(135deg,#f0f7ff,#e1effc);}
.mbs{display:flex;gap:10px;}
.mbs button{flex:1;padding:10px;border-radius:12px;font-family:"Poor Story",cursive;font-size:14px;font-weight:700;border:none;cursor:pointer;}
.mcl{background:#f0f0f0;color:#666;}
.mrb{display:flex;gap:6px;}
.mrb button{flex:1;padding:6px;border-radius:9px;border:2px solid #cbe0f5;background:#fafcff;color:#4a78a6;font-size:12px;font-family:"Poor Story",cursive;font-weight:700;cursor:pointer;}
.mrb button.active{color:#fff;border-color:transparent;background:#5c9ad6;}
.wcard{background:#fff;border:2px solid #cbe0f5;border-radius:16px;padding:14px;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.wcard-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;}
.wcard-hd h3{font-size:14px;font-weight:700;color:#5c9ad6;}
.wdate-inp{font-family:"Poor Story",cursive;font-size:12px;border:2px solid #cbe0f5;border-radius:8px;padding:3px 8px;background:#fafcff;color:#1c2d3d;outline:none;width:120px;}
.wdate-inp:focus{border-color:#5c9ad6;}
.wtotal-badge{margin-left:auto;background:#b3d4f5;color:#2b4f73;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;}
.nvwcard{background:#fff;border:2px solid #cbe0f5;border-radius:16px;padding:14px;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.nvwcard-hd{display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;}
.nvwcard-hd h3{font-size:14px;font-weight:700;color:#5c9ad6;}
.as-goal-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;}
@media(max-width:600px){.as-goal-row{grid-template-columns:1fr;}}
.as-goal-box{background:#fff;border:2px solid #cbe0f5;border-radius:14px;padding:14px;box-shadow:0 2px 10px rgba(0,0,0,.05);}
.as-goal-label{font-size:11px;color:#4a78a6;font-weight:700;margin-bottom:4px;}
.as-goal-value{font-size:18px;font-weight:700;color:#5c9ad6;}
.as-goal-input{font-family:"Poor Story",cursive;font-size:16px;font-weight:700;color:#5c9ad6;border:2px solid #cbe0f5;background:#fafcff;border-radius:8px;outline:none;width:100%;padding:2px 6px;}
.as-goal-input:focus{border-color:#5c9ad6;background:#e6f0fa;}
.ledger-wrap{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
@media(max-width:700px){.ledger-wrap{grid-template-columns:1fr;}}
.ledger-chart-box{background:#fff;border:2px solid #cbe0f5;border-radius:16px;padding:16px;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.ledger-chart-title{font-size:13px;font-weight:700;color:#4a78a6;margin-bottom:10px;}
.ledger-table-wrap{background:#fff;border:2px solid #cbe0f5;border-radius:16px;overflow:hidden;box-shadow:0 3px 14px rgba(0,0,0,.05);}
.lt{width:100%;border-collapse:collapse;font-size:12px;}
.lt td,.lt th{border:1px solid #cbe0f5;padding:6px 10px;vertical-align:middle;}
.lt thead th{background:#e1effc;color:#3a5f85;font-weight:700;text-align:center;}
.lt tbody tr:nth-child(even){background:#fafcff;}
.lt .lbl{font-weight:700;color:#2e435e;background:#f4f9ff;}
.lt .val{text-align:right;font-weight:700;}
.lt .over{color:#5c9ad6;}
.lt .safe{color:#2e7d32;}
.lt .sub{color:#888;padding-left:20px;font-size:11px;}
.lt .grp{background:#e1effc;font-weight:700;color:#3a5f85;}
.lt input.lt-inp{width:100%;border:none;background:transparent;font-family:"Poor Story",cursive;font-size:12px;color:#1c2d3d;outline:none;padding:0;}
.lt input.lt-inp:focus{background:#e6f0fa;border-radius:3px;padding:1px 3px;}
.over-chip{display:inline-block;background:#cbe0f5;color:#5c9ad6;border-radius:999px;padding:1px 8px;font-size:10px;font-weight:700;}
.safe-chip{display:inline-block;background:#e8f5e9;color:#2e7d32;border-radius:999px;padding:1px 8px;font-size:10px;font-weight:700;}
.cd-inner{font-family:"Poor Story",cursive;display:flex;flex-direction:column;gap:8px;padding:20px;background:linear-gradient(135deg,#f0f7ff,#e1effc);min-height:200px;}
.cd-title{font-size:20px;font-weight:700;color:#5c9ad6;margin-bottom:6px;}
.cd-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px dashed #cbe0f5;font-size:13px;}
.cd-row:last-child{border-bottom:none;}
.cd-label{color:#2e435e;font-weight:700;}
.cd-value{color:#5c9ad6;font-weight:700;}
.cd-section{font-size:12px;color:#4a78a6;font-weight:700;padding:8px 0 4px;border-bottom:2px solid #cbe0f5;margin-bottom:4px;}
.cd-deco{font-size:28px;position:absolute;right:16px;top:16px;opacity:.15;}

/* 📱 모바일(화면 너비 600px 이하) 반응형 자동 조절 기능 */
@media (max-width: 600px) {
  .lt, .dt, .te { font-size: 14px !important; }
  .lt input.lt-inp, .dt tbody td input { font-size: 14px !important; padding: 8px 4px !important; }
  .lt td, .lt th, .dt tbody td, .dt thead th { padding: 10px 6px !important; }
  .ledger-table-wrap, .dtw { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
  .lt td.lbl, .dt tbody td:first-child { white-space: nowrap; }
}
</style>
</head>
<body>
<div class="app-header">
  <span class="potato-deco">🧂</span>
  <h1 style="color:#5c9ad6;">짠짠의 기록 <span class="ver">v4.1</span></h1>
  <div style="margin-left:auto; display:flex; gap:8px;">
    <button onclick="hardReset()" style="padding:6px 10px; background:#cbe0f5; border:2px solid #cbe0f5; color:#5c9ad6; border-radius:10px; font-family:'Poor Story',cursive; font-size:12px; font-weight:700; cursor:pointer;">🔥 전체 초기화</button>
    <button onclick="window.location.href='mailto:goodikey23@naver.com?subject=짠짠 건의사항&body=불편한 점: '" style="padding:6px 14px; background:#fff; border:2px solid #5c9ad6; color:#5c9ad6; border-radius:999px; font-family:'Poor Story',cursive; font-size:14px; font-weight:700; cursor:pointer;">✉️ 건의하기</button>
    <button onclick="copySyncLink()" style="padding:6px 14px; background:#fff; border:2px solid #5c9ad6; color:#5c9ad6; border-radius:999px; font-family:'Poor Story',cursive; font-size:14px; font-weight:700; cursor:pointer;">🔗 기기 연동하기</button>
  </div>
</div>
<div class="tab-bar" id="tabbar">
  <button class="tab-btn active" onclick="sw(0)">🏠 가계부</button>
  <button class="tab-btn" onclick="sw(1)">💚 부수입</button>
  <button class="tab-btn" onclick="sw(2)">💸 지출</button>
  <button class="tab-btn" onclick="sw(3)">📈 투자/저축 종목</button>
  <button class="tab-btn" onclick="sw(4)">💼 자산비중</button>
</div>

<div class="tab-page active" id="tp0">
<div class="ft">
  <div class="mb">
    <h2>🏠 가계부 요약</h2>
    <select class="sc" id="lgy" onchange="rLedger()"></select>
    <select class="sc" id="lgm" onchange="rLedger()"></select>
    <button class="sav" onclick="omCd('lg')">📸 카드 저장</button>
  </div>
  <div class="ledger-wrap">
    <div class="ledger-chart-box">
      <div class="ledger-chart-title">총 수입</div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div class="dw"><canvas id="lgdc1" width="140" height="140"></canvas>
          <div class="dc"><div class="dl2">총수입</div><div class="dv" id="lgdv1">₩0</div></div></div>
        <div class="ll2" id="lgl1"></div>
      </div>
    </div>
    <div class="ledger-chart-box">
      <div class="ledger-chart-title">총 지출/저축/투자</div>
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
        <div class="dw"><canvas id="lgdc2" width="140" height="140"></canvas>
          <div class="dc"><div class="dl2">지출/저축</div><div class="dv" id="lgdv2">₩0</div></div></div>
        <div class="ll2" id="lgl2"></div>
      </div>
    </div>
  </div>
  <div class="ledger-table-wrap">
    <table class="lt" id="lgtbl">
      <thead><tr><th style="width:180px">항목</th><th>금액</th><th style="width:140px">메모/상태</th></tr></thead>
      <tbody id="lgtbody"></tbody>
    </table>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;" id="lggoalrow">
    <div class="as-goal-box">
      <div class="as-goal-label">목표 예산</div>
      <input class="as-goal-input" id="lggoal" value="500000" oninput="rLedger()">
    </div>
    <div class="as-goal-box">
      <div class="as-goal-label">이번달 잔액</div>
      <div class="as-goal-value" id="lgbal">₩0</div>
    </div>
    <div class="as-goal-box">
      <div class="as-goal-label">경고</div>
      <div id="lgwarn" style="font-size:13px;font-weight:700;color:#2e7d32;">✅ 안전지대</div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div class="ws">
      <div class="wt">🔥 이번달 과소비 BEST3</div>
      <div id="lgover3" style="display:flex;flex-direction:column;gap:6px;"></div>
    </div>
    <div class="ws">
      <div class="wt">💡 다음 달 꼭 지킬 소비 약속</div>
      <textarea id="lgpromise" style="width:100%;border:2px solid #cbe0f5;border-radius:10px;font-family:'Poor Story',cursive;font-size:13px;padding:8px;resize:vertical;outline:none;min-height:80px;background:#fafcff;" placeholder="자유롭게 적어보세요..."></textarea>
    </div>
  </div>
</div>
</div>

<div class="tab-page" id="tp1">
<div class="ft">
  <div class="mb">
    <h2>💚 부수입 기록</h2>
    <select class="sc" id="iy" onchange="imc()"></select>
    <select class="sc" id="im" onchange="imc()"></select>
    <span class="pill" id="ipill">₩0</span>
    <button class="sav" onclick="omCd('i')">📸 카드 저장</button>
  </div>
  <div class="cs"><h3>📊 분류별 수입 현황</h3>
    <div class="crow">
      <div class="dw"><canvas id="idc" width="160" height="160"></canvas>
        <div class="dc"><div class="dl2">총 수입</div><div class="dv" id="idv">₩0</div></div></div>
      <div class="ll2" id="il"></div>
    </div>
  </div>
  <div class="cm"><h3>🏷 분류 관리 <span style="font-size:11px;color:#4a78a6;">(최대 15개)</span></h3>
    <div class="cw" id="ichips"></div>
    <div class="car">
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">색상</div><div class="pr" id="ipal"></div></div>
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">분류명</div><input class="cni" id="icni" placeholder="입력" maxlength="10"></div>
      <button class="cac" onclick="addCat('i')">＋ 추가</button>
      <span style="font-size:11px;color:#4a78a6;" id="icnt"></span>
    </div>
  </div>
  <div class="fs"><div class="fbar"><span class="fl">필터:</span><div id="ifb" style="display:flex;gap:6px;flex-wrap:wrap;"></div></div></div>
  <div>
    <div class="stit"><h3>📌 상시 수입</h3><span class="stag">매달 있는 항목 · 금액은 월별로 따로 저장</span></div>
    <div class="dtw"><table class="dt"><thead><tr><th style="width:120px">분류</th><th>내용</th><th style="width:130px">금액 (원)</th><th style="width:44px">삭제</th></tr></thead><tbody id="ifb2"></tbody></table>
      <button class="arb" onclick="aFR()">＋ 상시 항목 추가</button></div>
  </div>
  <div>
    <div class="stit"><h3>📅 날짜별 수입</h3><span class="stag" id="idtag">날짜별</span></div>
    <div class="dtw"><table class="dt"><thead><tr><th style="width:70px">날짜</th><th style="width:120px">분류</th><th>내용</th><th style="width:130px">금액 (원)</th><th style="width:44px">삭제</th></tr></thead><tbody id="idb"></tbody></table>
      <button class="arb" onclick="aDR()">＋ 날짜별 항목 추가</button></div>
  </div>
</div>
</div>

<div class="tab-page" id="tp2">
<div class="ft">
  <div class="mb">
    <h2>💸 지출 기록</h2>
    <select class="sc" id="ey" onchange="emc()"></select>
    <select class="sc" id="em" onchange="emc()"></select>
    <span class="pill" id="epill">₩0</span>
    <button class="sav" onclick="omCd('e')">📸 카드 저장</button>
  </div>
  <div class="cs"><h3>📊 분류별 지출 현황</h3>
    <div class="crow">
      <div class="dw"><canvas id="edc" width="160" height="160"></canvas>
        <div class="dc"><div class="dl2">총 지출</div><div class="dv" id="edv">₩0</div></div></div>
      <div class="ll2" id="el"></div>
    </div>
  </div>
  <div class="cm"><h3>🏷 분류 관리 <span style="font-size:11px;color:#4a78a6;">(최대 15개)</span></h3>
    <div class="cw" id="echips"></div>
    <div class="car">
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">색상</div><div class="pr" id="epal"></div></div>
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">분류명</div><input class="cni" id="ecni" placeholder="입력" maxlength="10"></div>
      <button class="cac" onclick="addCat('e')">＋ 추가</button>
      <span style="font-size:11px;color:#4a78a6;" id="ecnt"></span>
    </div>
  </div>
  <div class="fs"><div class="fbar"><span class="fl">필터:</span><div id="efb" style="display:flex;gap:6px;flex-wrap:wrap;"></div></div></div>
  <div>
    <div class="stit"><h3>📌 고정 지출</h3><span class="stag">매달 나가는 항목 · 금액은 월별로 따로 저장</span></div>
    <div class="dtw"><table class="dt"><thead><tr><th style="width:120px">분류</th><th>내용</th><th style="width:130px">금액 (원)</th><th style="width:70px">과소비</th><th style="width:44px">삭제</th></tr></thead><tbody id="efb2"></tbody></table>
      <button class="arb" onclick="aEF()">＋ 고정 지출 추가</button></div>
  </div>
  <div>
    <div class="stit"><h3>📅 날짜별 지출</h3><span class="stag" id="edtag">날짜별</span></div>
    <div class="dtw"><table class="dt"><thead><tr><th style="width:70px">날짜</th><th style="width:120px">분류</th><th>내용</th><th style="width:130px">금액 (원)</th><th style="width:70px">과소비</th><th style="width:44px">삭제</th></tr></thead><tbody id="edb"></tbody></table>
      <button class="arb" onclick="aED()">＋ 날짜별 지출 추가</button></div>
  </div>
</div>
</div>

<div class="tab-page" id="tp3">
<div class="ft">
  <div class="mb">
    <h2>📈 투자/저축 종목</h2>
    <select class="sc" id="nvy" onchange="onNP()"></select>
    <select class="sc" id="nvm" onchange="onNP()"></select>
    <span class="pill" id="nvpill">총 투자/저축 ₩0</span>
    <button class="sav" onclick="omCd('nv')">📸 카드 저장</button>
  </div>
  <div class="panel">
    <div class="pt">💰 월간 총 투자/저축 금액</div>
    <input class="ti" id="nvtotal" value="" oninput="onNTC()">
  </div>
  <div id="nvwrap" style="display:flex;flex-direction:column;gap:14px;"></div>
</div>
</div>

<div class="tab-page" id="tp4">
<div class="ft">
  <div class="mb">
    <h2>🧂 자산 현황</h2>
    <span class="pill" id="aspill">총 ₩0</span>
    <button class="sav" onclick="omCd('as')">📸 카드 저장</button>
  </div>
  <div class="as-goal-row">
    <div class="as-goal-box">
      <div class="as-goal-label">목표 금액</div>
      <input class="as-goal-input" id="asgoalinp" value="43000000" oninput="onAsGoalChange()">
    </div>
    <div class="as-goal-box">
      <div class="as-goal-label">현재 총자산</div>
      <div class="as-goal-value" id="ascurtotal">₩0</div>
    </div>
    <div class="as-goal-box">
      <div class="as-goal-label">남은 금액</div>
      <div class="as-goal-value" id="asremain">₩0</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
    <span style="font-size:13px;font-weight:700;color:#4a78a6;">올해 목표 달성률</span>
    <span id="asachieve" style="font-size:20px;font-weight:700;color:#5c9ad6;">0%</span>
  </div>
  <div class="ag">
    <div class="ws">
      <div class="wt">🧂 총 자산 비율</div>
      <div class="crow" style="margin-bottom:12px;">
        <div class="dw"><canvas id="asdc1" width="140" height="140"></canvas>
          <div class="dc"><div class="dl2">총 자산</div><div class="dv" id="asdv1" style="font-size:11px;">₩0</div></div></div>
        <div class="ll2" id="asl1"></div>
      </div>
    </div>
    <div class="ws">
      <div class="wt">🧂 주식/ETF 소분류</div>
      <div class="crow" style="margin-bottom:12px;">
        <div class="dw"><canvas id="asdc2" width="140" height="140"></canvas>
          <div class="dc"><div class="dl2">투자 합계</div><div class="dv" id="asdv2" style="font-size:11px;">₩0</div></div></div>
        <div class="ll2" id="asl2"></div>
      </div>
    </div>
  </div>

  <div class="cm">
    <h3>🧂 대분류 관리 <span style="font-size:11px;color:#4a78a6;">(최대 10개)</span></h3>
    <div class="cw" id="nsachips"></div>
    <div class="car">
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">색상</div><div class="pr" id="nsapal"></div></div>
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">분류명</div><input class="cni" id="nsacni" placeholder="입력" maxlength="10"></div>
      <button class="cac" onclick="addNsaCatUI()">＋ 추가</button>
      <span style="font-size:11px;color:#4a78a6;" id="nsacnt"></span>
    </div>
  </div>

  <div class="ws" style="margin-bottom:0;">
    <div class="wt">🧂 총자산 상세 현황</div>
    <div id="nsaAddRow" style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;">
      <span style="font-size:12px;color:#4a78a6;font-weight:700;">새 항목 추가:</span>
      <select id="nsaCatSel" class="sc" style="font-size:12px;padding:4px 8px;"></select>
      <button class="bsm" onclick="aNSARow()">＋ 항목 추가</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="dt" style="min-width:500px;">
        <thead><tr>
          <th style="width:40px">색상</th>
          <th style="width:130px">대분류</th>
          <th>내용</th>
          <th style="width:140px">금액 (원)</th>
          <th style="width:44px">삭제</th>
        </tr></thead>
        <tbody id="nsatb"></tbody>
      </table>
    </div>
  </div>

  <div class="cm" style="margin-top:16px;">
    <h3>🧂 주식/ETF 소분류 관리 <span style="font-size:11px;color:#4a78a6;">(최대 10개)</span></h3>
    <div class="cw" id="subchips"></div>
    <div class="car">
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">색상</div><div class="pr" id="subpal"></div></div>
      <div><div style="font-size:11px;color:#4a78a6;margin-bottom:4px;">분류명</div><input class="cni" id="subcni" placeholder="입력" maxlength="10"></div>
      <button class="cac" onclick="addSubCatUI()">＋ 추가</button>
      <span style="font-size:11px;color:#4a78a6;" id="subcnt"></span>
    </div>
  </div>

  <div class="ws">
    <div class="wt">🧂 주식/ETF 소분류 현황 
      <span id="subTotalAmt" style="margin-left:auto;color:#5c9ad6;font-size:14px;"></span>
    </div>
    <table class="dt" id="astbl2" style="table-layout:fixed; width:100%;">
      <thead><tr><th>소분류명</th><th>색상</th><th>금액 (원)</th><th>비중</th></tr></thead>
      <tbody id="asb2"></tbody>
    </table>
  </div>

  <div class="ws">
    <div class="wt">🧂 주식 상세 종목
      <button class="bsm" onclick="aAD()" style="margin-left:auto;">＋ 종목 추가</button>
    </div>
    <div style="overflow-x:auto;">
      <table class="dt" style="min-width:680px;">
        <thead><tr>
          <th style="width:110px">소분류</th>
          <th>종목</th>
          <th style="width:55px">주수</th>
          <th style="width:110px">금융기관</th>
          <th style="width:130px">금액 (원)</th>
          <th style="width:44px">삭제</th>
        </tr></thead>
        <tbody id="asdtb"></tbody>
      </table>
    </div>
  </div>
</div>
</div>

<div class="mo" id="cdmo">
  <div class="mb2">
    <div class="mt2" id="cdmt">📸 카드 저장</div>
    <div class="mrb">
      <button class="active" id="cdrb1" onclick="sCR(this,'1/1')">1:1</button>
      <button id="cdrb2" onclick="sCR(this,'4/5')">4:5</button>
      <button id="cdrb3" onclick="sCR(this,'9/16')">9:16</button>
    </div>
    <div class="mf" id="cdmf"><div id="cdmc"></div></div>
    <div class="mbs">
      <button class="mcl" onclick="document.getElementById('cdmo').classList.remove('open')">닫기</button>
      <button style="background:linear-gradient(135deg,#5c9ad6,#7fb3eb);color:#fff;" id="cddl" onclick="dCd()">🧂 PNG 저장</button>
    </div>
  </div>
</div>

<script>
function ensureArr(val) {
  if (!val) return [];
  let arr = [];
  if (Array.isArray(val)) {
    arr = val;
  } else if (typeof val === 'object') {
    arr = Object.values(val);
  }
  return arr.filter(function(v) { return v !== null && typeof v === 'object'; });
}

window.hardReset = function() {
  if(!confirm("정말 부수입과 지출 데이터를 싹 다 지우고 백지상태로 초기화 할까요?\n(한번 지우면 복구할 수 없습니다!)")) return;
  
  iD = {}; eD = {};
  localStorage.removeItem("iD");
  localStorage.removeItem("eD");
  
  if (isFirebaseLoaded && window.db) {
    var p1 = db.ref("users/" + mySyncKey + "/iD").remove();
    var p2 = db.ref("users/" + mySyncKey + "/eD").remove();
    Promise.all([p1, p2]).then(function() {
      alert("클라우드 서버의 유령 데이터까지 완벽하게 파괴되었습니다!");
      location.reload(true);
    }).catch(function(err) {
      alert("초기화 완료 (새로고침 됩니다)");
      location.reload(true);
    });
  } else {
    alert("초기화 완료 (새로고침 됩니다)");
    location.reload(true);
  }
};

function killGhosts() {
  try {
    for(let y in iD) {
      for(let m in iD[y]) {
        if(iD[y][m].fixed) {
          let f = Object.values(iD[y][m].fixed);
          if(f.some(function(item) { return item && item.amount === "418"; })) {
            iD[y][m].fixed = [];
            iD[y][m].dated = [];
          }
        }
      }
    }
  } catch(e){}
}

const firebaseConfig = {
  apiKey: "AIzaSyBI9tIQLfKNOBUIisbfz-viT_Lqd9pxud0",
  authDomain: "jjanpomato.firebaseapp.com",
  databaseURL: "https://jjanpomato-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "jjanpomato",
  storageBucket: "jjanpomato.firebasestorage.app",
  messagingSenderId: "582491854280",
  appId: "1:582491854280:web:112d50beaa7b50d669dcfd",
  measurementId: "G-441THCFY56"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
window.db = firebase.database();

const urlParams = new URLSearchParams(window.location.search);
const urlKey = urlParams.get('key');
let mySyncKey = localStorage.getItem("syncKey");

if (urlKey) {
  mySyncKey = urlKey;
  localStorage.setItem("syncKey", mySyncKey);
  window.history.replaceState({}, document.title, window.location.pathname);
  alert("데이터 동기화가 연결되었습니다! 🧂");
} else if (!mySyncKey) {
  mySyncKey = 'zzanto-' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem("syncKey", mySyncKey);
}

function copySyncLink() {
  alert("📌 기기 연동 전에 꼭 읽어주세요!\n\n아래 링크가 내 데이터의 열쇠예요\n이 링크를 잃어버리면 데이터를 복구할 수 없어요\n카톡 나에게 보내기 또는 메모앱에 꼭 저장해두세요");
  const syncUrl = window.location.origin + window.location.pathname + '?key=' + mySyncKey;
  prompt("아래 링크를 복사해서 스마트폰으로 보내세요!", syncUrl);
}

let isFirebaseLoaded = false;
db.ref("users/" + mySyncKey).once('value', function(snapshot) {
  const data = snapshot.val();
  if(data) {
    if(data.lgD) lgD = data.lgD;
    if(data.iD) {
      for (let y in data.iD) {
        for (let m in data.iD[y]) {
          data.iD[y][m].fixed = ensureArr(data.iD[y][m].fixed);
          data.iD[y][m].dated = ensureArr(data.iD[y][m].dated);
        }
      }
      iD = data.iD;
    }
    if(data.eD) {
      for (let y in data.eD) {
        for (let m in data.eD[y]) {
          data.eD[y][m].fixed = ensureArr(data.eD[y][m].fixed);
          data.eD[y][m].dated = ensureArr(data.eD[y][m].dated);
        }
      }
      eD = data.eD;
    }
    if(data.asD) asD = data.asD;
    if(data.nvD) nvD = data.nvD;
    if(data.iCats) iCats = ensureArr(data.iCats);
    if(data.eCats) eCats = ensureArr(data.eCats);
  }
  isFirebaseLoaded = true;
  killGhosts(); 
  sw(0); 
});

const FF="Poor Story, cursive";
const fmt=function(n){ return n?Number(n).toLocaleString("ko-KR"):"0"; };

function sw(i){
  document.querySelectorAll(".tab-page").forEach(function(p,j){ p.classList.toggle("active",j===i); });
  document.querySelectorAll(".tab-btn").forEach(function(b,j){
    b.classList.toggle("active",j===i);
    b.style.background=j===i?"linear-gradient(135deg,#5c9ad6,#7fb3eb)":"";
    b.style.color=j===i?"#fff":"";
  });
  if(i===0)rLedger();
  else if(i===1)rInc();
  else if(i===2)rExp();
  else if(i===3)rNV();
  else if(i===4)rAs();
}

const PAL=["#ffb3ba","#ffdfba","#ffffba","#baffc9","#bae1ff","#f4a7b9","#c9b1d9","#a8d8ea","#f9d5a7","#b5ead7","#ffdac1","#e2f0cb","#b5d5c5","#d4a5a5","#c7ceea"];
let selP={i:PAL[0], e:PAL[0], nsa:PAL[0], sub:PAL[0]};
function bPal(tp){
  const row=document.getElementById(tp+"pal");if(!row)return;row.innerHTML="";
  PAL.forEach(function(c){
    const d=document.createElement("div");d.className="pd";d.style.background=c;if(c===selP[tp])d.classList.add("sel");
    d.onclick=function(){selP[tp]=c;row.querySelectorAll(".pd").forEach(function(x){x.classList.remove("sel");});d.classList.add("sel");};
    row.appendChild(d);
  });
}

const ID=[{name:"카카오뱅크",color:"#ffb3ba"},{name:"네이버페이",color:"#baffc9"},{name:"카카오페이",color:"#ffffba"},{name:"기프티콘",color:"#ffdfba"},{name:"금융수입",color:"#bae1ff"},{name:"모니모",color:"#f4a7b9"},{name:"앱테크",color:"#c9b1d9"},{name:"용돈",color:"#b5ead7"},{name:"기타수입",color:"#c7ceea"}];
const ED=[{name:"모임비",color:"#f4a7b9"},{name:"경조사/선물",color:"#c9b1d9"},{name:"데이트비",color:"#ffffba"},{name:"생필품",color:"#baffc9"},{name:"쇼핑/패션",color:"#bae1ff"},{name:"외식",color:"#ffdfba"},{name:"교통",color:"#a8d8ea"},{name:"보험료",color:"#c7ceea"},{name:"유흥",color:"#ffdac1"},{name:"기타지출",color:"#e2f0cb"}];

let lsICats = JSON.parse(localStorage.getItem("iCats")||"null");
let iCats = lsICats ? ensureArr(lsICats) : ID.map(function(c){return Object.assign({}, c);});
if(iCats.length===0) iCats = ID.map(function(c){return Object.assign({}, c);});

let lsECats = JSON.parse(localStorage.getItem("eCats")||"null");
let eCats = lsECats ? ensureArr(lsECats) : ED.map(function(c){return Object.assign({}, c);});
if(eCats.length===0) eCats = ED.map(function(c){return Object.assign({}, c);});

const cc=function(cats,n){const c=cats.find(function(c){return c.name===n;});return c?c.color:"#fff";};
const iC=function(n){return cc(iCats,n);};
const eC=function(n){return cc(eCats,n);};

function saveCats(){
  localStorage.setItem("iCats",JSON.stringify(iCats));
  localStorage.setItem("eCats",JSON.stringify(eCats));
  if(isFirebaseLoaded){
    db.ref("users/" + mySyncKey + "/iCats").set(iCats);
    db.ref("users/" + mySyncKey + "/eCats").set(eCats);
  }
}
function addCat(tp){
  const cats=tp==="i"?iCats:eCats;
  if(cats.length>=15){alert("최대 15개!");return;}
  const name=document.getElementById(tp+"cni").value.trim();
  const color=selP[tp];
  if(!name){alert("분류명 입력!");return;}
  if(cats.find(function(c){return c.name===name;})){alert("이미 있어요!");return;}
  cats.push({name:name,color:color});saveCats();
  document.getElementById(tp+"cni").value="";
  tp==="i"?rInc():rExp();
}
function remCat(tp,i){const cats=tp==="i"?iCats:eCats;if(!confirm('"'+cats[i].name+'" 삭제?'))return;cats.splice(i,1);saveCats();tp==="i"?rInc():rExp();}
function bChips(tp){
  const cats=tp==="i"?iCats:eCats;const w=document.getElementById(tp+"chips");w.innerHTML="";
  cats.forEach(function(c,i){const ch=document.createElement("div");ch.className="chip";ch.style.background=c.color;ch.innerHTML=c.name+'<span class="xd" onclick="remCat(\''+tp+'\','+i+')">✕</span>';w.appendChild(ch);});
  document.getElementById(tp+"cnt").textContent=cats.length+" / 15";
}

let lgD=JSON.parse(localStorage.getItem("lgD")||"{}");
const sLg=function(){ localStorage.setItem("lgD",JSON.stringify(lgD)); if(isFirebaseLoaded) db.ref("users/" + mySyncKey + "/lgD").set(lgD); };

function gLgData(y,m){
  if(!lgD[y])lgD[y]={};
  if(!lgD[y][m])lgD[y][m]={salary:"",memos:{}};
  return lgD[y][m];
}
function updateLgSalary(val){const d=gLgData(lgY,lgM);d.salary=val;sLg();rLedger();}
function updateLgMemo(key,val){const d=gLgData(lgY,lgM);if(!d.memos)d.memos={};d.memos[key]=val;sLg();}

let iD=JSON.parse(localStorage.getItem("iD")||"{}");
let eD=JSON.parse(localStorage.getItem("eD")||"{}");
let asD=JSON.parse(localStorage.getItem("asD")||"{}");
let nvD=JSON.parse(localStorage.getItem("nvD")||"{}");

const sI=function(){ localStorage.setItem("iD",JSON.stringify(iD)); if(isFirebaseLoaded) db.ref("users/" + mySyncKey + "/iD").set(iD); };
const sE=function(){ localStorage.setItem("eD",JSON.stringify(eD)); if(isFirebaseLoaded) db.ref("users/" + mySyncKey + "/eD").set(eD); };
const sAs=function(){ localStorage.setItem("asD",JSON.stringify(asD)); if(isFirebaseLoaded) db.ref("users/" + mySyncKey + "/asD").set(asD); };
const sNv=function(){ localStorage.setItem("nvD",JSON.stringify(nvD)); if(isFirebaseLoaded) db.ref("users/" + mySyncKey + "/nvD").set(nvD); };

function gID(y,m){
  if(!iD[y])iD[y]={};
  if(!iD[y][m]){ iD[y][m]={fixed:[],dated:[]}; sI(); }
  iD[y][m].fixed = ensureArr(iD[y][m].fixed);
  iD[y][m].dated = ensureArr(iD[y][m].dated);
  return iD[y][m];
}
function gED(y,m){
  if(!eD[y])eD[y]={};
  if(!eD[y][m]){ eD[y][m]={fixed:[],dated:[]}; sE(); }
  eD[y][m].fixed = ensureArr(eD[y][m].fixed);
  eD[y][m].dated = ensureArr(eD[y][m].dated);
  return eD[y][m];
}

function gAsD(){
  if(!asD.main){
    asD.main={
      goal: "43000000",
      nsaCats: [
        {name:"노후 대비 자산",color:"#ffb3ba"},
        {name:"안전자산/적금",color:"#bae1ff"},
        {name:"현금성 자산",color:"#baffc9"},
        {name:"대체 투자 자산",color:"#c9b1d9"}
      ],
      nsaRows: [],
      subs: [
        {name:"성장주",amount:"",color:"#ffb3ba"},
        {name:"배당주",amount:"",color:"#bae1ff"},
        {name:"시장지수",amount:"",color:"#baffc9"}
      ],
      details: []
    };
    sAs();
  }
  asD.main.nsaCats = ensureArr(asD.main.nsaCats);
  asD.main.nsaRows = ensureArr(asD.main.nsaRows);
  asD.main.subs = ensureArr(asD.main.subs);
  asD.main.details = ensureArr(asD.main.details);
  return asD.main;
}

function gNvD(y,m){
  if(!nvD[y])nvD[y]={};
  if(!nvD[y][m]){
    nvD[y][m]={total:"",weeks:[{dateRange:"",rows:[]},{dateRange:"",rows:[]},{dateRange:"",rows:[]},{dateRange:"",rows:[]}]};
    sNv();
  }
  nvD[y][m].weeks = ensureArr(nvD[y][m].weeks);
  while(nvD[y][m].weeks.length < 4) nvD[y][m].weeks.push({dateRange:"", rows:[]});
  nvD[y][m].weeks.forEach(function(w){ w.rows = ensureArr(w.rows); });
  return nvD[y][m];
}

let iY=2026,iM=6,eY=2026,eM=6,nvY=2026,nvM=6;
let iFil_state="전체", eFil_state="전체";
let cdType="i",cdRat="1/1";
let lgY=2026,lgM=6;

function buildYM(yid,mid,cy,cm){
  const ys=document.getElementById(yid),ms=document.getElementById(mid);
  if(!ys||!ms)return;ys.innerHTML="";ms.innerHTML="";
  for(let y=2024;y<=2030;y++){const o=document.createElement("option");o.value=y;o.textContent=y+"년";if(y===cy)o.selected=true;ys.appendChild(o);}
  for(let m=1;m<=12;m++){const o=document.createElement("option");o.value=m;o.textContent=m+"월";if(m===cm)o.selected=true;ms.appendChild(o);}
}
function imc(){iY=parseInt(document.getElementById("iy").value)||2026;iM=parseInt(document.getElementById("im").value)||6;iFil_state="전체";rInc();}
function emc(){eY=parseInt(document.getElementById("ey").value)||2026;eM=parseInt(document.getElementById("em").value)||6;eFil_state="전체";rExp();}
function onNP(){nvY=parseInt(document.getElementById("nvy").value)||2026;nvM=parseInt(document.getElementById("nvm").value)||6;rNV();}
function onNTC(){const d=gNvD(nvY,nvM);d.total=document.getElementById("nvtotal").value;sNv();document.getElementById("nvpill").textContent="총 투자/저축 ₩"+fmt(d.total);}

function drawDonut(cid,items,vid,lid){
  const canvas=document.getElementById(cid);if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const w=canvas.width,h=canvas.height,r=Math.min(w,h)/2-8,cx=w/2,cy=h/2;
  ctx.clearRect(0,0,w,h);
  const total=items.reduce(function(s,it){return s+(+it.amount||0);},0);
  if(vid)document.getElementById(vid).textContent="₩"+fmt(total);
  if(lid){const ll=document.getElementById(lid);ll.innerHTML="";
    items.forEach(function(it){if(!it.amount||+it.amount===0)return;const pct=total?Math.round((+it.amount/total)*100):0;const li=document.createElement("div");li.className="li";li.innerHTML=`<div class="ld" style="background:${it.color}"></div><span>${it.name}</span><span class="lp">₩${fmt(it.amount)} (${pct}%)</span>`;ll.appendChild(li);});
  }
  if(total===0){ctx.beginPath();ctx.arc(cx,cy,r,0,2*Math.PI);ctx.lineWidth=22;ctx.strokeStyle="#f0f0f0";ctx.stroke();return;}
  let angle=-Math.PI/2;
  items.forEach(function(it){
    if(!it.amount||+it.amount===0)return;
    const sweep=(+it.amount/total)*2*Math.PI;
    ctx.beginPath();ctx.arc(cx,cy,r,angle,angle+sweep);
    ctx.lineWidth=22;ctx.strokeStyle=it.color;ctx.stroke();
    angle+=sweep;
  });
  ctx.beginPath();ctx.arc(cx,cy,r-10,0,2*Math.PI);ctx.fillStyle="#fff";ctx.fill();
}

function rLedger(){
  lgY=parseInt(document.getElementById("lgy").value)||2026;
  lgM=parseInt(document.getElementById("lgm").value)||6;
  const idata=gID(lgY,lgM);
  const edata=gED(lgY,lgM);
  const nvdata=gNvD(lgY,lgM);

  const iFixed=idata.fixed.reduce(function(s,r){return s+(+r.amount||0);},0);
  const iDated=idata.dated.reduce(function(s,r){return s+(+r.amount||0);},0);
  const totalInc=iFixed+iDated;

  const eFixed=edata.fixed.reduce(function(s,r){return s+(+r.amount||0);},0);
  const eDated=edata.dated.reduce(function(s,r){return s+(+r.amount||0);},0);
  const totalExp=eFixed+eDated;

  let totalInv=0;
  if(nvdata.weeks){nvdata.weeks.forEach(function(w){w.rows.forEach(function(r){totalInv+=(+r.pr||0)*(+r.qty||0)||0;});});}

  const lgData=gLgData(lgY,lgM);
  const salary=+lgData.salary||0;

  const iItems = [];
  if(salary > 0) iItems.push({ name: "월급 및 수당", amount: salary, color: "#f4a7b9" });
  if(totalInc > 0) iItems.push({ name: "부수입", amount: totalInc, color: "#baffc9" });
  drawDonut("lgdc1", iItems, "lgdv1", "lgl1");

  const lg2Items=[
    {name:"지출",amount:totalExp,color:"#bae1ff"},
    {name:"저축/투자",amount:totalInv,color:"#ffffba"},
  ].filter(function(x){return x.amount>0;});
  drawDonut("lgdc2",lg2Items,"lgdv2","lgl2");

  const tb=document.getElementById("lgtbody");tb.innerHTML="";
  const grpRow=function(label){const tr=document.createElement("tr");tr.innerHTML=`<td colspan="3" class="grp">${label}</td>`;tb.appendChild(tr);};

  grpRow("수입");
  {
    const tr=document.createElement("tr");
    const salVal=lgData.salary||"";
    const memoVal=(lgData.memos&&lgData.memos["salary"])||"";
    tr.innerHTML=`<td class="lbl">월급 및 수당</td>
      <td class="val"><input class="lt-inp" value="${salVal}" placeholder="금액 입력" style="text-align:right;font-weight:700;" onchange="updateLgSalary(this.value)"></td>
      <td><input class="lt-inp" value="${memoVal}" placeholder="메모/상태 입력" onchange="updateLgMemo('salary',this.value)"></td>`;
    tb.appendChild(tr);
  }
  {
    const tr=document.createElement("tr");
    const memoVal=(lgData.memos&&lgData.memos["inc"])||"";
    tr.innerHTML=`<td class="lbl">부수입</td>
      <td class="val">₩${fmt(totalInc)}</td>
      <td><input class="lt-inp" value="${memoVal}" placeholder="메모/상태 입력" onchange="updateLgMemo('inc',this.value)"></td>`;
    tb.appendChild(tr);
  }
  {
    const tr=document.createElement("tr");
    const memoVal=(lgData.memos&&lgData.memos["total_inc"])||"";
    tr.innerHTML=`<td class="lbl">🧂 <span style="color:#5c9ad6;font-weight:700;">총수입</span></td>
      <td class="val safe">₩${fmt(totalInc+salary)}</td>
      <td><input class="lt-inp" value="${memoVal}" placeholder="메모/상태 입력" onchange="updateLgMemo('total_inc',this.value)"></td>`;
    tb.appendChild(tr);
  }

  grpRow("지출/저축/투자");
  {
    const tr=document.createElement("tr");
    const memoVal=(lgData.memos&&lgData.memos["exp"])||"";
    tr.innerHTML=`<td class="lbl">지출</td>
      <td class="val">₩${fmt(totalExp)}</td>
      <td><input class="lt-inp" value="${memoVal}" placeholder="메모/상태 입력" onchange="updateLgMemo('exp',this.value)"></td>`;
    tb.appendChild(tr);
  }
  {
    const tr=document.createElement("tr");
    const memoVal=(lgData.memos&&lgData.memos["inv"])||"";
    tr.innerHTML=`<td class="lbl">저축/투자</td>
      <td class="val">₩${fmt(totalInv)}</td>
      <td><input class="lt-inp" value="${memoVal}" placeholder="메모/상태 입력" onchange="updateLgMemo('inv',this.value)"></td>`;
    tb.appendChild(tr);
  }
  {
    const tr=document.createElement("tr");
    const memoVal=(lgData.memos&&lgData.memos["total_exp"])||"";
    tr.innerHTML=`<td class="lbl">🧂 <span style="color:#5c9ad6;font-weight:700;">총지출</span></td>
      <td class="val over">₩${fmt(totalExp+totalInv)}</td>
      <td><input class="lt-inp" value="${memoVal}" placeholder="메모/상태 입력" onchange="updateLgMemo('total_exp',this.value)"></td>`;
    tb.appendChild(tr);
  }

  grpRow("");
  {
    const tr=document.createElement("tr");
    const bal=(totalInc+salary)-(totalExp+totalInv);
    const memoVal=(lgData.memos&&lgData.memos["bal_note"])||"";
    tr.innerHTML=`<td class="lbl">🧂 <span style="color:#5c9ad6;font-weight:700;">잔액</span></td>
      <td class="val ${bal<0?'over':'safe'}">₩${fmt(bal)}</td>
      <td><input class="lt-inp" value="${memoVal}" placeholder="메모/상태 입력" onchange="updateLgMemo('bal_note',this.value)"></td>`;
    tb.appendChild(tr);
  }

  const bal=(totalInc+salary)-(totalExp+totalInv);
  document.getElementById("lgbal").textContent="₩"+fmt(bal);

  const lgGoal = +document.getElementById("lggoal").value || 0;
  const lgWarn = document.getElementById("lgwarn");
  if ((totalExp+totalInv) > lgGoal) {
    lgWarn.innerHTML = "🚨 목표 초과!";
    lgWarn.style.color = "#5c9ad6";
  } else {
    lgWarn.innerHTML = "✅ 안전지대";
    lgWarn.style.color = "#2e7d32";
  }

  const overItems=[];
  edata.fixed.concat(edata.dated).forEach(function(r){if(r.over==="과소비")overItems.push({desc:r.desc,amount:+r.amount||0});});
  overItems.sort(function(a,b){return b.amount-a.amount;});
  const over3=document.getElementById("lgover3");over3.innerHTML="";
  ["🚨 1위","⚠️ 2위","💚 3위"].forEach(function(lbl,i){
    const it=overItems[i];
    const div=document.createElement("div");
    div.style.cssText="display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px dashed #cbe0f5;";
    div.innerHTML=`<span style="min-width:40px;font-weight:700;">${lbl}</span><span>${it?it.desc:"—"}</span><span style="margin-left:auto;font-weight:700;color:#5c9ad6;">${it?"₩"+fmt(it.amount):""}</span>`;
    over3.appendChild(div);
  });
}

function rInc(){
  bPal("i");bChips("i");
  const d=gID(iY,iM);
  document.getElementById("idtag").textContent=iY+"년 "+iM+"월";
  const fb=document.getElementById("ifb");fb.innerHTML="";
  const allCats=["전체"].concat(iCats.map(function(c){return c.name;}));
  allCats.forEach(function(n){const b=document.createElement("button");b.className="fc"+(n===iFil_state?" active":"");b.textContent=n;b.onclick=function(){iFil_state=n;rInc();};fb.appendChild(b);});
  const fb2=document.getElementById("ifb2");fb2.innerHTML="";
  d.fixed.forEach(function(r,i){
    if(iFil_state!=="전체"&&r.cat!==iFil_state)return;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><select style="background:${iC(r.cat)}; border-radius:6px; border:none; outline:none; padding:3px 6px; font-weight:700;" onchange="iD[${iY}][${iM}].fixed[${i}].cat=this.value;sI();rInc();">${iCats.map(function(c){return `<option value="${c.name}" ${r.cat===c.name?"selected":""}>${c.name}</option>`;}).join("")}</select></td>
    <td><input value="${r.desc||""}" oninput="iD[${iY}][${iM}].fixed[${i}].desc=this.value;sI();"></td>
    <td><input value="${r.amount||""}" onchange="iD[${iY}][${iM}].fixed[${i}].amount=this.value;sI();rInc();" style="text-align:right;"></td>
    <td style="text-align:center;"><button class="bsm" onclick="iD[${iY}][${iM}].fixed.splice(${i},1);sI();rInc();">✕</button></td>`;
    fb2.appendChild(tr);
  });
  const db=document.getElementById("idb");db.innerHTML="";
  d.dated.forEach(function(r,i){
    if(iFil_state!=="전체"&&r.cat!==iFil_state)return;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><input value="${r.date||""}" oninput="iD[${iY}][${iM}].dated[${i}].date=this.value;sI();" style="width:60px;"></td>
    <td><select style="background:${iC(r.cat)}; border-radius:6px; border:none; outline:none; padding:3px 6px; font-weight:700;" onchange="iD[${iY}][${iM}].dated[${i}].cat=this.value;sI();rInc();">${iCats.map(function(c){return `<option value="${c.name}" ${r.cat===c.name?"selected":""}>${c.name}</option>`;}).join("")}</select></td>
    <td><input value="${r.desc||""}" oninput="iD[${iY}][${iM}].dated[${i}].desc=this.value;sI();"></td>
    <td><input value="${r.amount||""}" onchange="iD[${iY}][${iM}].dated[${i}].amount=this.value;sI();rInc();" style="text-align:right;"></td>
    <td style="text-align:center;"><button class="bsm" onclick="iD[${iY}][${iM}].dated.splice(${i},1);sI();rInc();">✕</button></td>`;
    db.appendChild(tr);
  });
  const allRows=d.fixed.concat(d.dated);
  const agg={};allRows.forEach(function(r){const k=r.cat||"기타";agg[k]=(agg[k]||0)+(+r.amount||0);});
  const items=Object.keys(agg).map(function(k){return {name:k,amount:agg[k],color:iC(k)};});
  drawDonut("idc",items,"idv","il");
  const tot=allRows.reduce(function(s,r){return s+(+r.amount||0);},0);
  document.getElementById("ipill").textContent="₩"+fmt(tot);
}

window.aFR = function() {
  try {
    let d = gID(iY, iM);
    let defaultCat = (iCats && iCats.length > 0) ? iCats[0].name : "기타";
    d.fixed.push({cat: defaultCat, desc: "", amount: ""});
    sI();
    rInc();
  } catch(e) { alert("상시수입 추가 오류: " + e.message); }
};

window.aDR = function() {
  try {
    let d = gID(iY, iM);
    let defaultCat = (iCats && iCats.length > 0) ? iCats[0].name : "기타";
    d.dated.push({date: "", cat: defaultCat, desc: "", amount: ""});
    sI();
    rInc();
  } catch(e) { alert("날짜별수입 추가 오류: " + e.message); }
};

function rExp(){
  bPal("e");bChips("e");
  const d=gED(eY,eM);
  document.getElementById("edtag").textContent=eY+"년 "+eM+"월";
  const fb=document.getElementById("efb");fb.innerHTML="";
  const allCats=["전체"].concat(eCats.map(function(c){return c.name;}));
  allCats.forEach(function(n){const b=document.createElement("button");b.className="fc"+(n===eFil_state?" active":"");b.textContent=n;b.onclick=function(){eFil_state=n;rExp();};fb.appendChild(b);});
  const fb2=document.getElementById("efb2");fb2.innerHTML="";
  d.fixed.forEach(function(r,i){
    if(eFil_state!=="전체"&&r.cat!==eFil_state)return;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><select style="background:${eC(r.cat)}; border-radius:6px; border:none; outline:none; padding:3px 6px; font-weight:700;" onchange="eD[${eY}][${eM}].fixed[${i}].cat=this.value;sE();rExp();">${eCats.map(function(c){return `<option value="${c.name}" ${r.cat===c.name?"selected":""}>${c.name}</option>`;}).join("")}</select></td>
    <td><input value="${r.desc||""}" oninput="eD[${eY}][${eM}].fixed[${i}].desc=this.value;sE();"></td>
    <td><input value="${r.amount||""}" onchange="eD[${eY}][${eM}].fixed[${i}].amount=this.value;sE();rExp();" style="text-align:right;"></td>
    <td style="text-align:center;"><select onchange="eD[${eY}][${eM}].fixed[${i}].over=this.value;sE();rExp();"><option value="">-</option><option value="과소비"${r.over==="과소비"?" selected":""}>과소비</option></select></td>
    <td style="text-align:center;"><button class="bsm" onclick="eD[${eY}][${eM}].fixed.splice(${i},1);sE();rExp();">✕</button></td>`;
    fb2.appendChild(tr);
  });
  const db=document.getElementById("edb");db.innerHTML="";
  d.dated.forEach(function(r,i){
    if(eFil_state!=="전체"&&r.cat!==eFil_state)return;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><input value="${r.date||""}" oninput="eD[${eY}][${eM}].dated[${i}].date=this.value;sE();" style="width:60px;"></td>
    <td><select style="background:${eC(r.cat)}; border-radius:6px; border:none; outline:none; padding:3px 6px; font-weight:700;" onchange="eD[${eY}][${eM}].dated[${i}].cat=this.value;sE();rExp();">${eCats.map(function(c){return `<option value="${c.name}" ${r.cat===c.name?"selected":""}>${c.name}</option>`;}).join("")}</select></td>
    <td><input value="${r.desc||""}" oninput="eD[${eY}][${eM}].dated[${i}].desc=this.value;sE();"></td>
    <td><input value="${r.amount||""}" onchange="eD[${eY}][${eM}].dated[${i}].amount=this.value;sE();rExp();" style="text-align:right;"></td>
    <td style="text-align:center;"><select onchange="eD[${eY}][${eM}].dated[${i}].over=this.value;sE();rExp();"><option value="">-</option><option value="과소비"${r.over==="과소비"?" selected":""}>과소비</option></select></td>
    <td style="text-align:center;"><button class="bsm" onclick="eD[${eY}][${eM}].dated.splice(${i},1);sE();rExp();">✕</button></td>`;
    db.appendChild(tr);
  });
  const allRows=d.fixed.concat(d.dated);
  const agg={};allRows.forEach(function(r){const k=r.cat||"기타";agg[k]=(agg[k]||0)+(+r.amount||0);});
  const items=Object.keys(agg).map(function(k){return {name:k,amount:agg[k],color:eC(k)};});
  drawDonut("edc",items,"edv","el");
  const tot=allRows.reduce(function(s,r){return s+(+r.amount||0);},0);
  document.getElementById("epill").textContent="₩"+fmt(tot);
}

window.aEF = function() {
  try {
    let d = gED(eY, eM);
    let defaultCat = (eCats && eCats.length > 0) ? eCats[0].name : "기타";
    d.fixed.push({cat: defaultCat, desc: "", amount: "", over: ""});
    sE(); rExp();
  } catch(e) { alert("상시지출 추가 오류: " + e.message); }
};

window.aED = function() {
  try {
    let d = gED(eY, eM);
    let defaultCat = (eCats && eCats.length > 0) ? eCats[0].name : "기타";
    d.dated.push({date: "", cat: defaultCat, desc: "", amount: "", over: ""});
    sE(); rExp();
  } catch(e) { alert("날짜별지출 추가 오류: " + e.message); }
};

function rNV(){
  const d=gNvD(nvY,nvM);
  let invTotal=0;
  if(d.weeks){d.weeks.forEach(function(wk){wk.rows.forEach(function(r){invTotal+=((+r.pr||0)*(+r.qty||0)||0);});});}
  const autoTotal=invTotal;
  if(autoTotal>0){d.total=String(autoTotal);sNv();}
  document.getElementById("nvtotal").value=d.total||"";
  document.getElementById("nvpill").textContent="총 투자/저축 ₩"+fmt(d.total);
  const wrap=document.getElementById("nvwrap");wrap.innerHTML="";
  if(!d.weeks||!Array.isArray(d.weeks)){
    d.weeks=[{dateRange:"",rows:[]},{dateRange:"",rows:[]},{dateRange:"",rows:[]},{dateRange:"",rows:[]}];
    sNv();
  }
  d.weeks.forEach(function(wk,wi){
    var wiCap=wi;
    const card=document.createElement("div");card.className="nvwcard";
    const hd=document.createElement("div");hd.className="nvwcard-hd";
    const wkTotal=wk.rows.reduce(function(s,r){return s+((+r.pr||0)*(+r.qty||0)||0);},0);
    const wkBadge=`<span class="wtotal-badge" style="margin-left:8px;">₩${fmt(wkTotal)}</span>`;
    hd.innerHTML=`<h3>${wi+1}주차</h3>
    <input class="wdate-inp" value="${wk.dateRange||""}" placeholder="예: 6/1~6/7" oninput="updateNvDate(${wiCap},this.value)">
    ${wkBadge}
    <button class="bsm" style="margin-left:auto;" onclick="addNvRow(${wiCap})">＋ 종목 추가</button>`;
    card.appendChild(hd);
    const tbl=document.createElement("table");tbl.className="dt";tbl.style.minWidth="480px";
    const thead=document.createElement("thead");
    thead.innerHTML="<tr><th>종목명</th><th style='width:60px'>주수</th><th style='width:130px'>금액(원)</th><th style='width:140px'>비고</th><th style='width:44px'>삭제</th></tr>";
    tbl.appendChild(thead);
    const tbody=document.createElement("tbody");
    wk.rows.forEach(function(r,ri){
      var wiCap2=wiCap;
      const tr=document.createElement("tr");
      tr.innerHTML=`<td><input value="${r.tk||""}" oninput="nvD[${nvY}][${nvM}].weeks[${wiCap2}].rows[${ri}].tk=this.value;sNv();" placeholder="종목명"></td>
      <td><input value="${r.qty||""}" onchange="nvD[${nvY}][${nvM}].weeks[${wiCap2}].rows[${ri}].qty=this.value;sNv();rNV();" style="text-align:center;"></td>
      <td><input value="${r.pr||""}" onchange="nvD[${nvY}][${nvM}].weeks[${wiCap2}].rows[${ri}].pr=this.value;sNv();rNV();" style="text-align:right;"></td>
      <td><input value="${r.note||""}" oninput="nvD[${nvY}][${nvM}].weeks[${wiCap2}].rows[${ri}].note=this.value;sNv();"></td>
      <td style="text-align:center;"><button class="bsm" onclick="nvD[${nvY}][${nvM}].weeks[${wiCap2}].rows.splice(${ri},1);sNv();rNV();">✕</button></td>`;
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    const wrap2=document.createElement("div");wrap2.style.overflowX="auto";wrap2.appendChild(tbl);
    card.appendChild(wrap2);
    wrap.appendChild(card);
  });
}
window.updateNvDate = function(wi,val){const d=gNvD(nvY,nvM);d.weeks[wi].dateRange=val;sNv();};
window.addNvRow = function(wi){
  const d=gNvD(nvY,nvM);
  if(!Array.isArray(d.weeks[wi].rows)) d.weeks[wi].rows = [];
  d.weeks[wi].rows.push({tk:"",qty:"",pr:"",note:""});
  sNv();
  rNV();
};

window.onAsGoalChange = function(){
  const d=gAsD();
  d.goal=document.getElementById("asgoalinp").value;
  sAs();rAs();
};
function rNsaCatSel(){
  const d=gAsD();
  const sel=document.getElementById("nsaCatSel");
  if(!sel)return;
  sel.innerHTML="";
  (d.nsaCats||[]).forEach(function(c){
    const o=document.createElement("option");o.value=c.name;o.textContent=c.name;sel.appendChild(o);
  });
  if((d.nsaCats||[]).length===0){
    const o=document.createElement("option");o.value="";o.textContent="(대분류 먼저 추가)";o.disabled=true;o.selected=true;sel.appendChild(o);
  }
  document.getElementById("nsaAddRow").style.display=(d.nsaCats||[]).length>0?"flex":"none";
}
window.addNsaCatUI = function(){
  const d=gAsD();
  if(!d.nsaCats)d.nsaCats=[];
  if(d.nsaCats.length>=10){alert("최대 10개!");return;}
  const name=document.getElementById("nsacni").value.trim();
  const color=selP.nsa;
  if(!name){alert("분류명 입력!");return;}
  if(d.nsaCats.find(function(c){return c.name===name;})){alert("이미 있어요!");return;}
  d.nsaCats.push({name:name,color:color});sAs();
  document.getElementById("nsacni").value="";rAs();
};
window.remNsaCatUI = function(i){
  const d=gAsD();
  if(!confirm('"'+d.nsaCats[i].name+'" 삭제?'))return;
  const name = d.nsaCats[i].name;
  d.nsaCats.splice(i,1);
  d.nsaRows=(d.nsaRows||[]).filter(function(r){return r.cat!==name;});
  sAs();rAs();
};
window.addSubCatUI = function(){
  const d=gAsD();
  if(!d.subs)d.subs=[];
  if(d.subs.length>=10){alert("최대 10개!");return;}
  const name=document.getElementById("subcni").value.trim();
  const color=selP.sub;
  if(!name){alert("분류명 입력!");return;}
  if(d.subs.find(function(c){return c.name===name;})){alert("이미 있어요!");return;}
  d.subs.push({name:name,amount:"",color:color});sAs();
  document.getElementById("subcni").value="";rAs();
};
window.remSubCatUI = function(i){
  const d=gAsD();
  if(!confirm('"'+d.subs[i].name+'" 삭제?'))return;
  d.subs.splice(i,1);
  sAs();rAs();
};
function bAsChips(){
  const d=gAsD();
  const nw=document.getElementById("nsachips");nw.innerHTML="";
  (d.nsaCats||[]).forEach(function(c,i){const ch=document.createElement("div");ch.className="chip";ch.style.background=c.color;ch.innerHTML=c.name+'<span class="xd" onclick="remNsaCatUI('+i+')">✕</span>';nw.appendChild(ch);});
  document.getElementById("nsacnt").textContent=(d.nsaCats||[]).length+" / 10";

  const sw=document.getElementById("subchips");sw.innerHTML="";
  (d.subs||[]).forEach(function(c,i){const ch=document.createElement("div");ch.className="chip";ch.style.background=c.color;ch.innerHTML=c.name+'<span class="xd" onclick="remSubCatUI('+i+')">✕</span>';sw.appendChild(ch);});
  document.getElementById("subcnt").textContent=(d.subs||[]).length+" / 10";
}

function rAs(){
  const d=gAsD();
  
  bPal("nsa");bPal("sub");bAsChips();

  const goalInp=document.getElementById("asgoalinp");
  if(document.activeElement!==goalInp){goalInp.value=d.goal||"";}

  const subAgg = {};
  (d.details||[]).forEach(function(r){
    const sc = r.sc || "기타";
    subAgg[sc] = (subAgg[sc] || 0) + (+r.amt || 0);
  });
  (d.subs||[]).forEach(function(s){
    s.amount = String(subAgg[s.name] || 0);
  });

  const nsaTotal=(d.nsaRows||[]).reduce(function(s,r){return s+(+r.amt||0);},0);
  const stockTotal=(d.subs||[]).reduce(function(s,r){return s+(+r.amount||0);},0);
  const grandTotal=nsaTotal+stockTotal;
  
  document.getElementById("aspill").textContent="총 ₩"+fmt(grandTotal);
  document.getElementById("ascurtotal").textContent="₩"+fmt(grandTotal);
  document.getElementById("asdv1").textContent="₩"+fmt(grandTotal);

  const goalAmt=+d.goal||0;
  const achPct=goalAmt>0?Math.round((grandTotal/goalAmt)*100):0;
  document.getElementById("asachieve").textContent=achPct+"%";

  const remain=goalAmt-grandTotal;
  const remEl=document.getElementById("asremain");
  remEl.textContent=(remain>=0?"₩"+fmt(remain):"▲₩"+fmt(Math.abs(remain)));
  remEl.style.color="#5c9ad6";

  const cat1Agg={};
  (d.nsaRows||[]).forEach(function(r){const c=r.cat||"기타";cat1Agg[c]=(cat1Agg[c]||0)+(+r.amount||0);});
  const cat1Items=Object.keys(cat1Agg).map(function(k){
    const catObj=(d.nsaCats||[]).find(function(c){return c.name===k;});
    return {name:k,amount:cat1Agg[k],color:catObj?catObj.color:"#e0e0e0"};
  });
  if(stockTotal>0)cat1Items.push({name:"주식/ETF",amount:stockTotal,color:"#ffffba"});
  drawDonut("asdc1",cat1Items,"asdv1","asl1");

  const sub2Items=(d.subs||[]).map(function(s){return {name:s.name,amount:+s.amount||0,color:s.color||"#e0e0e0"};});
  drawDonut("asdc2",sub2Items,"asdv2","asl2");

  rNsaTable(d);
  rSubTable(d);
  rDetailTable(d);
  rNsaCatSel();
}

function rNsaTable(d){
  const tb=document.getElementById("nsatb");tb.innerHTML="";
  const nsaCats=d.nsaCats||[];
  const nsaRows=d.nsaRows||[];

  const grouped={};
  nsaRows.forEach(function(r){const k=r.cat||"기타";if(!grouped[k])grouped[k]=[];grouped[k].push(r);});
  const orderedCats=nsaCats.map(function(c){return c.name;});
  Object.keys(grouped).forEach(function(k){if(!orderedCats.includes(k))orderedCats.push(k);});

  orderedCats.forEach(function(catName){
    const catObj=nsaCats.find(function(c){return c.name===catName;})||{name:catName,color:"#e0e0e0"};
    const rows=grouped[catName]||[];
    const catTotal=rows.reduce(function(s,r){return s+(+r.amt||0);},0);

    const htr=document.createElement("tr");
    htr.style.background="#f4f9ff";
    htr.innerHTML=`<td style="text-align:center;"><div style="width:16px;height:16px;border-radius:50%;background:${catObj.color};margin:0 auto;"></div></td>
    <td colspan="2" style="font-weight:700;color:#2e435e;">${catName}</td>
    <td colspan="2" style="text-align:right;font-weight:700;">₩${fmt(catTotal)}</td>`;
    tb.appendChild(htr);

    rows.forEach(function(r){
      const globalIdx=nsaRows.indexOf(r);
      const tr=document.createElement("tr");
      tr.innerHTML=`<td></td>
      <td style="padding-left:16px;color:#888;font-size:11px;">${catName}</td>
      <td><input value="${r.desc||""}" placeholder="내용" oninput="nsaRowUpdate(${globalIdx},'desc',this.value)"></td>
      <td><input value="${r.amt||""}" style="text-align:right;" placeholder="금액" onchange="nsaRowUpdate(${globalIdx},'amt',this.value)"></td>
      <td style="text-align:center;"><button class="bsm" onclick="nsaRowDelete(${globalIdx})">✕</button></td>`;
      tb.appendChild(tr);
    });
  });
}

window.nsaRowUpdate = function(idx,field,val){
  const d=gAsD();
  if(d.nsaRows&&d.nsaRows[idx]!=null){d.nsaRows[idx][field]=val;sAs();if(field==='amt')rAs();}
};
window.nsaRowDelete = function(idx){
  const d=gAsD();
  if(d.nsaRows)d.nsaRows.splice(idx,1);
  sAs();rAs();
};
window.aNSARow = function(){
  const d=gAsD();
  if(!Array.isArray(d.nsaRows)) d.nsaRows = [];
  if(!d.nsaCats||d.nsaCats.length===0){alert("먼저 대분류를 추가해주세요!");return;}
  const sel=document.getElementById("nsaCatSel");
  const cat=sel?sel.value:(d.nsaCats[0].name);
  if(!cat){alert("대분류를 선택해주세요!");return;}
  d.nsaRows.push({cat:cat,desc:"",amt:""});
  sAs();rAs();
};

function rSubTable(d){
  const tb=document.getElementById("asb2");tb.innerHTML="";
  const subs=d.subs||[];
  const subTotal=subs.reduce(function(s,r){return s+(+r.amount||0);},0);
  
  const subTotalAmtEl = document.getElementById("subTotalAmt");
  if(subTotalAmtEl) subTotalAmtEl.textContent = "합계: ₩" + fmt(subTotal);

  subs.forEach(function(s,i){
    const tr=document.createElement("tr");
    const pct=subTotal>0?Math.round(((+s.amount||0)/subTotal)*100):0;
    tr.innerHTML=`<td style="font-weight:700;color:#2e435e;">${s.name||""}</td>
    <td style="text-align:center;"><div style="width:16px;height:16px;border-radius:50%;background:${s.color};margin:0 auto;"></div></td>
    <td style="text-align:right;font-weight:700;color:#1c2d3d;padding-right:10px;">₩${fmt(s.amount||0)}</td>
    <td style="text-align:center;">${pct}%</td>`;
    tb.appendChild(tr);
  });
}

function rDetailTable(d){
  const tb=document.getElementById("asdtb");tb.innerHTML="";
  const details=d.details||[];
  const subs=(d.subs||[]).map(function(s){return s.name;}).filter(Boolean);
  details.forEach(function(r,i){
    const tr=document.createElement("tr");
    const scOpts=subs.map(function(o){return`<option${r.sc===o?" selected":""}>${o}</option>`;}).join("")||`<option>${r.sc||""}</option>`;
    tr.innerHTML=`
    <td><select onchange="detailUpdate(${i},'sc',this.value)">${scOpts}</select></td>
    <td><input value="${r.tk||""}" placeholder="종목명" oninput="detailUpdate(${i},'tk',this.value)"></td>
    <td><input value="${r.qty||""}" style="text-align:center;" oninput="detailUpdate(${i},'qty',this.value)"></td>
    <td><input value="${r.bc||""}" placeholder="입력" oninput="detailUpdate(${i},'bc',this.value)"></td>
    <td><input value="${r.amt||""}" style="text-align:right;" onchange="detailUpdate(${i},'amt',this.value)"></td>
    <td style="text-align:center;"><button class="bsm" onclick="detailDelete(${i})">✕</button></td>`;
    tb.appendChild(tr);
  });
}
window.detailUpdate = function(i,field,val){
  const d=gAsD();
  if(d.details&&d.details[i]!=null){d.details[i][field]=val;sAs();if(field==='amt' || field==='sc')rAs();}
};
window.detailDelete = function(i){
  const d=gAsD();
  if(d.details)d.details.splice(i,1);
  sAs();rAs();
};
window.aAD = function(){
  const d=gAsD();
  if(!Array.isArray(d.details)) d.details = [];
  d.details.push({bc:"",sc:"",tk:"",qty:"",amt:""});
  sAs();rAs();
};

let cdRat2="1/1";

window.omCd = function(tp){
  cdType=tp;
  const mo=document.getElementById("cdmo");mo.classList.add("open");
  document.getElementById("cdmt").textContent=
    tp==="i"?"📸 부수입 카드 저장":
    tp==="e"?"📸 지출 카드 저장":
    tp==="nv"?"📸 투자종목 카드 저장":
    tp==="as"?"📸 자산비중 카드 저장":"📸 가계부 카드 저장";
  document.querySelectorAll("#cdmo .mrb button").forEach(function(b){b.classList.remove("active");});
  document.getElementById("cdrb1").classList.add("active");
  cdRat2="1/1";
  bCdCard();
};

window.sCR = function(btn,rat){
  cdRat2=rat;
  document.querySelectorAll("#cdmo .mrb button").forEach(function(b){b.classList.remove("active");});
  btn.classList.add("active");
  bCdCard();
};

function bCdCard(){
  const mc=document.getElementById("cdmc");mc.innerHTML="";
  mc.className="cd-inner";

  if(cdType==="lg"){
    const idata=gID(lgY,lgM);
    const edata=gED(lgY,lgM);
    const lgData=gLgData(lgY,lgM);
    const iTotal=idata.fixed.concat(idata.dated).reduce(function(s,r){return s+(+r.amount||0);},0);
    const eTotal=edata.fixed.concat(edata.dated).reduce(function(s,r){return s+(+r.amount||0);},0);
    const nvdata=gNvD(lgY,lgM);
    let invTotal=0;
    if(nvdata.weeks){nvdata.weeks.forEach(function(w){w.rows.forEach(function(r){invTotal+=(+r.pr||0)*(+r.qty||0)||0;});});}
    const salary=+lgData.salary||0;
    const bal=(iTotal+salary)-(eTotal+invTotal);

    mc.innerHTML=`
      <div style="font-size:22px;font-weight:700;color:#5c9ad6;margin-bottom:8px;">🧂 ${lgY}년 ${lgM}월 가계부</div>
      <div class="cd-section">💚 수입</div>
      <div class="cd-row"><span class="cd-label">월급 및 수당</span><span class="cd-value">₩${fmt(salary)}</span></div>
      <div class="cd-row"><span class="cd-label">부수입</span><span class="cd-value">₩${fmt(iTotal)}</span></div>
      <div class="cd-row" style="background:#e1effc;border-radius:8px;padding:6px 8px;"><span class="cd-label">총수입</span><span class="cd-value" style="color:#2e7d32;">₩${fmt(iTotal+salary)}</span></div>
      <div class="cd-section">💸 지출/저축</div>
      <div class="cd-row"><span class="cd-label">지출</span><span class="cd-value" style="color:#5c9ad6;">₩${fmt(eTotal)}</span></div>
      <div class="cd-row"><span class="cd-label">저축/투자</span><span class="cd-value">₩${fmt(invTotal)}</span></div>
      <div class="cd-row" style="background:#e1effc;border-radius:8px;padding:6px 8px;"><span class="cd-label">총지출</span><span class="cd-value" style="color:#5c9ad6;">₩${fmt(eTotal+invTotal)}</span></div>
      <div class="cd-row" style="background:#e1effc;border-radius:8px;padding:6px 8px;"><span class="cd-label">🧂 잔액</span><span class="cd-value" style="color:${bal<0?'#5c9ad6':'#2e7d32'};">₩${fmt(bal)}</span></div>
      <div style="text-align:right;font-size:10px;color:#ccc;margin-top:8px;">짠짠의 기록 🧂</div>`;

  } else if(cdType==="i"){
    const d=gID(iY,iM);
    const allRows=d.fixed.concat(d.dated);
    const tot=allRows.reduce(function(s,r){return s+(+r.amount||0);},0);
    const agg={};allRows.forEach(function(r){const k=r.cat||"기타";agg[k]=(agg[k]||0)+(+r.amount||0);});
    let rows="";
    Object.keys(agg).forEach(function(k){rows+=`<div class="cd-row"><span class="cd-label">${k}</span><span class="cd-value">₩${fmt(agg[k])}</span></div>`;});
    mc.innerHTML=`
      <div style="font-size:22px;font-weight:700;color:#5c9ad6;margin-bottom:8px;">💚 ${iY}년 ${iM}월 부수입</div>
      ${rows}
      <div class="cd-row" style="background:#e1effc;border-radius:8px;padding:6px 8px;margin-top:4px;"><span class="cd-label">🧂 합계</span><span class="cd-value" style="color:#2e7d32;">₩${fmt(tot)}</span></div>
      <div style="text-align:right;font-size:10px;color:#ccc;margin-top:8px;">짠짠의 기록 🧂</div>`;

  } else if(cdType==="e"){
    const d=gED(eY,eM);
    const allRows=d.fixed.concat(d.dated);
    const tot=allRows.reduce(function(s,r){return s+(+r.amount||0);},0);
    const agg={};allRows.forEach(function(r){const k=r.cat||"기타";agg[k]=(agg[k]||0)+(+r.amount||0);});
    let rows="";
    Object.keys(agg).forEach(function(k){rows+=`<div class="cd-row"><span class="cd-label">${k}</span><span class="cd-value">₩${fmt(agg[k])}</span></div>`;});
    const overItems=allRows.filter(function(r){return r.over==="과소비";}).sort(function(a,b){return b.amount-a.amount;});
    let overHtml="";
    if(overItems.length>0){
      overHtml=`<div class="cd-section">🔥 과소비 TOP3</div>`;
      overItems.slice(0,3).forEach(function(r,i){
        overHtml+=`<div class="cd-row"><span class="cd-label">${["🚨","⚠️","💚"][i]} ${r.desc}</span><span class="cd-value" style="color:#5c9ad6;">₩${fmt(r.amount)}</span></div>`;
      });
    }
    mc.innerHTML=`
      <div style="font-size:22px;font-weight:700;color:#5c9ad6;margin-bottom:8px;">💸 ${eY}년 ${eM}월 지출</div>
      ${rows}
      <div class="cd-row" style="background:#e1effc;border-radius:8px;padding:6px 8px;margin-top:4px;"><span class="cd-label">🧂 합계</span><span class="cd-value" style="color:#5c9ad6;">₩${fmt(tot)}</span></div>
      ${overHtml}
      <div style="text-align:right;font-size:10px;color:#ccc;margin-top:8px;">짠짠의 기록 🧂</div>`;

  } else if(cdType==="nv"){
    const d=gNvD(nvY,nvM);
    let rows="";let tot=0;
    (d.weeks||[]).forEach(function(wk,wi){
      if(wk.rows.length===0)return;
      rows+=`<div class="cd-section">${wi+1}주차 ${wk.dateRange||""}</div>`;
      wk.rows.forEach(function(r){
        const amt=(+r.pr||0)*(+r.qty||0);
        tot+=amt;
        rows+=`<div class="cd-row"><span class="cd-label">${r.tk||"—"} (${r.qty||0}주)</span><span class="cd-value">₩${fmt(amt||r.pr)}</span></div>`;
      });
    });
    mc.innerHTML=`
      <div style="font-size:22px;font-weight:700;color:#5c9ad6;margin-bottom:8px;">📈 ${nvY}년 ${nvM}월 투자 종목</div>
      ${rows}
      <div class="cd-row" style="background:#e1effc;border-radius:8px;padding:6px 8px;margin-top:4px;"><span class="cd-label">🧂 총 투자/저축</span><span class="cd-value">₩${fmt(d.total)}</span></div>
      <div style="text-align:right;font-size:10px;color:#ccc;margin-top:8px;">짠짠의 기록 🧂</div>`;

  } else if(cdType==="as"){
    const d=gAsD();
    const nsaTotal=(d.nsaRows||[]).reduce(function(s,r){return s+(+r.amount||0);},0);
    const stockTotal=(d.subs||[]).reduce(function(s,r){return s+(+r.amount||0);},0);
    const grand=nsaTotal+stockTotal;
    const goal=+d.goal||0;
    const pct=goal>0?Math.round((grand/goal)*100):0;

    let catRows="";
    const agg={};
    (d.nsaRows||[]).forEach(function(r){const k=r.cat||"기타";agg[k]=(agg[k]||0)+(+r.amount||0);});
    Object.keys(agg).forEach(function(k){catRows+=`<div class="cd-row"><span class="cd-label">${k}</span><span class="cd-value">₩${fmt(agg[k])}</span></div>`;});
    if(stockTotal>0)catRows+=`<div class="cd-row"><span class="cd-label">주식/ETF</span><span class="cd-value">₩${fmt(stockTotal)}</span></div>`;

    mc.innerHTML=`
      <div style="font-size:22px;font-weight:700;color:#5c9ad6;margin-bottom:8px;">💼 자산 현황</div>
      ${catRows}
      <div class="cd-row" style="background:#e1effc;border-radius:8px;padding:6px 8px;margin-top:4px;"><span class="cd-label">🧂 총 자산</span><span class="cd-value">₩${fmt(grand)}</span></div>
      <div class="cd-row"><span class="cd-label">목표 달성률</span><span class="cd-value" style="font-size:18px;">${pct}%</span></div>
      <div style="text-align:right;font-size:10px;color:#ccc;margin-top:8px;">짠짠의 기록 🧂</div>`;
  }
}

window.dCd = function(){
  html2canvas(document.getElementById("cdmf"),{scale:2,useCORS:true}).then(function(c){
    const a=document.createElement("a");a.download="카드_"+cdType+".png";a.href=c.toDataURL();a.click();
  });
};

(function init(){
  buildYM("lgy","lgm",lgY,lgM);
  buildYM("iy","im",iY,iM);
  buildYM("ey","em",eY,eM);
  buildYM("nvy","nvm",nvY,nvM);
})();
</script>
</body>
</html>
