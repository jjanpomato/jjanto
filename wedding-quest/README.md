# 결혼 퀘스트 (모바일 청첩장)

도트 RPG 컨셉 청첩장 + 방명록 + 베스트 샷 이벤트(카카오톡 1:1 오픈채팅으로 사진 받기). Vercel(정적 페이지 + Functions) + Vercel Blob(비공개 스토어, 방명록·설정 저장).

## 폴더
- `public/index.html` 청첩장 (문구 수정은 여기서)
- `public/guest.js` 방명록·오픈채팅 버튼·발표 표시
- `public/admin.html` 관리자 페이지 → `/admin` (오픈채팅 링크 입력, 당첨자 입력·발표, 방명록 삭제)
- `api/` 서버 함수, `lib/config.js` **이벤트 기간·제한 설정**

## Vercel 환경변수
| 이름 | 설명 |
|---|---|
| `ADMIN_PASSWORD` | 관리자 비밀번호 (바꾸면 기존 로그인은 모두 풀려요) |
| `BLOB_READ_WRITE_TOKEN` | Blob 스토어를 프로젝트에 연결하면 자동으로 생겨요 |
| `EVENT_START`, `EVENT_END` | (선택) 오픈채팅 버튼이 열리는 기간. 예: `2028-02-12T00:00:00+09:00`. 없으면 `lib/config.js` 기본값 |

환경변수를 바꾼 뒤에는 **재배포**해야 적용돼요.

## 로컬 확인
```
npm install
ADMIN_PASSWORD=test EVENT_START=2026-01-01T00:00:00+09:00 npm run dev   # http://localhost:3000
```
Blob 토큰이 없으면 `.data/` 폴더에 저장돼요.

## QR 코드
`npm run qr -- https://최종주소` → `qr/wedding-quest-qr.png`
