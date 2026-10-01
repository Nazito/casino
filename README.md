# Social casino

Пустой стартер: публичные страницы Angular пререндерятся, маршрут игры остаётся в браузере, кошелёк коинов живёт в Express и MongoDB.

Коины развлекательные: вывода и обмена на деньги нет.

Нужен Node.js 26 (`nvm use`).

```bash
npm install
npm install --prefix client
npm install --prefix server
cp server/.env.example server/.env
npm run dev
```

Сайт: http://localhost:4217  
API: http://localhost:3017/api/health

В `server/.env` нужна строка удалённого кластера MongoDB, не локальный `mongod`. Без `MONGODB_URI` API поднимается, а вход и спин отвечают 503. Если кластер недоступен при старте, API повторяет подключение.

Адрес в sitemap, robots и canonical берётся из `SITE_ORIGIN` или из `CLIENT_ORIGIN` в `server/.env`. Скрипт выполняется перед `npm start` и `npm run build` в `client`.

Проверка отдачи слота: `npm run rtp --prefix server`.

## Прод локально

```bash
npm run build
npm start
```

`npm start` ставит `NODE_ENV=production` и запускает один процесс. Страницы и `/api` слушают `PORT` из окружения или из `server/.env` (там для разработки указан 3017). Если этот порт занят `npm run dev`, задай другой: `PORT=3099 npm start`.

Публичные страницы отдаются готовым HTML. `/play/*` считается в браузере. CORS в этом режиме нет. По `SIGTERM` процесс перестаёт принимать запросы и закрывает MongoDB.

Имя хоста, кроме `localhost` и `127.0.0.1`, передай в `NG_ALLOWED_HOSTS` (несколько — через запятую). На Render имя сервиса подставляется само из `RENDER_EXTERNAL_HOSTNAME`. Прокси перед процессом должен подменять `X-Forwarded-*`, а не пропускать значения от клиента.

## Деплой на Render

Хостинг: Render, регион Frankfurt. Конфиг — `render.yaml`. База та же Atlas, отдельного стейджинга с другими данными нет: первый деплой и есть прод без публичного домена, пока не пройден чеклист запуска.

Переменные окружения на сервисе (значения в панель, не в репозиторий):

| Переменная | Зачем |
|---|---|
| `MONGODB_URI` | строка Atlas |
| `SITE_ORIGIN` | публичный URL сайта для sitemap и canonical при сборке, например `https://social-casino.onrender.com` |
| `CLIENT_ORIGIN` | тот же публичный URL; в проде Origin самого хоста тоже принимается |
| `NG_ALLOWED_HOSTS` | имя хоста без схемы, если не Render или нужен свой домен |
| `NODE_ENV` | в Blueprint уже `production` |
| `PORT` | задаёт Render сам |

`SITE_ORIGIN` при сборке на Render можно не задавать: скрипт возьмёт `RENDER_EXTERNAL_URL`. После смены своего домена задай `SITE_ORIGIN` явно и пересобери.

### Чеклист в панели Render и Atlas

1. В Render: New → Blueprint → этот репозиторий, файл `render.yaml`, ветка `main`.
2. В форме Blueprint впиши `MONGODB_URI`. `SITE_ORIGIN` и `CLIENT_ORIGIN` можно оставить пустыми до первого URL или сразу поставить будущий `https://….onrender.com`.
3. Дождись первого деплоя. Health check — `GET /api/health`. Пока MongoDB недоступна, ответ `503`, и Render не переведёт сервис в Live.
4. В Render → сервис → Settings → Outbound → включи static outbound IP (нужен платный план) и скопируй адреса.
5. В Atlas → Network Access добавь только эти IP и свой домашний IP. `0.0.0.0/0` не открывай.
6. Открой `https://….onrender.com/api/health` — должно быть `{ "ok": true, "database": true }`. Потом главную и один спин.
7. Когда появится свой домен: привяжи его в Render, выставь `SITE_ORIGIN`, `CLIENT_ORIGIN` и `NG_ALLOWED_HOSTS`, задеплой снова.

Автодеплой идёт с каждого пуша в `main`. Отдельного стейджинга нет.

### Откат

В Render → сервис → Events открой прошлый успешный Deploy → Redeploy. Либо в GitHub верни `main` на нужный коммит и дождись автодеплоя. База общая: откат кода не откатывает документы в Atlas.

## CI

На каждый pull request и push в `main` GitHub Actions ставит зависимости, собирает клиент и сервер, считает RTP и запускает `npm test` в `server`. Эти шаги базу не трогают.

В CI нет `ng test`: у клиента нет test-таргета и файлов `*.spec.ts`.

Перед мержем локально: `npm run test:db --prefix server`. Туда входят параллельные спины, дневной бонус, гостевые спины и HTTP регистрации и входа. Скрипт пишет в ту же базу Atlas и создаёт только пользователей `probe_`.

## Общая база

Скрипт `server/scripts/rtp.ts` в базу не пишет. Скрипты в `server/test` создают и удаляют только пользователей `probe_`. Массовых изменений сейчас нет. Если такой скрипт появится, он печатает число документов до запуска и требует флаг `--confirm`.

При старте API пишет в лог хост кластера и имя базы, без пароля.

Чеклист в Atlas, его делает владелец вручную:

- платный уровень кластера с бэкапами;
- одна учебная проверка восстановления из бэкапа;
- Network Access только с IP сервера и с IP владельца, без `0.0.0.0/0`;
- отдельный пользователь базы для сервера, без прав администратора кластера.
