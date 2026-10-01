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
