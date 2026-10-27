/* 하객 기능: 방명록 · 베스트 샷 오픈채팅 연결 · 결과 발표 */
(function(){
  var toast = window.toast || function(m){ alert(m); };
  var PAGE = 20;

  function $(id){ return document.getElementById(id); }
  function store(k, v){
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  /* 기기 ID: 방명록 도배 방지에만 써요 */
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
})();
