# 캠퍼스라이프 — 부산대학교 학생 생활관리 앱

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

Expo React Native app for 부산대학교 students. 5-tab structure.

**Architecture:**
- Expo Router (file-based routing), TypeScript
- `contexts/AuthContext.tsx` — JWT auth, AsyncStorage, `useAuth()`, `useApiUrl()`, `updateUser()`
- `constants/colors.ts` — Primary #2563EB, Accent #10B981, theme tokens
- All API calls via `useApiUrl()` hook → `https://${EXPO_PUBLIC_DOMAIN}/api`

**Tab Screens (`app/(tabs)/`):**
- `index.tsx` — 홈: greeting, date, stat cards (budget/grades), quick actions, today's schedule, notices
- `timetable.tsx` — 시간표: weekly grid, CRUD modal with color picker
- `meal.tsx` — 학식: restaurant + day selector, weekly menu display
- `community.tsx` — 커뮤니티: post list with categories, write modal
- `more.tsx` — 더보기: profile card, all sub-screens menu, logout

**Sub-screens (`app/`):**
- `grades.tsx` — GPA calculator, semester-grouped list, CRUD
- `budget.tsx` — Income/expense tracker, monthly summary
- `bus.tsx` — Real-time bus route (금정구7), 15s auto-refresh
- `calendar.tsx` — Academic calendar with month selector
- `map.tsx` — Campus building list with categories
- `notices.tsx` — PNU notice board (links to web)
- `settings.tsx` — Profile edit, notification toggles

**Auth Flow:** `_layout.tsx` → user=null → `<Redirect href="/login">` else Stack with all screens

**API Routes added for mobile:**
- `GET /api/schedule/academic` — Static academic calendar events (2025-2026)

---

## CampusLife App — Feature Summary

### 캠퍼스라이프 Web App (`artifacts/campus-life`)
React + Vite app for 부산대학교 students. Bottom nav: **홈 / 게시판 / 가계부 / 설정**

**Pages:**
- `HomePage.tsx` — Date + 5 quick links (홈페이지/PLATO/도서관/식단/수강신청), weekly timetable (editable, import from 수강편람), To-do list (과제/팀플/동영상시청/기타 categories with D-day)
- `BoardPage.tsx` — 학과 게시판 with sample posts (category tabs: 전체/공지/자유/질문/거래)
- `FinancePage.tsx` — Income/expense tracker with monthly summary
- `MealsPage.tsx` — Real-time cafeteria meals (POST to pusan.ac.kr PC site); campus tabs (부산/밀양/양산), restaurant tabs per campus; week navigation; 정식/일품 subMenu separation; 천원의아침(menu-tit03) support; auto-refresh
- `SettingsPage.tsx` — Profile card + settings sections (계정/앱 설정/지원)

**API Routes (api-server):**
- `GET/POST /api/todos`, `PATCH/DELETE /api/todos/:id` — Todo CRUD
- `GET /api/schedule`, `POST /api/schedule`, `DELETE /api/schedule/:id` — Timetable (with year/semester columns)
- `GET /api/finance`, `POST /api/finance`, `DELETE /api/finance/:id`, `GET /api/finance/summary` — Finance
- `GET /api/meals?restaurant=PG002&date=YYYY-MM-DD` — Weekly cafeteria meals; subMenus array per day (정식/일품/천원의아침); 3h cache; campuses: PUSAN(PG002/PH002/PG001), MIRYANG(M001/M002), YANGSAN(Y001)
- `GET /api/courses/departments`, `GET /api/courses` — 수강편람 (4,312 courses from 13 xlsx files)
- `GET/POST /api/grades`, `PATCH/DELETE /api/grades/:id` — Grade management CRUD

**DB Tables:** `schedules` (with year/semester), `finance_entries`, `restaurant`, `courses`, `todos`, `grades` (year, semester, subjectName, credits, grade, category)

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
