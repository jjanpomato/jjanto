import { isAdmin } from '../../lib/auth.js';
import { updateJson, putFile, deleteFiles, FILES, galleryPath } from '../../lib/store.js';
import { json, fail, newId } from '../../lib/http.js';

export const MAX_GALLERY = 15;

const isJpeg = (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

// 관리자 갤러리 업로드: 브라우저에서 줄인 큰 사진(f)과 썸네일(t)을 같이 받아요
export async function POST(request) {
  if (!isAdmin(request)) return fail('로그인이 필요해요.', 401);
  let form;
  try {
    form = await request.formData();
  } catch {
    return fail('사진을 읽지 못했어요.');
  }
  const full = form.get('full'), thumb = form.get('thumb');
  if (!full || !thumb || typeof full === 'string' || typeof thumb === 'string') return fail('사진이 없어요.');
  const fb = Buffer.from(await full.arrayBuffer()), tb = Buffer.from(await thumb.arrayBuffer());
  if (!isJpeg(fb) || !isJpeg(tb)) return fail('사진 형식이 올바르지 않아요.');
  if (fb.length > 4 * 1024 * 1024) return fail('사진 용량이 너무 커요.');
  const w = Math.trunc(Number(form.get('w'))) || 0, h = Math.trunc(Number(form.get('h'))) || 0;

  const id = newId();
  await Promise.all([putFile(galleryPath(id, 'f'), fb, 'image/jpeg'), putFile(galleryPath(id, 't'), tb, 'image/jpeg')]);
  const res = await updateJson(FILES.gallery, [], (list) => {
    if (list.length >= MAX_GALLERY) return { abort: `사진은 최대 ${MAX_GALLERY}장까지 넣을 수 있어요.` };
    list.push({ id, w, h, at: Date.now() });
  });
  if (res?.abort) {
    await deleteFiles([galleryPath(id, 'f'), galleryPath(id, 't')]).catch(() => {});
    return fail(res.abort, 400);
  }
  return json({ ok: true, id }, 201);
}
