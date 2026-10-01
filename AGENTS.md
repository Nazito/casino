# Для агентов: как войти в проект

Social casino для Украины: слоты на развлекательные коины, которые нельзя вывести или обменять.
Некоммерческий проект. Angular (SSR и пререндер) + Express 5 + MongoDB Atlas.

## Прочитай перед работой

1. `.cursor/rules/constitution.mdc` — правила, которые нельзя нарушать. Подключается сама.
2. `docs/architecture.md` — как устроен код: запросы, авторизация, коины, игра, клиент.
3. `docs/decisions.md` — что уже решено и почему. Не предлагай заново то, что там отклонено.
4. `docs/roadmap.md` — какой сейчас этап. `docs/mvp-plan.md` — задачи и промпты к ним.

## Где что лежит

| Путь | Что там |
|---|---|
| `server/src/index.ts` | Express: helmet, CORS, проверка Origin, подключение `/api` |
| `server/src/routes/api.ts` | все эндпоинты API |
| `server/src/auth.ts` | пароли (scrypt), сессии в cookie `sid` |
| `server/src/login-limit.ts` | лимиты входа и регистрации в MongoDB |
| `server/src/models/` | `user.ts` (баланс, бонус, спин), `ledger.ts` (журнал), `session.ts` |
| `server/src/games/` | математика слотов, по файлу на игру |
| `server/scripts/rtp.ts` | расчёт RTP, `npm run rtp --prefix server` |
| `server/test/` | тесты с базой, только пользователи `probe_` |
| `client/src/app/pages/` | страницы Angular |
| `client/src/app/games.ts` | каталог игр для публичных страниц |
| `client/scripts/write-site.mjs` | адрес сайта, sitemap и robots при сборке |
| `.agents/skills/`, `.cursor/skills/` | скилы: `tune-rtp`, `angular-developer`, `mongodb-connection`, `find-skills` |

## Команды

Node 26 (`nvm use`). Секреты — в `server/.env`, образец в `server/.env.example`.

```bash
npm run dev                          # сайт :4217, API :3017
npm run build                        # клиент и сервер
npm run rtp --prefix server          # RTP слота, падает вне 94–96%
npm run test:spins --prefix server   # параллельные спины (пишет в базу)
npm run test:daily --prefix server   # ежедневный бонус (пишет в базу)
npm run test:guest --prefix server   # 50 спинов без аккаунта и сложение коинов (пишет в базу)
```

Под песочницей Cursor `tsx` падает с `listen EPERM ... .pipe` — запускай без песочницы.

## Как работать

- Одна задача — одна ветка — **отдельный worktree**. Несколько чатов работают параллельно; не переключай ветки
  и не делай `git stash` в чужой рабочей копии.
- Ветка от свежего `origin/main`, изменения — через PR. В `main` напрямую не пушить.
- База одна для прода и разработки: каждая запись в базу из тестов и скриптов — только для `probe_`.
- Ответы API об ошибках — `{ error: 'snake_case_code' }`, тексты для игроков переводит клиент.

## Держи документацию живой

В том же PR, что и код:

- изменил поведение, эндпоинт, коллекцию, переменную окружения или команду — обнови `docs/architecture.md`
  и, если нужно, этот файл;
- принял или отменил решение — запись в `docs/decisions.md`;
- добавил шрифт, звук или картинку — запись в `docs/assets.md`;
- закрыл задачу из плана — статус в `docs/roadmap.md`.

Нашёл расхождение документации и кода — верь коду, исправь документацию и скажи об этом пользователю.
