import { isAdmin } from '../../lib/auth.js';
import { eventWindow, LIMITS } from '../../lib/config.js';
import { loadJson, updateJson, deleteFiles, FILES, EMPTY_EVENT, galleryPath } from '../../lib/store.js';
import { json, fail, cleanText } from '../../lib/http.js';

async function snapshot() {
  const [guestbook, ev, rsvp, gallery] = await Promise.all([
    loadJson(FILES.guestbook, []),
    loadJson(FILES.event, EMPTY_EVENT),
    loadJson(FILES.rsvp, []),
    loadJson(FILES.gallery, []),
  ]);
  return {
    event: eventWindow(),
    settings: { ...EMPTY_EVENT, ...ev },
    guestbook: guestbook.map(({ id, name, msg, at }) => ({ id, name, msg, at })),
    rsvp: rsvp.map(({ id, side, attend, name, count, meal, at }) => ({ id, side, attend, name, count, meal, at })),
    gallery,
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
  } else if (action === 'deleteRsvp') {
    await updateJson(FILES.rsvp, [], (list) => {
      const i = list.findIndex((e) => e.id === body.id);
      if (i < 0) return { abort: null };
      list.splice(i, 1);
    });
  } else if (action === 'deletePhoto') {
    let removed = false;
    await updateJson(FILES.gallery, [], (list) => {
      const i = list.findIndex((p) => p.id === body.id);
      if (i < 0) return { abort: null };
      list.splice(i, 1);
      removed = true;
    });
    if (removed) await deleteFiles([galleryPath(body.id, 'f'), galleryPath(body.id, 't')]).catch(() => {});
  } else if (action === 'movePhoto') {
    // dir: -1 앞으로, 1 뒤로
    await updateJson(FILES.gallery, [], (list) => {
      const i = list.findIndex((p) => p.id === body.id), j = i + (body.dir < 0 ? -1 : 1);
      if (i < 0 || j < 0 || j >= list.length) return { abort: null };
      [list[i], list[j]] = [list[j], list[i]];
    });
  } else if (action === 'setAccounts') {
    // { groom: [{ who, bank, number }], bride: [...] } 한쪽에 최대 3줄
    const accounts = { groom: [], bride: [] };
    for (const side of ['groom', 'bride']) {
      const rows = Array.isArray(body.accounts?.[side]) ? body.accounts[side].slice(0, 3) : [];
      for (const r of rows) {
        const who = cleanText(r?.who, 20), bank = cleanText(r?.bank, 20), number = cleanText(r?.number, 40);
        if (!who.value && !bank.value && !number.value) continue;
        if (!who.ok || !number.ok || (bank.value && !bank.ok)) return fail('이름과 계좌번호를 확인해 주세요. (이름 20자, 계좌번호 40자 이내)');
        accounts[side].push({ who: who.value, bank: bank.value, number: number.value });
      }
    }
    await updateJson(FILES.event, EMPTY_EVENT, (ev) => {
      ev.accounts = accounts;
    });
  } else if (action === 'setInvite') {
    // 인사말(비우면 기본 문구) + 부모님 성함/관계
    const v = body.invite || {};
    const greeting = cleanText(v.greeting, 400, { multiline: true });
    const gp = cleanText(v.groomParents, 40), gr = cleanText(v.groomRel, 10);
    const bp = cleanText(v.brideParents, 40), brr = cleanText(v.brideRel, 10);
    for (const f of [greeting, gp, gr, bp, brr]) if (f.value && !f.ok) return fail('글자 수를 확인해 주세요. (인사말 400자, 성함 40자, 관계 10자)');
    await updateJson(FILES.event, EMPTY_EVENT, (ev) => {
      ev.invite = { greeting: greeting.value, groomParents: gp.value, groomRel: gr.value, brideParents: bp.value, brideRel: brr.value };
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
