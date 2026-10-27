// ===== 이벤트 설정은 여기서! =====
// 날짜는 한국 시간(+09:00) 기준이에요. Vercel 환경변수 EVENT_START / EVENT_END 를 넣으면 그 값이 우선이에요.
// 예) EVENT_START=2028-02-12T00:00:00+09:00
// 이 기간에만 청첩장의 "카카오톡 오픈채팅으로 바로가기" 버튼이 열려요.
export const EVENT_START = process.env.EVENT_START || '2028-02-12T00:00:00+09:00';
export const EVENT_END = process.env.EVENT_END || '2028-02-26T23:59:59+09:00';

export const LIMITS = {
  nameMax: 20,
  messageMax: 200,
  // 방명록 도배 방지: 같은 기기는 60초에 1번, 같은 IP는 60초에 5번까지
  guestbookDeviceCooldownMs: 60 * 1000,
  guestbookIpWindowMs: 60 * 1000,
  guestbookIpMax: 5,
};

export function eventWindow(now = Date.now()) {
  const start = Date.parse(EVENT_START);
  const end = Date.parse(EVENT_END);
  return { start: EVENT_START, end: EVENT_END, open: now >= start && now <= end, before: now < start };
}
