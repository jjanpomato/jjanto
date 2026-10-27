// 링크 미리보기 이미지(public/og.png, 1200x630) 만들기: 로컬 서버(npm run dev)를 켠 상태에서 node scripts/og.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 미리 설치된 Playwright 사용

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.emulateMedia({ reducedMotion: 'reduce' }); // 움직임 없이 정지 장면으로
await page.goto(process.env.OG_URL || 'http://localhost:3000/');
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: `
  html.intro .intro-ov{display:none!important} html.intro body{overflow:visible} .bgm{display:none!important}
  body{background:#fff2f6} .wrap{max-width:none;padding:0;gap:0}
  .wrap>*:not(.scene){display:none!important}
  .scene{width:1200px;height:630px;border:0;border-radius:0;box-shadow:none}
  .scene canvas{margin-top:-195px}
  .scene .title{top:9%}
  .scene h1{font-size:120px;text-shadow:7px 0 #45283a,-7px 0 #45283a,0 7px #45283a,0 -7px #45283a,7px 7px #45283a,-7px 7px #45283a,7px -7px #45283a,-7px -7px #45283a,0 14px 0 rgba(69,40,58,.35)}
  .scene .date{font-size:34px;border-width:4px;padding:4px 20px;margin-top:22px}
  .tag{top:79%;font-size:30px;padding:10px 16px 8px;border-radius:6px}
` });
await page.waitForTimeout(300);
await page.screenshot({ path: 'public/og.png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('public/og.png');
