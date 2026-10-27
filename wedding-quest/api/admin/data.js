import { isAdmin } from '../../lib/auth.js';
import { eventWindow, LIMITS } from '../../lib/config.js';
import { loadJson, updateJson, FILES, EMPTY_EVENT } from '../../lib/store.js';
import { json, fail, cleanText } from '../../lib/http.js';

async function snapshot() {
  const [guestbook, ev] = await Promise.all([loadJson(FILES.guestbook, []), loadJson(FILES.event, EMPTY_EVENT)]);
  return {
    event: eventWindow(),
    settings: { ...EMPTY_EVENT, ...ev },
    guestbook: guestbook.map(({ id, name, msg, at }) => ({ id, name, msg, at })),
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
  const { action } = body;

  if (action === 'deleteEntry') {
    await updateJson(FILES.guestbook, [], (list) => {
      const i = list.findIndex((e) => e.id === body.id);
      if (i < 0) return { abort: null };
      list.splice(i, 1);
    });
  } else if (action === 'setOpenchat') {
    // 빈 값이면 링크 해제. 카카오 오픈채팅 주소만 받아요
    const url = String(body.url || '').trim();
    if (url && !/^https:\/\/open\.kakao\.com\/[A-Za-z0-9/_\-?=&.]+$/.test(url)) {
      return fail('카카오톡 오픈채팅 링크(https://open.kakao.com/...)를 넣어 주세요.');
    }
    await updateJson(FILES.event, EMPTY_EVENT, (ev) => {
      ev.openchatUrl = url;
    });
  } else if (action === 'setWinners') {
    // names: [1등, 2등, 3등] 이름. 빈 칸은 미정
    const names = Array.isArray(body.names) ? body.names.slice(0, 3) : [];
    const winners = [];
    for (let i = 0; i < 3; i++) {
      const n = cleanText(names[i], LIMITS.nameMax);
      if (n.value && !n.ok) return fail(`이름은 ${LIMITS.nameMax}자 이내로 적어 주세요.`);
      if (n.value) winners.push({ rank: i + 1, name: n.value });
    }
    await updateJson(FILES.event, EMPTY_EVENT, (ev) => {
      ev.winners = winners;
    });
  } else if (action === 'publish') {
    await updateJson(FILES.event, EMPTY_EVENT, (ev) => {
      ev.published = !!body.published;
    });
  } else {
    return fail('알 수 없는 작업이에요.');
  }
  return json(await snapshot());
}
