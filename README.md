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

Без `MONGODB_URI` API поднимается, а маршруты кошелька отвечают 503.
