import { LIMITS } from '../lib/config.js';
import { loadJson, updateJson, FILES } from '../lib/store.js';
import { json, fail, clientIp, hashId, deviceId, cleanText, newId } from '../lib/http.js';

const MAX_ENTRIES = 5000;

// 공개 목록: 이름·메시지·시간만 내보내요 (최신순)
export async function GET() {
  const list = await loadJson(FILES.guestbook, []);
  return json(
    { entries: list.map(({ id, name, msg, at }) => ({ id, name, msg, at })) },
    200,
    { 'Cache-Control': 'public, max-age=0, must-revalidate', 'Vercel-CDN-Cache-Control': 'max-age=10, stale-while-revalidate=60' },
  );
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail('잘못된 요청이에요.');
  }
  if (body.website) return json({ ok: true }); // 봇 함정 칸(사람에게는 안 보여요)
  const name = cleanText(body.name, LIMITS.nameMax);
  const msg = cleanText(body.message, LIMITS.messageMax, { multiline: true });
  if (!name.ok) return fail(`이름은 1~${LIMITS.nameMax}자로 적어 주세요.`);
  if (!msg.ok) return fail(`메시지는 1~${LIMITS.messageMax}자로 적어 주세요.`);
  const dev = deviceId(request, body.deviceId);
  if (!dev) return fail('잘못된 요청이에요.');
  const devH = hashId(dev), ipH = hashId(clientIp(request));

  const entry = { id: newId(), name: name.value, msg: msg.value, at: Date.now(), dev: devH, ip: ipH };
  const res = await updateJson(FILES.guestbook, [], (list) => {
    const now = Date.now();
    const lastDev = list.find((e) => e.dev === devH);
    if (lastDev && now - lastDev.at < LIMITS.guestbookDeviceCooldownMs) {
      const wait = Math.ceil((LIMITS.guestbookDeviceCooldownMs - (now - lastDev.at)) / 1000);
      return { abort: { status: 429, error: `방금 남기셨어요! ${wait}초 뒤에 다시 써 주세요.`, wait } };
    }
    const ipCount = list.filter((e) => e.ip === ipH && now - e.at < LIMITS.guestbookIpWindowMs).length;
    if (ipCount >= LIMITS.guestbookIpMax) {
      return { abort: { status: 429, error: '지금 글이 너무 많이 올라오고 있어요. 1분 뒤에 다시 시도해 주세요.', wait: 60 } };
    }
    list.unshift(entry);
    if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES;
  });
  if (res?.abort) return json({ error: res.abort.error, wait: res.abort.wait }, res.abort.status);
  const { id, name: n, msg: m, at } = entry;
  return json({ ok: true, entry: { id, name: n, msg: m, at } }, 201);
}
