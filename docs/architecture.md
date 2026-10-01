# Архитектура

Как устроен код сейчас. Описывает `main`; при изменении поведения обновляется в том же PR.

## Общая схема

```
Браузер ── Angular (SSR / пререндер) ──/api──> Express 5 ──> MongoDB Atlas (одна база)
```

- В разработке два процесса: `ng serve` на :4217 проксирует `/api` на Express :3017 (`client/proxy.conf.json`).
- Прод-деплоя ещё нет. План — один Node-процесс на одном домене (задача 2.1 в `docs/mvp-plan.md`).

## Сервер

### Конвейер запроса (`server/src/index.ts`)

1. `trust proxy = 1` — `req.ip` берётся из первого прокси.
2. `helmet` — заголовки безопасности.
3. `cors` — только `CLIENT_ORIGIN`, с cookie.
4. Проверка Origin: любой запрос, кроме GET, HEAD и OPTIONS, без `Origin === CLIENT_ORIGIN` получает `403 bad_origin`.
   Это защита от CSRF вместе с `sameSite: lax`.
5. `cookie-parser`, `express.json`, роутер `/api`.

Подключение к MongoDB (`db.ts`) повторяется каждые 5 секунд, пока не удастся. До подключения эндпоинты,
которым нужна база, отвечают `503 database_unavailable`.

### API (`server/src/routes/api.ts`)

| Метод и путь | Что делает | Ошибки |
|---|---|---|
| `GET /api/health` | `{ ok, database }` | — |
| `GET /api/session` | текущий игрок | `401 unauthorized` |
| `POST /api/auth/register` | `{ username, password, adult: true }` → игрок, сессия | `invalid_username`, `invalid_password`, `age_required`, `username_taken`, `too_many_attempts` |
| `POST /api/auth/login` | `{ username, password }` → игрок, сессия | `invalid_credentials`, `too_many_attempts` |
| `POST /api/auth/logout` | завершает сессию | — |
| `POST /api/wallet/daily` | бонус при балансе < 10 | `daily_not_needed`, `daily_already_claimed` |
| `POST /api/games/neon-fruits/spin` | `{ stake }` → барабаны, выигрыш, игрок | `invalid_stake`, `insufficient_balance`, `slow_down` |

Игрок в ответах: `id`, `displayName`, `balance`, `dailyAvailable`, `dailyGrant`, `minStake`, `spins` (последние 20).

### Авторизация (`auth.ts`)

- Логин: 3–24 символа, буквы, цифры, `_` и `-`, нормализация NFKC. Для входа — `loginKey` в нижнем регистре.
- Пароль: 8–128 символов, scrypt (N=16384) с солью, формат `scrypt$соль$ключ`.
- Если пользователя нет, всё равно выполняется проверка пароля по фиктивному хешу — время ответа не выдаёт,
  существует ли логин.
- Сессия: случайный токен 32 байта в cookie `sid` (httpOnly, `sameSite: lax`, `secure` в проде), 30 дней.
  В базе хранится только SHA-256 токена.

### Лимиты

| Где | Что | Хранение |
|---|---|---|
| регистрация | 10 запросов за 15 мин с IP | память процесса (`express-rate-limit`) |
| регистрация | 3 аккаунта за 15 мин с IP | MongoDB `authlimits` |
| вход и регистрация | 20 попыток за 15 мин с IP | MongoDB `authlimits` |
| вход | 5 неудач по логину → блокировка на 15 мин | MongoDB `authlimits` |
| спин | 90 в минуту на игрока (или IP) | память процесса |

Лимиты в памяти действуют на один процесс и сбрасываются при перезапуске.

### Коины (`models/user.ts`, `models/ledger.ts`)

- Старт: 10 000 коинов. Минимальная ставка — 10.
- Ежедневный бонус: 2 000, только при балансе < 10, раз в киевские сутки (`kyivDay`, `Europe/Kyiv`).
- Каждое изменение баланса — одна транзакция `withTransaction` (повтор при конфликте записи):
  условный `findOneAndUpdate` (условие в фильтре, например `balance >= stake`) + запись в журнал `ledger`.
