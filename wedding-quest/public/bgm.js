/* 배경음악: 8비트 게임풍 BGM을 브라우저에서 바로 연주해요 (음악 파일 없음, 직접 작곡한 곡)
   - 휴대폰은 화면을 한 번 눌러야 소리가 나서, 첫 터치(모험 시작·청첩장 바로 보기 등) 때 시작해요
   - 오른쪽 아래 ♪ 버튼으로 끄고 켤 수 있고, 끈 상태는 그 기기에 기억해요
   - 나중에 MP3로 바꾸려면 public/에 파일을 넣고 SRC에 경로를 적으면 돼요 (예: '/bgm.mp3') */
(function(){
  var SRC = '';
  var VOL = 0.4, KEY = 'wq_bgm_off';
  var btn = document.getElementById('bgmBtn');
  if (!btn) return;
  function store(v){ try { if (v === undefined) return localStorage.getItem(KEY); if (v) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch (e) { return null; } }

  /* ===== 악보 =====
     8분음표 = 1칸, 한 마디 = 8칸, 16마디가 반복돼요. 음 이름 뒤 숫자는 칸 수, '.'은 쉼표 */
  var BPM = 108;
  var melody = [
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
  ];
  // 마디별 화음 (한 마디에 두 개면 반 마디씩)
  var chords = ['C','Am','F','G','C','Em','F G','C','F','G','Em','Am','Dm','G','C','C'];
  var CH = { C:['C','E','G'], Am:['A','C','E'], F:['F','A','C'], G:['G','B','D'], Em:['E','G','B'], Dm:['D','F','A'] };
  var SEMI = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
  function hz(name, oct){ return 440 * Math.pow(2, (SEMI[name] + (oct + 1) * 12 - 69) / 12); }
  function noteHz(s){ return hz(s[0], +s.slice(1)); }

  var STEP = 60 / BPM / 2, BARS = chords.length, LOOP = BARS * 8 * STEP;
  // 악보를 [시작 칸, 길이, 주파수, 악기] 목록으로 펼쳐 둬요
  var events = [], pos = 0;
  melody.forEach(function(m){
    var p = m.split(' '), len = +p[1];
    if (p[0] !== '.') events.push([pos, len, noteHz(p[0]) / 2, 'lead']);
    pos += len;
  });
  chords.forEach(function(c, bar){
    c.split(' ').forEach(function(name, half, all){
      var span = 8 / all.length, at = bar * 8 + half * span, tones = CH[name], root = hz(tones[0], 2), fifth = hz(tones[2], SEMI[tones[2]] < SEMI[tones[0]] ? 3 : 2);
      // 베이스: 근음·5음을 통통 번갈아
      for (var i = 0; i < span; i += 2) events.push([at + i, 1.6, i % 4 ? fifth : root, 'bass']);
      // 반주: 엇박에 화음을 콕콕
      for (var j = 1; j < span; j += 2) tones.forEach(function(t){ events.push([at + j, 0.7, hz(t, 4), 'pad']); });
      // 하이햇
      for (var k = 1; k < span; k += 2) events.push([at + k, 0.25, 0, 'hat']);
    });
  });

  /* ===== 악기 ===== */
  function pulse(ctx, duty){
    var n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (var i = 1; i < n; i++) { re[i] = Math.sin(2 * Math.PI * i * duty) / (i * Math.PI); im[i] = (1 - Math.cos(2 * Math.PI * i * duty)) / (i * Math.PI); }
    return ctx.createPeriodicWave(re, im);
  }
  var noiseBuf = null;
  function voice(ctx, out, e, t){
    var dur = e[1] * STEP, kind = e[3], g = ctx.createGain(), src;
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
    } else {
      src = ctx.createOscillator(); src.frequency.value = e[2];
      if (kind === 'bass') src.type = 'triangle';
      else {
        var w = ctx.wqWaves || (ctx.wqWaves = { lead: pulse(ctx, 0.25), pad: pulse(ctx, 0.125) });
        src.setPeriodicWave(w[kind]);
      }
      var peak = kind === 'lead' ? 0.2 : kind === 'bass' ? 0.34 : 0.045, gate = dur * 0.88;
      src.connect(g);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.006);
      g.gain.linearRampToValueAtTime(peak * (kind === 'lead' ? 0.7 : 0.5), t + Math.min(0.12, gate));
      g.gain.setValueAtTime(peak * (kind === 'lead' ? 0.7 : 0.5), t + gate);
      g.gain.linearRampToValueAtTime(0, t + gate + 0.03);
      if (kind === 'lead' && dur > 0.5) {
        // 긴 음엔 살짝 비브라토
        var lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(e[2] * 0.008, t + dur);
        lfo.connect(lg); lg.connect(src.frequency); lfo.start(t); lfo.stop(t + gate + 0.05);
      }
      src.start(t); src.stop(t + gate + 0.05);
    }
    g.connect(out);
  }

  /* ===== 재생 (조금씩 미리 예약하는 방식) ===== */
  var ctx = null, master = null, timer = 0, loopStart = 0, idx = 0, playing = false, audio = null;
  events.sort(function(a, b){ return a[0] - b[0]; });
  function tick(){
    var ahead = ctx.currentTime + 0.4;
    while (true) {
      if (idx >= events.length) { idx = 0; loopStart += LOOP; }
      var e = events[idx], t = loopStart + e[0] * STEP;
      if (t > ahead) break;
      if (t >= ctx.currentTime - 0.02) voice(ctx, master, e, t);
      idx++;
    }
  }
  function start(){
    if (playing) return;
    playing = true;
    if (SRC) {
      if (!audio) { audio = new Audio(SRC); audio.loop = true; audio.volume = VOL; }
      audio.play().catch(function(){ playing = false; render(); });
      return render();
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { playing = false; return; }
    if (!ctx) {
      ctx = new AC(); master = ctx.createGain();
      var lp = ctx.createBiquadFilter(); // 귀가 덜 따갑게 고음을 살짝 깎아요
      lp.type = 'lowpass'; lp.frequency.value = 6000; master.connect(lp); lp.connect(ctx.destination);
    }
    if (ctx.state !== 'running') ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(0, ctx.currentTime);
    master.gain.linearRampToValueAtTime(VOL, ctx.currentTime + 0.8);
    loopStart = ctx.currentTime + 0.1; idx = 0;
    clearInterval(timer); timer = setInterval(tick, 50); tick();
    render();
  }
  function stop(){
    if (!playing) return;
    playing = false;
    if (audio) audio.pause();
    if (ctx) {
      clearInterval(timer); timer = 0;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      setTimeout(function(){ if (!playing && ctx) ctx.suspend(); }, 200);
    }
    render();
  }
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

  // 미리 듣기 파일 만들 때 쓰는 함수 (한 바퀴를 소리 파일로 뽑아요)
  window.WQBGM = { loopSeconds: LOOP, renderLoop: function(times){
    times = times || 1;
    var offCtx = new OfflineAudioContext(1, Math.ceil(44100 * (LOOP * times + 1)), 44100);
    var out = offCtx.createGain(); out.gain.value = VOL;
    var lp = offCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6000;
    out.connect(lp); lp.connect(offCtx.destination);
    for (var n = 0; n < times; n++) events.forEach(function(e){ voice(offCtx, out, e, 0.05 + n * LOOP + e[0] * STEP); });
    return offCtx.startRendering();
  } };
})();
