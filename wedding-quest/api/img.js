import { getFile, galleryPath } from '../lib/store.js';
import { fail } from '../lib/http.js';

// 갤러리 사진 공개 주소: /api/img?id=...&s=t(썸네일)|f(크게 보기). 한 번 올린 사진은 바뀌지 않아서 오래 캐시해요
export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const size = url.searchParams.get('s') === 'f' ? 'f' : 't';
  if (!/^[a-z0-9]{8,40}$/.test(id)) return fail('잘못된 주소예요.', 404);
  const file = await getFile(galleryPath(id, size));
  if (!file) return fail('사진을 찾지 못했어요.', 404);
  return new Response(file.body, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=86400',
      'Vercel-CDN-Cache-Control': 'max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
