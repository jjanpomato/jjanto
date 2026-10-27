import { loadJson, updateJson, FILES } from '../lib/store.js';
import { json, fail, clientIp, hashId, deviceId, cleanText, newId } from '../lib/http.js';

const SIDES = ['groom', 'bride'], MEALS = ['yes', 'no', 'unsure'];

function pub(e) {
  return e && { side: e.side, attend: e.attend, name: e.name, count: e.count, meal: e.meal, at: e.at };
}

// 내가 이전에 보낸 응답 (다시 열면 그대로 채워 주려고)
export async function GET(request) {
  const dev = deviceId(request, new URL(request.url).searchParams.get('device'));
  if (!dev) return json({ mine: null });
  const list = await loadJson(FILES.rsvp, []);
  return json({ mine: pub(list.find((e) => e.dev === hashId(dev))) || null });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('잘못된 요청이에요.');
  }
  if (body.website) return json({ ok: true });
  const dev = deviceId(request, body.deviceId);
  if (!dev) return fail('잘못된 요청이에요.');
  if (!SIDES.includes(body.side)) return fail('신랑 측인지 신부 측인지 골라 주세요.');
  if (!['yes', 'no'].includes(body.attend)) return fail('참석 여부를 골라 주세요.');
  const name = cleanText(body.name, 20);
  if (!name.ok) return fail('성함을 20자 이내로 적어 주세요.');
  const yes = body.attend === 'yes';
  const count = yes ? Math.trunc(Number(body.count)) : 0;
  if (yes && !(count >= 1 && count <= 10)) return fail('인원을 골라 주세요.');
  const meal = yes ? body.meal : 'no';
  if (yes && !MEALS.includes(meal)) return fail('식사 여부를 골라 주세요.');

  const devH = hashId(dev), ipH = hashId(clientIp(request));
  const res = await updateJson(FILES.rsvp, [], (list) => {
    const now = Date.now();
    if (list.filter((e) => e.ip === ipH && now - e.at < 60000).length >= 10) {
      return { abort: { status: 429, error: '잠시 후 다시 시도해 주세요.' } };
    }
    const entry = { side: body.side, attend: body.attend, name: name.value, count, meal, at: now, dev: devH, ip: ipH };
    const i = list.findIndex((e) => e.dev === devH);
    // 같은 기기에서 다시 보내면 새로 쌓지 않고 고쳐요
    if (i >= 0) list[i] = { ...list[i], ...entry };
    else list.unshift({ id: newId(), ...entry });
    return { entry };
  });
  if (res?.abort) return fail(res.abort.error, res.abort.status);
  return json({ ok: true, mine: pub(res.entry) });
}
