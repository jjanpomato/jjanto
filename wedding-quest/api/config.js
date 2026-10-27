import { eventWindow } from '../lib/config.js';
import { loadJson, FILES, EMPTY_EVENT } from '../lib/store.js';
import { json } from '../lib/http.js';

// 청첩장이 처음 열릴 때 부르는 공개 정보: 이벤트 기간·오픈채팅 링크·발표 결과·계좌·갤러리
export async function GET() {
  const [saved, gallery] = await Promise.all([loadJson(FILES.event, EMPTY_EVENT), loadJson(FILES.gallery, [])]);
  const ev = { ...EMPTY_EVENT, ...saved };
  const win = eventWindow();
  return json(
    {
      event: win,
      openchatUrl: win.open ? ev.openchatUrl || null : null,
      results: ev.published ? ev.winners.filter((w) => w.name) : null,
      accounts: ev.accounts,
      gallery: gallery.map(({ id, w, h }) => ({ id, w, h })),
    },
    200,
    { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=20, stale-while-revalidate=60' },
  );
}
