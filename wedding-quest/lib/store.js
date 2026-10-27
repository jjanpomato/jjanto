// 저장소: Vercel Blob(비공개 스토어). 방명록·참석 여부·설정 JSON과 갤러리 사진을 보관해요. BLOB_READ_WRITE_TOKEN이 없으면(로컬 개발) .data/ 폴더를 써요.
import { put, get, del } from '@vercel/blob';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const useBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const LOCAL_DIR = path.join(process.cwd(), '.data');

class Conflict extends Error {}

async function readJson(pathname, fallback) {
  if (!useBlob) {
    try {
      const txt = await fs.readFile(path.join(LOCAL_DIR, pathname), 'utf8');
      return { data: JSON.parse(txt), etag: crypto.createHash('md5').update(txt).digest('hex') };
    } catch (e) {
      if (e.code === 'ENOENT') return { data: fallback, etag: null };
      throw e;
    }
  }
  const r = await get(pathname, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return { data: fallback, etag: null };
  const txt = await new Response(r.stream).text();
  return { data: JSON.parse(txt), etag: r.blob.etag };
}

async function writeJson(pathname, data, etag) {
  const txt = JSON.stringify(data);
  if (!useBlob) {
    const file = path.join(LOCAL_DIR, pathname);
    await fs.mkdir(path.dirname(file), { recursive: true });
    const cur = await readJson(pathname, null);
    if (cur.etag !== etag) throw new Conflict();
    await fs.writeFile(file + '.tmp', txt);
    await fs.rename(file + '.tmp', file);
    return;
  }
  try {
    await put(pathname, txt, {
      access: 'private',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      // 처음 만들 때는 덮어쓰기 금지, 이후에는 내가 읽은 버전(ETag)일 때만 덮어써요
      ...(etag ? { allowOverwrite: true, ifMatch: etag } : { allowOverwrite: false }),
    });
  } catch (e) {
    if (e?.constructor?.name === 'BlobPreconditionFailedError' || /exist|precondition/i.test(e?.message || '')) throw new Conflict();
    throw e;
  }
}

// JSON 파일을 읽고 → 고치고 → 다른 사람이 그 사이 바꾸지 않았을 때만 저장. 충돌하면 다시 시도해요.
// mutate가 { abort: 값 }을 돌려주면 저장하지 않고 그 값을 돌려줘요.
let localLock = Promise.resolve();

export async function updateJson(pathname, fallback, mutate) {
  if (!useBlob) {
    // 로컬 개발용 파일 저장은 한 번에 하나씩만
    const run = localLock.then(() => updateJsonInner(pathname, fallback, mutate));
    localLock = run.catch(() => {});
    return run;
  }
  return updateJsonInner(pathname, fallback, mutate);
}

async function updateJsonInner(pathname, fallback, mutate) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, etag } = await readJson(pathname, structuredClone(fallback));
    const res = await mutate(data);
    if (res && res.abort !== undefined) return res;
    try {
      await writeJson(pathname, data, etag);
      return res;
    } catch (e) {
      if (!(e instanceof Conflict)) throw e;
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 150 * (attempt + 1)));
    }
  }
  throw new Error('저장이 몰려서 실패했어요. 잠시 후 다시 시도해 주세요.');
}

export async function loadJson(pathname, fallback) {
  return (await readJson(pathname, fallback)).data;
}

export async function putFile(pathname, buf, contentType) {
  if (!useBlob) {
    const file = path.join(LOCAL_DIR, pathname);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);
    return;
  }
  await put(pathname, buf, { access: 'private', contentType, addRandomSuffix: false, allowOverwrite: false });
}

export async function getFile(pathname) {
  if (!useBlob) {
    try {
      return { body: await fs.readFile(path.join(LOCAL_DIR, pathname)), contentType: 'image/jpeg' };
    } catch {
      return null;
    }
  }
  const r = await get(pathname, { access: 'private' });
  if (!r || r.statusCode !== 200) return null;
  return { body: r.stream, contentType: r.blob.contentType };
}

export async function deleteFiles(pathnames) {
  if (!useBlob) {
    await Promise.all(pathnames.map((p) => fs.rm(path.join(LOCAL_DIR, p), { force: true })));
    return;
  }
  await del(pathnames);
}

export const FILES = {
  guestbook: 'data/guestbook.json',
  rsvp: 'data/rsvp.json',
  gallery: 'data/gallery.json',
  // 오픈채팅 링크 + 당첨자 발표 + 계좌 정보 + 인사말·부모님
  event: 'data/event.json',
};

export const EMPTY_INVITE = { greeting: '', groomParents: '', groomRel: '', brideParents: '', brideRel: '' };
export const EMPTY_EVENT = { openchatUrl: '', published: false, winners: [], accounts: { groom: [], bride: [] }, invite: EMPTY_INVITE };

export const galleryPath = (id, size) => `gallery/${id}-${size}.jpg`;
