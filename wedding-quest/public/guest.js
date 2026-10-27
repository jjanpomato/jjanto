/* 하객 기능: 방명록 · 베스트 샷 업로드 · 결과 발표 */
(function(){
  var toast = window.toast || function(m){ alert(m); };
  var MAX_SIDE = 1920, QUALITY = 0.85, MAX_BYTES = 3.8 * 1024 * 1024, PAGE = 20;

  function $(id){ return document.getElementById(id); }
  function store(k, v){
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  /* 기기 ID: 도배 방지·1인 5장 제한에만 써요 */
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
  ['gbName', 'upName'].forEach(function(id){
    var saved = store('wq_name'); if (saved) $(id).value = saved;
    $(id).addEventListener('change', function(){ store('wq_name', this.value.trim()); });
  });

  /* ===== 이벤트 기간 · 결과 발표 ===== */
  var eventInfo = null;
  function applyConfig(cfg){
    eventInfo = cfg.event;
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
  api('/api/config').then(applyConfig).catch(function(){});

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

  /* ===== 베스트 샷 업로드 ===== */
  var up = { used: 0, max: 5, picks: [], busy: false };
  function slotsLeft(){ return Math.max(0, up.max - up.used); }
  function renderSlots(){
    var s = $('upSlots'); s.textContent = '';
    for (var i = 0; i < up.max; i++) s.appendChild(el('i', i < up.used ? 'used' : (i < up.used + up.picks.length ? 'pick' : '')));
    s.appendChild(document.createTextNode(' 올린 사진 ' + up.used + '/' + up.max));
    $('upSubmit').disabled = up.busy || up.picks.length === 0 || !(eventInfo && eventInfo.open);
    $('upPicker').hidden = slotsLeft() - up.picks.length <= 0 || !(eventInfo && eventInfo.open);
  }
  function renderThumbs(){
    var box = $('upThumbs'); box.textContent = '';
    up.picks.forEach(function(p, i){
      var fig = el('figure'), img = el('img'); img.src = p.url; img.alt = ''; img.onerror = function(){ img.hidden = true; };
      fig.appendChild(img);
      if (p.state) fig.appendChild(el('span', 'st', p.state));
      if (!up.busy && p.state !== 'OK') {
        var rm = el('button', 'rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', '사진 ' + (i + 1) + ' 빼기');
        rm.addEventListener('click', function(){ URL.revokeObjectURL(p.url); up.picks.splice(i, 1); renderThumbs(); renderSlots(); });
        fig.appendChild(rm);
      }
      box.appendChild(fig);
    });
  }
  function setClosedNotice(){
    var n = $('upClosed');
    if (!eventInfo) { showErr(n); return; }
    if (eventInfo.open) showErr(n);
    else if (eventInfo.before) showErr(n, '사진 업로드는 예식 당일(' + fmtDay(eventInfo.start) + ')부터 열려요. 그날 꼭 다시 와 주세요!');
    else showErr(n, '이벤트가 마감됐어요(' + fmtDay(eventInfo.end) + '까지). 참여해 주셔서 고마워요!');
  }
  function refreshQuota(){
    return api('/api/photos?device=' + encodeURIComponent(device)).then(function(r){
      up.used = r.used; up.max = r.max; eventInfo = r.event; setClosedNotice(); renderSlots();
    });
  }
  $('openUpload').addEventListener('click', function(){
    openDialog($('upDialog')); setClosedNotice(); renderSlots();
    refreshQuota().catch(function(){});
  });

  /* 사진 크기 줄이기: 긴 변 1920px JPEG로 다시 그려요 (위치정보 등 EXIF도 함께 사라져요) */
  function shrink(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function(){
        var w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, MAX_SIDE / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        (function encode(q){
          c.toBlob(function(b){
            if (!b) return reject(new Error('사진을 변환하지 못했어요.'));
            if (b.size > MAX_BYTES && q > 0.5) return encode(q - 0.15);
            resolve(b);
          }, 'image/jpeg', q);
        })(QUALITY);
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('이 사진은 열 수 없어요. JPG나 PNG 사진으로 골라 주세요.')); };
      img.src = url;
    });
  }

  $('upFile').addEventListener('change', function(){
    var err = $('upErr'), files = Array.prototype.slice.call(this.files || []);
    this.value = '';
    showErr(err);
    var room = slotsLeft() - up.picks.length;
    var imgs = files.filter(function(f){ return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name); });
    if (imgs.length < files.length) showErr(err, '이미지 파일만 올릴 수 있어요. 이미지가 아닌 파일은 뺐어요.');
    if (imgs.length > room) { showErr(err, '한 사람당 최대 ' + up.max + '장이라 ' + room + '장만 담았어요.'); imgs = imgs.slice(0, room); }
    imgs.forEach(function(f){ up.picks.push({ file: f, url: URL.createObjectURL(f), state: '' }); });
    renderThumbs(); renderSlots();
  });

  $('upForm').addEventListener('submit', function(e){
    e.preventDefault();
    var f = this, err = $('upErr'), name = f.name.value.trim();
    if (!name) { showErr(err, '이름(닉네임)을 적어 주세요. 당첨되면 이 이름으로 연락드려요.'); f.name.focus(); return; }
    if (!up.picks.length || up.busy) return;
    store('wq_name', name); showErr(err);
    up.busy = true; renderSlots(); renderThumbs();
    var bar = $('upBar'), fill = bar.firstElementChild, total = up.picks.length, done = 0, failed = 0;
    bar.hidden = false; fill.style.width = '0%';
    var queue = up.picks.filter(function(p){ return p.state !== 'OK'; });
    (function next(){
      var p = queue.shift();
      if (!p) return finish();
      p.state = '줄이는 중'; renderThumbs();
      shrink(p.file).then(function(blob){
        p.state = '보내는 중'; renderThumbs();
        var fd = new FormData();
        fd.append('name', name); fd.append('deviceId', device); fd.append('website', f.website.value);
        fd.append('photo', blob, 'photo.jpg');
        return api('/api/photos', { method: 'POST', body: fd });
      }).then(function(r){
        p.state = 'OK'; up.used = r.used; done++;
      }).catch(function(x){
        p.state = '실패'; failed++; showErr(err, x.message);
        if (x.status === 429 || x.status === 403) queue.length = 0;
      }).then(function(){
        fill.style.width = Math.round(((done + failed) / total) * 100) + '%';
        renderThumbs(); next();
      });
    })();
    function finish(){
      up.picks = up.picks.filter(function(p){ if (p.state === 'OK') { URL.revokeObjectURL(p.url); return false; } return true; });
      up.busy = false; renderThumbs(); renderSlots();
      setTimeout(function(){ bar.hidden = true; }, 800);
      if (done) toast('사진 ' + done + '장을 보냈어요! 참여해 줘서 고마워요 ★');
    }
  });
})();
