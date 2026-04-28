# 잇데이 운영자 admin 웹

운영자 전용 정적 웹 대시보드. 잇데이 백엔드(FastAPI) 의 `/admin/*` 엔드포인트를 호출한다.

## 디렉토리 구조

```
itdasy-admin/
├── index.html          대시보드 (오늘/이번주/이번달 KPI)
├── chat.html           채팅방 (사용자별 카카오톡 스타일)
├── announcements.html  공지 발송 (in-app + FCM)
├── metrics.html        운영 메트릭 (매출·API·Gemini·상담)
├── login.html          운영자 로그인
├── style.css           다크 테마 + 잇데이 핑크 강조
├── app-admin-core.js   인증·라우팅·API 공용 코어
├── app-admin-chat.js   채팅 UI 로직
├── app-admin-metrics.js   Chart.js 메트릭 렌더
└── app-admin-announce.js  공지 발송 폼 처리
```

## 백엔드 연결

기본값: `https://itdasy260417-staging-production.up.railway.app`

브라우저 콘솔에서 변경 가능:
```js
localStorage.setItem("itdasy_admin_api_base", "https://itdasy.api...");
location.reload();
```

## 인증

- `POST /admin/login` (이메일+비번) → JWT 토큰
- `User.is_admin=True` 사용자만 통과 (그 외 403)
- 토큰 저장: `localStorage["itdasy_admin_token"]` (잇데이 메인 앱과 키 분리)
- 모든 API 호출은 `Authorization: Bearer <token>` 헤더로 전송
- 만료 시 자동 `login.html` 으로 리다이렉트

## 배포

### GitHub Pages
```bash
cd itdasy-admin
git remote add origin https://github.com/Nopo-lab/itdasy-admin.git
git add .
git commit -m "init: itdasy admin web"
git push -u origin main
# 레포 Settings → Pages → Source: main / (root)
```

### Vercel
```bash
cd itdasy-admin
vercel --prod
```

정적 파일이라 빌드 불필요. 단순 호스팅만 됨.

## 백엔드 신규 라우터

`itdasy_backend/backend/routers/admin.py` 추가됨. `main.py` 에서 `app.include_router(admin_router.router)` 등록 완료.

엔드포인트:
- `POST   /admin/login`
- `GET    /admin/stats/overview`
- `GET    /admin/stats/memberships`
- `GET    /admin/stats/revenue?period=day|week|month`
- `GET    /admin/stats/api-usage?period=...`
- `GET    /admin/stats/gemini-cost?period=...`
- `GET    /admin/stats/support-tickets?period=...`
- `GET    /admin/chats?has_unread=all|true`
- `GET    /admin/chats/{user_id}/messages?limit=50`
- `POST   /admin/chats/{user_id}/reply`
- `POST   /admin/announcements`
- `GET    /admin/users?q=&limit=`

## 주의사항

- 운영 DB 의 `users.is_admin=True` 계정 필요
- Gemini 비용은 ApiUsageLog 기반 추정값 (정확 토큰 카운터 도입 전)
- 공지 발송은 모든 활성 사용자에게 in-app + FCM 일괄 — 발송 후 취소 불가
- 채팅·공지 푸시는 FCM 미설정 시 silent skip
