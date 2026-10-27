import crypto from 'node:crypto';

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export const fail = (message, status = 400) => json({ error: message }, status);

export function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for') || '';
  return xf.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
}

// 기기 ID·IP는 원문 대신 해시로만 저장해요
export function hashId(value) {
  return crypto.createHash('sha256').update('wedding-quest:' + String(value)).digest('hex').slice(0, 24);
}

export function deviceId(request, fromBody) {
  const v = String(fromBody || request.headers.get('x-device-id') || '').trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(v) ? v : null;
}

// 이름·메시지 정리: 제어문자 제거, 앞뒤 공백 제거, 글자 수(이모지 포함)로 길이 확인
export function cleanText(value, max, { multiline = false } = {}) {
  let s = String(value ?? '').normalize('NFC');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  s = s.replace(/\n{3,}/g, '\n\n').trim();
  const len = [...s].length;
  return { value: s, ok: len > 0 && len <= max, len };
}

export function newId() {
  return Date.now().toString(36) + crypto.randomBytes(5).toString('hex');
}
