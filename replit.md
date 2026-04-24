# P:um 피움 — 부산대학교 학생 생활관리 앱

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references


## P:um 피움 Mobile App (`artifacts/pium-mobile`)

Expo React Native app (expo-router v6, path `/pium-mobile/`). Same features as the web app.

**Tabs (5):** 홈 / 공지 / 시간표 / 커뮤니티 / 설정

**Screens:**
- `login.tsx` — P:um 로고, 아이디/비밀번호 입력, 로그인
- `register.tsx` — 3단계 회원가입 (계정/이메일/학생증), 부산대 웹메일(@pusan.ac.kr) 인증
- `(tabs)/index.tsx` — 홈 (오늘 시간표, 할일, 바로가기)
- `(tabs)/notices.tsx` — 공지사항 (학교/학과/서비스 탭)
- `(tabs)/schedule.tsx` — 시간표 + 성적 (그리드 뷰, 과목 추가/삭제)
- `(tabs)/board.tsx` — 커뮤니티 게시판
- `(tabs)/settings.tsx` — 프로필 + 설정
- `meals.tsx` — 식단 (캠퍼스별/식당별, 주간 네비)
- `bus.tsx` — 순환버스 시간표
- `profile-edit.tsx` — 프로필 편집
- `academic-calendar.tsx` — 학사일정
- `campus-map.tsx` — 캠퍼스 지도
- `notifications-inbox.tsx` — 알림함
- `notification-settings.tsx` — 알림 설정
- `privacy-settings.tsx` — 개인정보 설정
- `post/[id].tsx` — 게시글 상세
- `restaurant/index.tsx` — 식당 목록
- `restaurant/[id].tsx` — 식당 상세
- `reading-rooms.tsx` — 열람실 좌석 현황 (새벽벌도서관 실시간)

**Key files:**
- `contexts/AuthContext.tsx` — 인증 (JWT, AsyncStorage `campus_life_token`)
- `hooks/useProfile.ts` — 프로필 (AsyncStorage `campus_life_profile`)
- `constants/colors.ts` — primary: `#00427D`
- `components/ErrorBoundary.tsx` — 에러 경계

**API Integration:**
- `setBaseUrl()`/`setAuthTokenGetter()` — `app/_layout.tsx` 모듈 레벨에서 설정
- `@workspace/api-client-react` 훅 사용 (useGetSchedules 등)
- 직접 fetch: `https://${EXPO_PUBLIC_DOMAIN}/api`

---

## CampusLife App — Feature Summary

### 캠퍼스라이프 Web App (`artifacts/campus-life`)
React + Vite app for 부산대학교 students. Bottom nav: **홈 / 게시판 / 설정**

**Pages:**
- `HomePage.tsx` — Date + 5 quick links (홈페이지/PLATO/도서관/식단/수강신청), weekly timetable (editable, import from 수강편람), To-do list (과제/팀플/동영상시청/기타 categories with D-day)
- `BoardPage.tsx` — 학과 게시판 with sample posts (category tabs: 전체/공지/자유/질문/거래)
- `MealsPage.tsx` — Real-time cafeteria meals (POST to pusan.ac.kr PC site); campus tabs (부산/밀양/양산), restaurant tabs per campus; week navigation; 정식/일품 subMenu separation; 천원의아침(menu-tit03) support; auto-refresh
- `SettingsPage.tsx` — Profile card + settings sections (계정/앱 설정/지원)

**API Routes (api-server):**
- `GET/POST /api/todos`, `PATCH/DELETE /api/todos/:id` — Todo CRUD
- `GET /api/schedule`, `POST /api/schedule`, `DELETE /api/schedule/:id` — Timetable (with year/semester columns)
- `GET /api/meals?restaurant=PG002&date=YYYY-MM-DD` — Weekly cafeteria meals; subMenus array per day (정식/일품/천원의아침); 3h cache; campuses: PUSAN(PG002/PH002/PG001), MIRYANG(M001/M002), YANGSAN(Y001)
- `GET /api/courses/departments?catalogYear&catalogSemester`, `GET /api/courses?catalogYear&catalogSemester&dept&gradeYear&category&search` — 수강편람 (21,992 courses: 2024-1학기 4,435, 2024-2학기 4,304, 2025-1학기 4,492, 2025-2학기 4,334, 2026-1학기 4,427); imported via `scripts/import-courses.mjs` from xlsx files in `attached_assets/`
- `GET/POST /api/grades`, `PATCH/DELETE /api/grades/:id` — Grade management CRUD

**DB Tables:** `schedules` (with year/semester), `restaurant`, `courses`, `todos`, `grades` (year, semester, subjectName, credits, grade, category); `users` (includes `college` nullable, `phone` nullable, `email` varchar(100) unique — 부산대 웹메일)

**Mobile App Features (pium-mobile):**
- **Dark Mode**: `ThemeContext` + `useTheme()` hook; mode: light/dark/system; persisted to AsyncStorage (`pium_theme_mode`); applied to all 5 tabs + profile-edit
- **Unified Header Pattern**: all tabs use subtitle(소자회색) + big bold title + primary accent  
- **Schedule**: semester management modal with individual class deletion (trash icon); course search from 수강편람; direct add  
- **이메일 인증 (회원가입/복구)**: SMS 제거 → 부산대 웹메일(@pusan.ac.kr) 인증. `POST /auth/send-verification` → `POST /auth/verify-code` → `POST /auth/register`. 복구: `/auth/find-id/send-verification`, `/auth/find-password/send-verification`. 인증코드는 인메모리(5분 TTL). 개발 모드: `MAIL_PASSWORD` 미설정 시 콘솔 mock + devCode 응답. `MAIL_PASSWORD` Replit Secret 설정 시 Gmail SMTP(pum.start@gmail.com) 실발송.
- **College/Major Auth**: OCR extracts `college` from student ID during registration; stored in DB; returned in `/auth/login` and `/auth/me`; `AuthUser` interface has `college?: string | null`
- **Profile Edit**: verified college/major shown read-only with lock icon; unverified fields remain editable
- **열람실 현황**: `reading-rooms.tsx` — 부산대 새벽벌도서관 24개 열람실 실시간 좌석 현황; Pyxis API (`GET /pyxis-api/1/seat-rooms?homepageId=1&smufMethodCode=SEAT&branchGroupId=1`); 인증 불필요; 웹은 `/api/library/seat-rooms` 프록시 사용(CORS 우회); 층별 그룹핑; 여유/혼잡/만석/사용불가 상태 배지; 점유율 바; 1분 자동 갱신; 홈 퀵링크 "도서관" → `/reading-rooms`

**Note:** API routes should NOT import `zod` directly — use `@workspace/db` re-exports only (esbuild bundling limitation).

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.