- Журнал: `type` = `start`, `daily` или `spin`, `delta`, `balanceAfter`. Записи спинов живут 90 дней (TTL),
  поэтому сумма журнала со временем перестаёт совпадать с балансом. Это ожидаемо.
- В документе игрока дополнительно хранятся последние 20 спинов для интерфейса.

### Игра Neon Fruits (`games/neon-fruits.ts`)

- 3 барабана, 7 символов с весами `NEON_FRUITS_WEIGHTS`, случайность — `crypto.randomInt`.
- Выплаты: три одинаковых — множитель из `THREE_KIND`; пара — из `PAIR` (сейчас платят только вишня и апельсин).
- Ставки: 10, 50, 100, 500. Дублируются в клиенте (`client/src/app/player.ts`) — менять в обоих местах.
- RTP 95,06%, частота выигрыша 29,8%, максимум 150×. Проверка: `npm run rtp --prefix server`, скил `tune-rtp`.

### Коллекции MongoDB

| Коллекция | Что | TTL |
|---|---|---|
| `users` | игрок, баланс, последние спины | — |
| `sessions` | хеш токена, `userId`, `expiresAt` | по `expiresAt` |
| `ledgers` | журнал изменений баланса | 90 дней только для `spin` |
| `authlimits` | счётчики лимитов входа и регистрации | по `expiresAt` |

## Клиент

- Angular с SSR. Маршруты: `/`, `/games`, `/games/:slug`, `/play/:slug`, `/rules`, `/terms`, `/privacy`.
- Все публичные страницы пререндерятся (`app.routes.server.ts`), `/games/:slug` — по списку из `games.ts`.
  `/play/:slug` рендерится только в браузере и закрыт в robots.
- SEO: каждая публичная страница вызывает `Seo.apply(title, description, path)` — title, description, Open Graph, canonical.
- Адрес сайта: `client/scripts/write-site.mjs` перед `start` и `build` пишет `site.generated.ts`, `robots.txt`
  и `sitemap.xml` из `SITE_ORIGIN` или `CLIENT_ORIGIN`. **Список путей sitemap задан в скрипте вручную** —
  новую публичную страницу добавляй и туда.
- Состояние игрока — сервис `Session` (`session.ts`) на signals.
- Символы барабанов — эмодзи как текст (`symbolLabel` в `player.ts`), рисуются шрифтом устройства.
- 18+: модальное окно на сайте и обязательный флажок при регистрации (сервер проверяет `adult: true`).
- Язык интерфейса пока русский (`lang="ru"`), переход на украинский — задача 3.1.

## Переменные окружения (`server/.env`)

| Переменная | Зачем |
|---|---|
| `PORT` | порт API, по умолчанию 3017 |
| `MONGODB_URI` | кластер Atlas, база одна для прода и разработки |
| `CLIENT_ORIGIN` | разрешённый Origin для CORS и проверки POST; адрес сайта по умолчанию |
| `SITE_ORIGIN` | адрес сайта для sitemap и canonical при сборке (если отличается) |

Запланированы: `SUPPORT_EMAIL`, `SMTP_USER`, `SMTP_PASS` (задачи 3.6, 3.7).

## Проверки и тесты

- CI (`.github/workflows/ci.yml`) на каждый PR и push в `main`: сборка, `rtp`, `test:spins`, `test:daily`.
- Тесты с базой — скрипты на `tsx` в `server/test/`. Имена тестовых аккаунтов —
  `probe_<вид>_<id запуска>` (`probe-name.ts`), каждый запуск удаляет только свои.

## Известный долг

- CI запускает тесты с базой через секрет `MONGODB_URI`, то есть пишет в живую базу игроков.
  По плану (задача 1.1) в CI должны идти только тесты без базы.
- Нет модульных тестов на чистые функции (`payout`, `canClaimDaily`, валидация) — задача 1.2.
- Ставки и список путей sitemap дублируются вручную.
- Лимиты регистрации и спинов в памяти — при нескольких процессах не общие.
