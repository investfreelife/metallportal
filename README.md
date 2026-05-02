# metallportal

Monorepo для проекта Harlan Steel: B2B-маркетплейс металлопроката.

## Состав

- **`/`** (web) — Next.js 14, публичный сайт + клиентский кабинет.
- **`crm/`** — Next.js 15, внутренний CRM для менеджеров и админов.
- **`mobile/`** — React Native / Expo, мобильное приложение для клиентов.

## CI

Каждый PR проходит автоматические проверки (см. `.github/workflows/`):

- **Web CI** — lint, type-check, build, `npm audit` (HIGH+, prod-only).
- **CRM CI** — то же для `crm/`.
- **Mobile CI** — lint + type-check (без полного Expo-билда).
- **E2E vs Preview** — Playwright против Vercel preview URL после успешного
  preview-deploy (`deployment_status` event).

Dependabot еженедельно открывает PR на обновления зависимостей
(`.github/dependabot.yml`).
