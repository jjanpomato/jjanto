import { isAdmin } from '../../lib/auth.js';
import { loadJson, getFile, FILES } from '../../lib/store.js';
import { fail } from '../../lib/http.js';

// 관리자만 사진을 볼 수 있어요. <img>에서는 헤더를 못 붙여서 ?t=토큰 으로도 받아요
export async function GET(request) {
  if (!isAdmin(request)) return fail('로그인이 필요해요.', 401);
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const photo = (await loadJson(FILES.photos, [])).find((p) => p.id === id);
  if (!photo) return fail('사진을 찾지 못했어요.', 404);
  const file = await getFile(photo.path);
  if (!file) return fail('사진을 찾지 못했어요.', 404);
  const headers = {
    'Content-Type': file.contentType,
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  };
  if (url.searchParams.get('dl')) {
    const ext = photo.path.split('.').pop();
    const fname = `${photo.name}_${photo.id}.${ext}`;
    headers['Content-Disposition'] = `attachment; filename="photo.${ext}"; filename*=UTF-8''${encodeURIComponent(fname)}`;
  }
  return new Response(file.body, { headers });
}
