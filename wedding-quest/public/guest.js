/* 하객 기능: 참석 여부 · 갤러리 · 방명록 · 베스트 샷 오픈채팅 · 결과 발표 · 계좌 */
(function(){
  var toast = window.toast || function(m){ alert(m); };
  var PAGE = 20;

  function $(id){ return document.getElementById(id); }
  function store(k, v){
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  /* 기기 ID: 방명록 도배 방지와 참석 여부 수정에만 써요 */
  var device = store('wq_device');
  if (!device) {
    device = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
    store('wq_device', device);
  }
  function api(path, opts){
    return fetch(path, opts).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(body){
        if (!r.ok) { var e = new Error(body.error || '잠시 문제가 생겼어요. 다시 시도해 주세요.'); e.status = r.status; throw e; }
        return body;
      });
    });
  }
  function el(tag, cls, text){ var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function fmtTime(ms){
    var d = new Date(ms), now = new Date();
    var hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (d.toDateString() === now.toDateString()) return hm;
    return (d.getMonth() + 1) + '.' + d.getDate() + ' ' + hm;
  }
  function fmtDay(iso){
    var d = new Date(iso);
    // 한국 시간 기준 날짜
    var k = new Date(d.getTime() + 9 * 3600000);
    return k.getUTCFullYear() + '.' + String(k.getUTCMonth() + 1).padStart(2, '0') + '.' + String(k.getUTCDate()).padStart(2, '0');
  }
  function showErr(node, msg){ node.textContent = msg || ''; node.hidden = !msg; }

  /* 창 열고 닫기 */
  function openDialog(d){
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  document.querySelectorAll('dialog.pop').forEach(function(d){
    d.addEventListener('click', function(e){ if (e.target === d || e.target.closest('[data-close]')) d.close ? d.close() : d.removeAttribute('open'); });
  });
  var savedName = store('wq_name'); if (savedName) $('gbName').value = savedName;

  /* ===== 이벤트 기간 · 결과 발표 ===== */
  function applyConfig(cfg){
    setOpenchat(cfg);
    renderAccounts(cfg.accounts);
    renderInvite(cfg.invite);
    renderGallery(cfg.gallery || []);
    $('evPeriod').textContent = fmtDay(cfg.event.start) + ' ~ ' + fmtDay(cfg.event.end) + (cfg.event.open ? ' (진행 중!)' : '');
    if (cfg.results && cfg.results.length) {
      $('announce').hidden = false;
      var items = $('ranks').children;
      cfg.results.forEach(function(w){
        var li = items[w.rank - 1]; if (!li) return;
        var pz = li.querySelector('.pz');
        var old = pz.querySelector('.win-name'); if (old) old.remove();
        var n = el('span', 'win-name', '🏆 ' + w.name + ' 님');
        pz.appendChild(document.createElement('br')); pz.appendChild(n);
      });
    }
  }
  api('/api/config').then(applyConfig).catch(function(){ setOpenchat({ event: {}, openchatUrl: null }); });

  /* ===== 방명록 ===== */
  var gb = { all: [], shown: 0, loaded: false };
  function renderEntry(e){
    var li = el('li'), meta = el('div', 'meta');
    meta.appendChild(el('b', null, e.name));
    var t = el('time', null, fmtTime(e.at)); t.dateTime = new Date(e.at).toISOString(); meta.appendChild(t);
    li.appendChild(meta); li.appendChild(el('p', null, e.msg));
    return li;
  }
  function renderList(reset){
    var list = $('gbList');
    if (reset) { list.textContent = ''; gb.shown = 0; }
    var next = gb.all.slice(gb.shown, gb.shown + PAGE);
    next.forEach(function(e){ list.appendChild(renderEntry(e)); });
    gb.shown += next.length;
    $('gbEmpty').hidden = gb.all.length > 0;
    $('gbMore').hidden = gb.shown >= gb.all.length;
  }
  function renderPreview(){
    var ul = $('gbPreview'); ul.textContent = '';
    gb.all.slice(0, 3).forEach(function(e){
      var li = el('li'); li.appendChild(el('b', null, e.name));
      li.appendChild(document.createTextNode(e.msg.length > 40 ? e.msg.slice(0, 40) + '…' : e.msg));
      ul.appendChild(li);
    });
    ul.hidden = gb.all.length === 0;
  }
  function loadGuestbook(){
    return api('/api/guestbook').then(function(r){
      // 방금 내가 쓴 글이 캐시 때문에 아직 안 보이면 맨 위에 붙여 둬요
      var mine = gb.all.filter(function(e){ return e._mine && !r.entries.some(function(x){ return x.id === e.id; }); });
      gb.all = mine.concat(r.entries); gb.loaded = true;
      renderList(true); renderPreview();
    });
  }
  loadGuestbook().catch(function(){});
  $('openGuestbook').addEventListener('click', function(){
    openDialog($('gbDialog'));
    loadGuestbook().catch(function(){ if (!gb.loaded) showErr($('gbErr'), '방명록을 불러오지 못했어요.'); });
  });
  $('gbMore').addEventListener('click', function(){ renderList(false); });
  $('gbMsg').addEventListener('input', function(){ $('gbCount').textContent = Array.from(this.value).length + '/200'; });
  $('gbForm').addEventListener('submit', function(e){
    e.preventDefault();
    var f = this, btn = $('gbSubmit'), err = $('gbErr');
    var name = f.name.value.trim(), msg = f.message.value.trim();
    if (!name) { showErr(err, '이름(닉네임)을 적어 주세요.'); f.name.focus(); return; }
    if (!msg) { showErr(err, '축하 메시지를 적어 주세요.'); f.message.focus(); return; }
    if (Array.from(msg).length > 200) { showErr(err, '메시지는 200자 이내로 적어 주세요.'); return; }
    var last = Number(store('wq_gb_last') || 0), left = 60000 - (Date.now() - last);
    if (left > 0) { showErr(err, '방금 남기셨어요! ' + Math.ceil(left / 1000) + '초 뒤에 다시 써 주세요.'); return; }
    showErr(err); btn.disabled = true;
    api('/api/guestbook', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, message: msg, deviceId: device, website: f.website.value })
    }).then(function(r){
      store('wq_gb_last', String(Date.now())); store('wq_name', name);
      if (r.entry) { r.entry._mine = true; gb.all.unshift(r.entry); renderList(true); renderPreview(); }
      f.message.value = ''; $('gbCount').textContent = '0/200';
      toast('메시지를 남겼어요. 고마워요! ♥');
    }).catch(function(x){ showErr(err, x.message); })
      .then(function(){ btn.disabled = false; });
  });

  /* ===== 베스트 샷: 카카오톡 1:1 오픈채팅으로 보내기 ===== */
  var chat = $('openchat');
  function setOpenchat(cfg){
    var ok = !!cfg.openchatUrl;
    chat.classList.toggle('off', !ok);
    if (ok) chat.href = cfg.openchatUrl; else chat.removeAttribute('href');
    chat.onclick = ok ? null : function(e){
      e.preventDefault();
      var ev = cfg.event;
      if (ev.before) toast('예식 당일(' + fmtDay(ev.start) + ')부터 열려요. 그날 사진 많이 찍어 주세요!');
      else if (!ev.open) toast('이벤트가 마감됐어요. 참여해 주셔서 고마워요!');
      else toast('오픈채팅 링크를 준비 중이에요. 잠시 후 다시 눌러 주세요!');
    };
  }
  setOpenchat({ event: {}, openchatUrl: null });

  /* ===== 마음 전하실 곳 (관리자 페이지에서 입력한 계좌) ===== */
  function renderAccounts(acc){
    if (!acc) return;
    var box = $('accounts'); box.textContent = '';
    [['groom', '신랑측'], ['bride', '신부측']].forEach(function(side){
      var d = el('details', 'acc'), ul = el('ul');
      d.appendChild(el('summary', null, side[1]));
      var rows = acc[side[0]] || [];
      if (!rows.length) { var li0 = el('li'); li0.appendChild(el('span', 'num', '계좌 정보를 준비 중이에요.')); ul.appendChild(li0); }
      rows.forEach(function(r){
        var li = el('li'), num = el('span', 'num'), v = (r.bank ? r.bank + ' ' : '') + r.number;
        num.appendChild(el('b', null, r.who)); num.appendChild(document.createTextNode(v));
        var b = el('button', 'btn sm alt copy', '복사'); b.type = 'button'; b.setAttribute('data-v', v);
        li.appendChild(num); li.appendChild(b); ul.appendChild(li);
      });
      d.appendChild(ul); box.appendChild(d);
    });
  }

  /* ===== 우리 사진 (갤러리) ===== */
  var photos = [], cur = 0;
  function renderGallery(list){
    if (!list.length) return;
    photos = list;
    var box = $('gal'); box.textContent = '';
    list.forEach(function(p, i){
      var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', '사진 ' + (i + 1) + ' 크게 보기');
      var img = el('img'); img.src = '/api/img?s=t&id=' + encodeURIComponent(p.id); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      b.appendChild(img); b.addEventListener('click', function(){ showPhoto(i); openDialog($('lbDialog')); });
      box.appendChild(b);
    });
    $('galNote').textContent = '사진을 누르면 크게 볼 수 있어요.';
  }
  function showPhoto(i){
    cur = (i + photos.length) % photos.length;
    $('lbImg').src = '/api/img?s=f&id=' + encodeURIComponent(photos[cur].id);
    $('lbImg').alt = '우리 사진 ' + (cur + 1);
    $('lbCount').textContent = (cur + 1) + ' / ' + photos.length;
    // 다음 사진 미리 받아 두기
    if (photos.length > 1) { var n = new Image(); n.src = '/api/img?s=f&id=' + encodeURIComponent(photos[(cur + 1) % photos.length].id); }
  }
  $('lbPrev').addEventListener('click', function(){ showPhoto(cur - 1); });
  $('lbNext').addEventListener('click', function(){ showPhoto(cur + 1); });
  $('lbDialog').addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft') showPhoto(cur - 1); else if (e.key === 'ArrowRight') showPhoto(cur + 1);
  });
  (function(){ // 옆으로 밀어서 넘기기
    var x0 = null, box = $('lbImg').parentNode;
    box.addEventListener('touchstart', function(e){ x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function(e){
      if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) showPhoto(cur + (dx < 0 ? 1 : -1));
    });
  })();

  /* ===== 참석 여부 ===== */
  var rf = $('rsvpForm');
  var cnt = rf.count; for (var c = 1; c <= 10; c++) { var o = el('option', null, c + '명'); o.value = c; cnt.appendChild(o); }
  function syncAttend(){ rf.querySelector('.when-yes').hidden = !(rf.attend.value === 'yes'); }
  rf.addEventListener('change', syncAttend); syncAttend();
  var SIDE = { groom: '신랑 측', bride: '신부 측' }, MEAL = { yes: '식사 O', no: '식사 X', unsure: '식사 미정' };
  function showMine(m){
    var box = $('rsvpMine');
    if (!m) { box.hidden = true; return; }
    box.hidden = false;
    box.textContent = '✔ ' + m.name + ' 님 (' + SIDE[m.side] + ') · ' + (m.attend === 'yes' ? '참석 ' + m.count + '명 · ' + MEAL[m.meal] : '불참') + ' — 잘 전달됐어요. 고마워요!';
    $('openRsvp').textContent = '참석 여부 수정하기';
  }
  function fillForm(m){
    if (!m) { if (savedName) rf.name.value = savedName; return; }
    rf.side.value = m.side; rf.attend.value = m.attend; rf.name.value = m.name;
    if (m.attend === 'yes') { rf.count.value = m.count; rf.meal.value = m.meal; }
    syncAttend();
  }
  var mine = null;
  api('/api/rsvp?device=' + encodeURIComponent(device)).then(function(r){ mine = r.mine; showMine(mine); }).catch(function(){});
  $('openRsvp').addEventListener('click', function(){ fillForm(mine); showErr($('rsvpErr')); openDialog($('rsvpDialog')); });
  rf.addEventListener('submit', function(e){
    e.preventDefault();
    var err = $('rsvpErr'), btn = $('rsvpSubmit');
    if (!rf.side.value) return showErr(err, '어느 쪽 하객이신지 골라 주세요.');
    if (!rf.attend.value) return showErr(err, '참석 여부를 골라 주세요.');
    if (!rf.name.value.trim()) { rf.name.focus(); return showErr(err, '성함을 적어 주세요.'); }
    if (rf.attend.value === 'yes' && !rf.meal.value) return showErr(err, '식사 여부를 골라 주세요.');
    showErr(err); btn.disabled = true;
    api('/api/rsvp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: device, side: rf.side.value, attend: rf.attend.value, name: rf.name.value.trim(), count: rf.count.value, meal: rf.meal.value, website: rf.website.value })
    }).then(function(r){
      mine = r.mine; showMine(mine); store('wq_name', mine.name);
      $('rsvpDialog').close();
      toast(mine.attend === 'yes' ? '참석 소식 고마워요! 그날 만나요 ♥' : '알려 줘서 고마워요. 마음만으로도 충분해요 ♥');
    }).catch(function(x){ showErr(err, x.message); })
      .then(function(){ btn.disabled = false; });
  });

  /* ===== STEP 0 인사말 · 부모님 (관리자 페이지에서 입력) ===== */
  function renderInvite(v){
    if (!v) return;
    if (v.greeting) $('greet').textContent = v.greeting;
    if (v.groomParents) $('pGroom').textContent = v.groomParents;
    if (v.brideParents) $('pBride').textContent = v.brideParents;
    if (v.groomRel) $('rGroom').textContent = '의 ' + v.groomRel;
    if (v.brideRel) $('rBride').textContent = '의 ' + v.brideRel;
  }
})();
