import { checkPassword, issueToken } from '../../lib/auth.js';
import { json, fail } from '../../lib/http.js';

export async function POST(request) {
  if (!process.env.ADMIN_PASSWORD) return fail('ADMIN_PASSWORD 환경변수가 설정되지 않았어요.', 500);
  let body = {};
  try {
    body = await request.json();
  } catch {}
  if (!checkPassword(body.password)) {
    await new Promise((r) => setTimeout(r, 800)); // 비밀번호 무작위 대입을 느리게
    return fail('비밀번호가 맞지 않아요.', 401);
  }
  return json({ token: issueToken() });
}
