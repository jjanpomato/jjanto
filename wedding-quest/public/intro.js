/* 프롤로그: 줄거리 → 짧은 애니메이션(쿵! → 하트 → 뾰로롱 변신) → 청첩장 */
(function(){
  var root = document.documentElement, ov = document.getElementById('intro');
  if (!ov || !window.WQ) return;
  var WQ = window.WQ, reduce = WQ.reduce, GY = WQ.GY;
  function $(id){ return document.getElementById(id); }
  function mirror(a){ return a.map(function(r){ return r + r.split('').reverse().join(''); }); }
  function pal(extra){ var p = {}, k; for (k in WQ.base) p[k] = WQ.base[k]; for (k in extra) p[k] = extra[k]; return p; }

  /* ===== 모험가 시절 캐릭터 (반쪽만 그리고 좌우 대칭) ===== */
  // 도적 민수: 빨간 두건, 복면, 초록 튜닉
  var thief = mirror([
    "......oo","....oohh","...ohhhh","..ohhhhh","..orrrrr",".ohhhhhh",".ohhssss",".ohsssss",
    ".osssess",".osssess",".ommmmmm","..ommmmm",".ollllll",".ollllll",".osuuuuu",".ollllll",
    "..olllll","....onno","....onno","...okkko"]);
  var PT = pal({h:'#2b2b3a', r:'#d9455f', m:'#3b3552', l:'#4f7a46', u:'#7a4a2e'});
  // 마법사 상현: 뾰족 모자, 보라 로브, 금색 장식
  var mage = mirror([
    ".......o","......op",".....opp","....oppp","...oyyyy","oooppppp",
    "..ohhhhh",".ohhhhhh",".ohhssss",".ohhsess",".ohhsess",".ohhcsss",".ohhhsss",".ohhoooo",
    "..oppppy",".opppppy",".osppppy",".opppppy","oppppppy","oppppppy","oooooooo"]);
  var PM = pal({h:'#7a4a2e', p:'#7b5cd6', y:'#ffd95a'});
  var dagger = [".o","ow","ow","ow","uu",".u"];
  var staff = ["ogo","ggg","ogo",".d.",".d.",".d.",".d.",".d.",".d.",".d.",".d.",".d.",".d.",".d.",".d.",".d."];
  var PX = {o:'#2b2140', w:'#e6ecf5', u:'#7a4a2e', g:'#7fe3ff', d:'#8a5a33'};
  var heart = WQ.heart, HP = {o:'#2b2140', r:'#ff6b88'};

  function draw(ctx, spr, p, x, y){ WQ.drawSprite(ctx, spr, p, Math.round(x), Math.round(y)); }
  function feet(spr){ return GY - spr.length + 1; }

  /* 줄거리 화면의 파티 초상화 */
  [['pfThief', thief, PT], ['pfMage', mage, PM]].forEach(function(a){
    var c = $(a[0]); if (c) draw(c.getContext('2d'), a[1], a[2], 0, 0);
  });

  /* ===== 단계 전환 ===== */
  var steps = { title: $('stTitle'), play: $('stPlay') };
  function go(name){
    for (var k in steps) steps[k].hidden = k !== name;
    ov.scrollTop = 0;
  }
  var announced = false;
  function done(){
    stop();
    ov.classList.add('bye');
    setTimeout(function(){
      root.classList.remove('intro'); ov.classList.remove('bye');
      window.scrollTo(0, 0);
      if (!announced) { announced = true; window.dispatchEvent(new Event('wq:introdone')); }
    }, reduce ? 0 : 450);
  }
  $('introSkip').addEventListener('click', done);
  $('replayIntro').addEventListener('click', function(){
    go('title'); root.classList.add('intro');
  });
  $('introStart').addEventListener('click', function(){ go('play'); play(); });
  $('introJoin').addEventListener('click', done);

  /* ===== 애니메이션 ===== */
  var cv = $('introCv'), g = cv.getContext('2d'), boom = $('introBoom'), raf = 0, t0 = 0, last = -1;
  var END = 7600, SLOW = 2; // 대사를 읽을 수 있게 전체를 2배 느리게 재생해요
  var lines = [
    [0,    '나레이션', '홀로 모험하던\n민수와 상현.'],
    [1200, '나레이션', '좁은 길모퉁이를 돌던 그 순간—'],
    [2400, '민수', '쿵!! 앗, 죄송합니…'],
    [3300, '상현', '……!'],
    [4000, '나레이션', '두 사람의 눈이 마주치고\n하트가 뿅뿅 💕'],
    [4800, '나레이션', '뾰로롱~ ✨'],
    [6000, '민수', '이게… 운명인가 봐.'],
    [END,  '상현', '우리와 함께\n웨딩퀘스트 깨러 갈래?']
  ];
  function say(t){
    var i = lines.length - 1; while (i > 0 && lines[i][0] > t) i--;
    if (i === last) return; last = i;
    $('introWho').textContent = lines[i][1]; $('introLine').textContent = lines[i][2];
    $('introGo').hidden = t < END;
  }
  function lerp(a, b, k){ return a + (b - a) * Math.max(0, Math.min(1, k)); }
  var rising = [];
  function scene(t){
    var shake = t > 2400 && t < 2600 ? (Math.floor(t / 40) % 2 ? 1 : -1) : 0;
    g.save(); g.translate(shake, 0);
    WQ.world(g, t);
    var step = Math.floor(t / 160) % 2;
    if (t < 5400) {
      // 걸어오기 → 부딪혀서 살짝 튕겨나기
      var tx, mx;
      if (t < 2400) { tx = lerp(-20, 64, t / 2400); mx = lerp(176, 80, t / 2400); }
      else { tx = lerp(64, 56, (t - 2400) / 200); mx = lerp(80, 88, (t - 2400) / 200); }
      var walking = t < 2400 ? step : 0;
      draw(g, dagger, PX, tx - 3, feet(thief) + 10 - walking);
      draw(g, thief, PT, tx, feet(thief) - walking);
      draw(g, mage, PM, mx, feet(mage) - (walking ? 0 : 0) - (t < 2400 ? 1 - step : 0));
      draw(g, staff, PX, mx + 16, feet(staff) - 2);
      if (t >= 2400 && t < 3200) {
        // 머리 위 별 (쿵! 글자는 #introBoom)
        for (var s = 0; s < 3; s++) {
          var a = t / 150 + s * 2.1;
          g.fillStyle = '#ffd95a';
          g.fillRect(Math.round(64 + Math.cos(a) * 7), Math.round(60 + Math.sin(a) * 2), 2, 2);
          g.fillRect(Math.round(96 + Math.cos(a + 1) * 7), Math.round(58 + Math.sin(a + 1) * 2), 2, 2);
        }
      }
      if (t >= 3300 && t < 5400) {
        // 눈 맞음: 하트가 몽글몽글
        if (!reduce && Math.random() < 0.08) rising.push({ x: 72 + Math.random() * 14, y: 66, v: .25 + Math.random() * .2 });
        draw(g, heart, HP, 60, 52 - (step ? 1 : 0));
        draw(g, heart, HP, 92, 50 - (step ? 0 : 1));
      }
    } else {
      // 변신 완료: 턱시도와 드레스
      var bob = Math.round((Math.sin(t / 420) + 1) / 2), bob2 = Math.round((Math.sin(t / 420 + 1.6) + 1) / 2);
      draw(g, WQ.groom, WQ.PG, 56, GY - 22 - bob + 1);
      draw(g, WQ.bride, WQ.PB, 88, GY - 22 - bob2 + 1);
      draw(g, heart, HP, 76, 56 + Math.round(Math.sin(t / 300) * 2));
    }
    rising = rising.filter(function(h){
      h.y -= h.v; g.fillStyle = '#ff6b88';
      g.fillRect(Math.round(h.x), Math.round(h.y), 2, 1); g.fillRect(Math.round(h.x) + 3, Math.round(h.y), 2, 1);
      g.fillRect(Math.round(h.x), Math.round(h.y) + 1, 5, 1); g.fillRect(Math.round(h.x) + 1, Math.round(h.y) + 2, 3, 1); g.fillRect(Math.round(h.x) + 2, Math.round(h.y) + 3, 1, 1);
      return h.y > 20;
    });
    if (t >= 4800 && t < 6000) {
      // 뾰로롱: 반짝이가 빙글빙글 돌며 모여들고, 하얗게 번쩍
      var k = Math.min(1, (t - 4800) / 600), r = 22 * (1 - k) + 6;
      for (var i = 0; i < 10; i++) {
        var ang = t / 120 + i * (Math.PI / 5);
        g.fillStyle = i % 2 ? '#ffffff' : '#ffd95a';
        g.fillRect(Math.round(64 + Math.cos(ang) * r), Math.round(78 + Math.sin(ang) * r * .8), 2, 2);
        g.fillRect(Math.round(96 + Math.cos(-ang) * r), Math.round(78 + Math.sin(-ang) * r * .8), 2, 2);
      }
      var flash = 1 - Math.abs(t - 5400) / 250;
      if (flash > 0) { g.fillStyle = 'rgba(255,255,255,' + Math.min(1, flash).toFixed(2) + ')'; g.fillRect(0, 0, WQ.W, WQ.H); }
    }
    g.restore();
    var boomOn = t >= 2400 && t < 3200;
    if (boom.hidden === boomOn) boom.hidden = !boomOn;
  }
  function loop(now){
    if (!t0) t0 = now;
    var t = (now - t0) / SLOW;
    scene(t);
    say(t);
    raf = requestAnimationFrame(loop);
  }
  function play(){
    stop(); last = -1; rising = [];
    if (reduce) { scene(END); say(END); return; }
    t0 = 0; raf = requestAnimationFrame(loop);
  }
  function stop(){ cancelAnimationFrame(raf); raf = 0; boom.hidden = true; }
  // 화면을 누르면 애니메이션을 끝까지 넘겨요
  cv.addEventListener('click', function(){ if (raf) t0 = performance.now() - END * SLOW; });
})();
