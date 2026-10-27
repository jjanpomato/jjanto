import { LIMITS, eventWindow } from '../lib/config.js';
import { loadJson, updateJson, putFile, deleteFile, FILES } from '../lib/store.js';
import { json, fail, clientIp, hashId, deviceId, cleanText, newId } from '../lib/http.js';

function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: 'image/png', ext: 'png' };
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return { type: 'image/webp', ext: 'webp' };
  return null;
}

// 이 기기에서 몇 장 더 올릴 수 있는지만 알려줘요 (사진은 공개하지 않아요)
export async function GET(request) {
  const dev = deviceId(request, new URL(request.url).searchParams.get('device'));
  const list = await loadJson(FILES.photos, []);
  const used = dev ? list.filter((p) => p.dev === hashId(dev)).length : 0;
  return json({ used, max: LIMITS.photosPerDevice, event: eventWindow() });
}

export async function POST(request) {
  const win = eventWindow();
  if (!win.open) return fail(win.before ? '아직 이벤트 기간이 아니에요. 예식 당일부터 올릴 수 있어요!' : '이벤트가 마감됐어요. 참여해 주셔서 고마워요!', 403);

  let form;
  try {
    form = await request.formData();
  } catch {
    return fail('사진을 읽지 못했어요. 다시 시도해 주세요.');
  }
  if (form.get('website')) return json({ ok: true });
  const name = cleanText(form.get('name'), LIMITS.nameMax);
  if (!name.ok) return fail(`이름은 1~${LIMITS.nameMax}자로 적어 주세요.`);
  const dev = deviceId(request, form.get('deviceId'));
  if (!dev) return fail('잘못된 요청이에요.');
  const file = form.get('photo');
  if (!file || typeof file === 'string') return fail('사진을 골라 주세요.');
  if (file.size > LIMITS.photoMaxBytes) return fail('사진 용량이 너무 커요.');
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = sniff(buf);
  if (!kind) return fail('이미지 파일(JPG·PNG·WEBP)만 올릴 수 있어요.');

  const devH = hashId(dev), ipH = hashId(clientIp(request));
  const pre = await loadJson(FILES.photos, []);
  if (pre.filter((p) => p.dev === devH).length >= LIMITS.photosPerDevice) {
    return fail(`한 사람당 최대 ${LIMITS.photosPerDevice}장까지 올릴 수 있어요.`, 429);
  }

  const id = newId();
  const pathname = `photos/${id}.${kind.ext}`;
  await putFile(pathname, buf, kind.type);

  const meta = { id, name: name.value, at: Date.now(), path: pathname, size: buf.length, dev: devH, ip: ipH };
  let res;
  try {
    // 동시에 여러 장을 보내도 5장을 넘지 않도록 저장하는 순간에 한 번 더 세요
    res = await updateJson(FILES.photos, [], (list) => {
      const now = Date.now();
      const used = list.filter((p) => p.dev === devH).length;
      if (used >= LIMITS.photosPerDevice) return { abort: { status: 429, error: `한 사람당 최대 ${LIMITS.photosPerDevice}장까지 올릴 수 있어요.` } };
      if (list.filter((p) => p.ip === ipH && now - p.at < LIMITS.photoIpWindowMs).length >= LIMITS.photoIpMax) {
        return { abort: { status: 429, error: '지금 사진이 많이 올라오고 있어요. 1분 뒤에 다시 시도해 주세요.' } };
      }
      list.unshift(meta);
      return { used: used + 1 };
    });
  } catch (e) {
    await deleteFile(pathname).catch(() => {});
    throw e;
  }
  if (res?.abort) {
    await deleteFile(pathname).catch(() => {});
    return fail(res.abort.error, res.abort.status);
  }
  return json({ ok: true, used: res.used, max: LIMITS.photosPerDevice }, 201);
}
