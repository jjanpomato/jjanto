import { eventWindow } from '../lib/config.js';
import { loadJson, FILES, EMPTY_EVENT } from '../lib/store.js';
import { json } from '../lib/http.js';

// 청첩장이 처음 열릴 때 부르는 공개 정보: 이벤트 기간 + 오픈채팅 링크 + 발표 결과(공개했을 때만)
export async function GET() {
  const ev = { ...EMPTY_EVENT, ...(await loadJson(FILES.event, EMPTY_EVENT)) };
  const win = eventWindow();
  return json(
    {
      event: win,
      openchatUrl: win.open ? ev.openchatUrl || null : null,
      hasOpenchat: !!ev.openchatUrl,
      results: ev.published ? ev.winners.filter((w) => w.name) : null,
    },
    200,
    { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=20, stale-while-revalidate=60' },
  );
}
