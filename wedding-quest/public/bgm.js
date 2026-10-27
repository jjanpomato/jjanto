/* 배경음악: 브라우저에서 바로 연주하는 8비트 BGM 두 곡 (음악 파일 없음, 직접 작곡한 곡)
   - 프롤로그(모험 애니메이션)에서는 신나는 모험 곡, 청첩장 본문에서는 웨딩 왈츠가 나와요
   - 휴대폰은 화면을 한 번 눌러야 소리가 나서, 첫 터치(모험 시작·청첩장 바로 보기 등) 때 시작해요
   - 오른쪽 아래 ♪ 버튼으로 끄고 켤 수 있고, 끈 상태는 그 기기에 기억해요
   - 나중에 MP3로 바꾸려면 public/에 파일을 넣고 아래 곡의 src에 경로를 적으면 돼요 (예: '/bgm.mp3') */
(function(){
  var VOL = 0.4, KEY = 'wq_bgm_off', FADE = 0.6;
  var root = document.documentElement, btn = document.getElementById('bgmBtn');
  if (!btn) return;
  function store(v){ try { if (v === undefined) return localStorage.getItem(KEY); if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { return null; } }

  /* ===== 악보 =====
     8분음표 = 1칸, 한 마디 = 8칸, 16마디가 반복돼요. 음 이름 뒤 숫자는 칸 수, '.'은 쉼표, b는 플랫 */
  var SONGS = {
    // 모험 곡: 통통 튀는 RPG 마을 느낌
    adventure: { src: '', bpm: 108, lead: -1, melody: [
      // A: 길 위에서 만난 두 사람
      'E5 2','G5 2','C6 2','B5 1','A5 1',  'G5 2','E5 2','C5 2','E5 2',
      'F5 2','A5 2','C6 2','A5 1','G5 1',  'G5 4','F5 1','E5 1','D5 2',
      'E5 2','G5 2','C6 2','D6 1','E6 1',  'D6 2','B5 2','G5 4',
      'A5 2','C6 2','B5 2','D6 2',         'C6 6','. 2',
      // B: 함께 떠나는 웨딩 퀘스트
      'A5 1','G5 1','F5 2','A5 2','C6 2',  'B5 1','A5 1','G5 2','B5 2','D6 2',
      'G5 2','B5 2','E6 3','D6 1',         'C6 2','A5 2','E5 4',
      'F5 2','A5 2','D6 2','C6 1','A5 1',  'B5 2','D6 2','G5 2','A5 1','B5 1',
      'E6 2','D6 1','C6 1','B5 2','D6 2',  'C6 6','. 2'
    ], chords: ['C','Am','F','G','C','Em','F G','C','F','G','Em','Am','Dm','G','C','C'] },
    // 청첩장 곡: 3박자 웨딩 왈츠 (쿵-짝-짝 반주, 4마디마다 결혼식 종소리)
    // 9마디부터는 오르골이 한 옥타브 위에서 멜로디를 같이 불러요
    wedding: { src: '', bpm: 144, lead: -1, beats: 6, double: 48, melody: [
      // A: 두근두근 첫 만남
      'D6 4','B5 2',  'B5 4','F#5 2',  'E6 4','C6 2',  'B5 2','A5 4',
      'G5 2','B5 2','D6 2',  'G6 4','E6 2',  'E6 2','D6 2','C6 2',  'A5 6',
      // A': 조금 더 애틋하게
      'D6 4','B5 2',  'B5 4','F#5 2',  'E6 4','C6 2',  'Eb6 4','C6 2',
      'B5 2','D6 2','G6 2',  'G6 3','F#6 1','E6 2',  'E6 2','C#6 2','A5 2',  'D6 6',
      // B: 함께 걸어가는 길
      'B5 4','G5 2',  'F#5 4','B5 2',  'G5 2','C6 2','E6 2',  'D6 4','B5 2',
      'E6 3','D6 1','C6 2',  'B5 2','A5 2','F#5 2',  'G5 6',  '. 6'
    ], chords: ['G','Bm','C','D','G','Em','Am','D', 'G','Bm','C','Cm','G','Em','A','D', 'Em','Bm','C','G','Am','D','G','G'] }
  };
  var CH = { C:['C','E','G'], Am:['A','C','E'], F:['F','A','C'], G:['G','B','D'], Em:['E','G','B'], Dm:['D','F','A'], Bm:['B','D','F#'], Cm:['C','Eb','G'], D:['D','F#','A'], A:['A','C#','E'] };
  var SEMI = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  function semi(name){ return SEMI[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0); }
  function hz(name, oct){ return 440 * Math.pow(2, (semi(name) + (oct + 1) * 12 - 69) / 12); }
  function noteHz(s){ var n = s.replace(/\d+$/, ''); return hz(n, +s.slice(n.length)); }

  // 악보를 [시작 초, 길이 초, 주파수, 악기] 목록으로 펼쳐 둬요
  Object.keys(SONGS).forEach(function(id){
    var song = SONGS[id], step = 60 / song.bpm / 2, ev = [], pos = 0, bl = song.beats || 8;
    function add(at, len, f, kind){ ev.push([at * step, len * step, f, kind]); }
    song.melody.forEach(function(m){
      var p = m.split(' '), len = +p[1];
      if (p[0] !== '.') {
        var f = noteHz(p[0]) * Math.pow(2, song.lead);
        add(pos, len, f, 'lead');
        if (song.double && pos >= song.double) add(pos, Math.max(len, 3), f * 2, 'bell');
      }
      pos += len;
    });
    song.chords.forEach(function(c, bar){
      c.split(' ').forEach(function(name, half, all){
        var span = bl / all.length, at = bar * bl + half * span, tones = CH[name];
        var r2 = hz(tones[0], 2), f2 = hz(tones[2], semi(tones[2]) < semi(tones[0]) ? 3 : 2);
        if (bl === 6) {
          // 왈츠: 첫 박에 베이스 '쿵', 둘째·셋째 박에 화음 '짝 짝' (짝수 마디는 5음 베이스로 출렁이게)
          if (bar % 4 === 0) add(at, 14, hz(tones[0], 5), 'chime');
          add(at, 2, bar % 2 ? f2 : r2, 'sub');
          [2, 4].forEach(function(b){ tones.forEach(function(t){ add(at + b, 1, hz(t, 4), 'pad'); }); });
        } else {
          // 베이스: 근음·5음을 통통 번갈아 / 반주: 엇박에 화음을 콕콕 / 하이햇
          for (var i = 0; i < span; i += 2) add(at + i, 1.6, i % 4 ? f2 : r2, 'bass');
          for (var j = 1; j < span; j += 2) {
            tones.forEach(function(t){ add(at + j, 0.7, hz(t, 4), 'pad'); });
            add(at + j, 0.25, 0, 'hat');
          }
        }
      });
    });
    song.events = ev.sort(function(a, b){ return a[0] - b[0]; });
    song.loop = song.chords.length * bl * step;
  });

  /* ===== 악기 ===== */
  function pulse(ctx, duty){
    var n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (var i = 1; i < n; i++) { re[i] = Math.sin(2 * Math.PI * i * duty) / (i * Math.PI); im[i] = (1 - Math.cos(2 * Math.PI * i * duty)) / (i * Math.PI); }
    return ctx.createPeriodicWave(re, im);
  }
  var noiseBuf = null;
  function voice(ctx, out, e, t){
    var dur = e[1], kind = e[3], g = ctx.createGain(), src;
    g.connect(out);
    if (kind === 'hat') {
      if (!noiseBuf || noiseBuf.sampleRate !== ctx.sampleRate) {
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      src = ctx.createBufferSource(); src.buffer = noiseBuf;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      src.connect(hp); hp.connect(g);
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.start(t); src.stop(t + 0.06);
      return;
    }
    src = ctx.createOscillator(); src.frequency.value = e[2]; src.connect(g);
    if (kind === 'chime') {
      // 종소리: 맑은 기본음에 종 특유의 배음을 살짝 섞어 길게 울려요
      src.type = 'sine';
      var o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = 'sine'; o2.frequency.value = e[2] * 2.76; o2.connect(g2); g2.connect(g);
      g2.gain.value = 0.35;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      src.start(t); src.stop(t + dur + 0.02); o2.start(t); o2.stop(t + dur + 0.02);
      return;
    }
    if (kind === 'bell') {
      // 오르골: 땡 하고 울린 뒤 천천히 사라지는 소리
      src.type = 'sine';
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      src.start(t); src.stop(t + dur + 0.02);
      return;
    }
    var w = ctx.wqWaves || (ctx.wqWaves = { lead: pulse(ctx, 0.25), pad: pulse(ctx, 0.125) });
    if (w[kind]) src.setPeriodicWave(w[kind]); else src.type = 'triangle';
    var soft = kind === 'sub';
    var peak = { lead: 0.2, pad: 0.045, bass: 0.34, sub: 0.2 }[kind], hold = peak * (kind === 'lead' ? 0.7 : 0.5);
    var gate = dur * (soft ? 0.96 : 0.88), rel = soft ? 0.12 : 0.03;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + (soft ? 0.03 : 0.006));
    g.gain.linearRampToValueAtTime(hold, t + Math.min(soft ? 0.4 : 0.12, gate));
    g.gain.setValueAtTime(hold, t + gate);
    g.gain.linearRampToValueAtTime(0, t + gate + rel);
    if (kind === 'lead' && dur > 0.5) {
      // 긴 음엔 살짝 비브라토
      var lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(e[2] * 0.008, t + dur);
      lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(t + gate + rel + 0.02);
    }
    src.start(t); src.stop(t + gate + rel + 0.02);
  }

  /* ===== 재생 (조금씩 미리 예약하는 방식) ===== */
  var ctx = null, master = null, timer = 0, loopStart = 0, idx = 0, playing = false, song = null, audio = null, swap = 0;
  function want(){ return SONGS[root.classList.contains('intro') ? 'adventure' : 'wedding']; }
  function tick(){
    var ev = song.events, ahead = ctx.currentTime + 0.4;
    while (true) {
      if (idx >= ev.length) { idx = 0; loopStart += song.loop; }
      var e = ev[idx], t = loopStart + e[0];
      if (t > ahead) break;
      if (t >= ctx.currentTime - 0.02) voice(ctx, master, e, t);
      idx++;
    }
  }
  function fade(to, sec){
    var now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(to, now + sec);
  }
  // 지금 화면에 맞는 곡을 처음부터 틀어요
  function begin(){
    song = want();
    if (song.src) {
      if (!song.audio) { song.audio = new Audio(song.src); song.audio.loop = true; song.audio.volume = VOL; }
      audio = song.audio; audio.currentTime = 0;
      audio.play().catch(function(){ playing = false; render(); });
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { playing = false; return render(); }
    if (!ctx) {
      ctx = new AC(); master = ctx.createGain(); master.gain.value = 0;
      var lp = ctx.createBiquadFilter(); // 귀가 덜 따갑게 고음을 살짝 깎아요
      lp.type = 'lowpass'; lp.frequency.value = 6000; master.connect(lp); lp.connect(ctx.destination);
    }
    if (ctx.state !== 'running') ctx.resume();
    fade(VOL, 0.8);
    loopStart = ctx.currentTime + 0.1; idx = 0;
    clearInterval(timer); timer = setInterval(tick, 50); tick();
  }
  // 지금 곡을 살살 줄이며 멈춰요
  function end(sec){
    clearTimeout(swap);
    if (audio) { audio.pause(); audio = null; }
    if (timer) { clearInterval(timer); timer = 0; fade(0, sec); }
  }
  function start(){
    if (playing) return;
    playing = true; begin(); render();
  }
  function stop(){
    if (!playing) return;
    playing = false; end(0.15); render();
    setTimeout(function(){ if (!playing && ctx) ctx.suspend(); }, 200);
  }
  // 프롤로그 ↔ 청첩장으로 넘어가면 곡을 바꿔요
  new MutationObserver(function(){
    if (!playing || want() === song) return;
    end(FADE);
    swap = setTimeout(function(){ if (playing) begin(); }, FADE * 1000 + 100);
  }).observe(root, { attributes: true, attributeFilter: ['class'] });

  function render(){
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? '배경음악 끄기' : '배경음악 켜기');
    btn.classList.toggle('off', !playing);
  }
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    if (playing) { stop(); store(true); } else { store(false); start(); }
  });
  // 첫 터치 때 시작 (예전에 꺼 둔 기기라면 그대로 꺼 둬요)
  function first(e){
    if (btn.contains(e.target)) return; // ♪ 버튼을 먼저 누른 경우는 버튼이 알아서 처리해요
    document.removeEventListener('click', first, true);
    document.removeEventListener('touchend', first, true);
    if (!store()) start();
  }
  document.addEventListener('click', first, true);
  document.addEventListener('touchend', first, true);
  // 다른 앱으로 가거나 화면이 꺼지면 잠깐 멈춰요
  var paused = false;
  document.addEventListener('visibilitychange', function(){
    if (document.hidden) { if (playing) { paused = true; stop(); } }
    else if (paused) { paused = false; start(); }
  });
  render();

  // 미리 듣기 파일 만들 때 쓰는 함수 (곡을 소리 파일로 뽑아요)
  window.WQBGM = { songs: SONGS, now: function(){ return playing && song ? (song === SONGS.wedding ? 'wedding' : 'adventure') : null; },
    renderLoop: function(id, times){
      var s = SONGS[id || 'adventure']; times = times || 1;
      var off = new OfflineAudioContext(1, Math.ceil(44100 * (s.loop * times + 1.5)), 44100);
      var out = off.createGain(); out.gain.value = VOL;
      var lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
      out.connect(lp); lp.connect(off.destination);
      for (var n = 0; n < times; n++) s.events.forEach(function(e){ voice(off, out, e, 0.05 + n * s.loop + e[0]); });
      return off.startRendering();
    } };
})();
