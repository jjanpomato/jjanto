import { eventWindow } from '../lib/config.js';
import { loadJson, FILES } from '../lib/store.js';
import { json } from '../lib/http.js';

// 청첩장이 처음 열릴 때 부르는 공개 정보: 이벤트 기간 + 발표 결과(공개했을 때만)
export async function GET() {
  const results = await loadJson(FILES.results, { published: false, winners: [] });
  return json(
    {
      event: eventWindow(),
      results: results.published ? results.winners.map(({ rank, name }) => ({ rank, name })) : null,
    },
    200,
    { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=20, stale-while-revalidate=60' },
  );
}
