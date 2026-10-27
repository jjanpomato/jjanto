import { isAdmin } from '../../lib/auth.js';
import { eventWindow } from '../../lib/config.js';
import { loadJson, updateJson, deleteFile, FILES } from '../../lib/store.js';
import { json, fail } from '../../lib/http.js';

const EMPTY_RESULTS = { published: false, winners: [] };

async function snapshot() {
  const [guestbook, photos, results] = await Promise.all([
    loadJson(FILES.guestbook, []),
    loadJson(FILES.photos, []),
    loadJson(FILES.results, EMPTY_RESULTS),
  ]);
  return {
    event: eventWindow(),
    guestbook: guestbook.map(({ id, name, msg, at }) => ({ id, name, msg, at })),
    photos: photos.map(({ id, name, at, size, dev }) => ({ id, name, at, size, dev: dev.slice(0, 6) })),
    results,
  };
}

export async function GET(request) {
  if (!isAdmin(request)) return fail('로그인이 필요해요.', 401);
  return json(await snapshot());
}

export async function POST(request) {
  if (!isAdmin(request)) return fail('로그인이 필요해요.', 401);
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('잘못된 요청이에요.');
  }
  const { action, id } = body;

  if (action === 'deleteEntry') {
    await updateJson(FILES.guestbook, [], (list) => {
      const i = list.findIndex((e) => e.id === id);
      if (i < 0) return { abort: null };
      list.splice(i, 1);
    });
  } else if (action === 'deletePhoto') {
    let removed = null;
    await updateJson(FILES.photos, [], (list) => {
      const i = list.findIndex((p) => p.id === id);
      if (i < 0) return { abort: null };
      [removed] = list.splice(i, 1);
    });
    if (removed) await deleteFile(removed.path).catch(() => {});
    await updateJson(FILES.results, EMPTY_RESULTS, (r) => {
      const before = r.winners.length;
      r.winners = r.winners.filter((w) => w.photoId !== id);
      if (r.winners.length === before) return { abort: null };
    });
  } else if (action === 'setRank') {
    // rank: 1·2·3 지정, 0이면 해제. 같은 등수에 다른 사진이 있으면 바꿔 끼워요
    const rank = Number(body.rank);
    if (![0, 1, 2, 3].includes(rank)) return fail('등수가 올바르지 않아요.');
    const photos = await loadJson(FILES.photos, []);
    const photo = photos.find((p) => p.id === id);
    if (!photo) return fail('사진을 찾지 못했어요.', 404);
    await updateJson(FILES.results, EMPTY_RESULTS, (r) => {
      r.winners = r.winners.filter((w) => w.photoId !== id && w.rank !== rank);
      if (rank) r.winners.push({ rank, photoId: id, name: photo.name });
      r.winners.sort((a, b) => a.rank - b.rank);
    });
  } else if (action === 'publish') {
    await updateJson(FILES.results, EMPTY_RESULTS, (r) => {
      r.published = !!body.published;
    });
  } else {
    return fail('알 수 없는 작업이에요.');
  }
  return json(await snapshot());
}
