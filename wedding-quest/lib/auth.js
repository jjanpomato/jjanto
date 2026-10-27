import crypto from 'node:crypto';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function key() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  // 비밀번호를 바꾸면 기존 로그인 토큰도 모두 무효가 돼요
  return crypto.createHash('sha256').update('wedding-quest-admin:' + pw).digest();
}

export function checkPassword(input) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const a = crypto.createHash('sha256').update(String(input ?? '')).digest();
  const b = crypto.createHash('sha256').update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}

export function issueToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  const sig = crypto.createHmac('sha256', key()).update(String(exp)).digest('base64url');
  return `${exp}.${sig}`;
}

export function verifyToken(token) {
  const k = key();
  if (!k || typeof token !== 'string') return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = crypto.createHmac('sha256', k).update(exp).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAdmin(request) {
  const h = request.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : new URL(request.url).searchParams.get('t');
  return verifyToken(t);
}
