import mongoose from 'mongoose';

const RETRY_MS = 5_000;

export function connectDb(uri: string | undefined): void {
  if (!uri) {
    console.warn('MONGODB_URI не задан. Нужна строка удалённого кластера MongoDB в server/.env.');
    return;
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB отключена');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('MongoDB снова подключена');
  });

  const connect = () => {
    mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10_000 })
      .then(() => {
        console.log('MongoDB подключена');
      })
      .catch((error: unknown) => {
        console.error(`Не удалось подключиться к MongoDB, повтор через ${RETRY_MS / 1000} с`, error);
        setTimeout(() => {
          mongoose.disconnect().catch(() => undefined).finally(connect);
        }, RETRY_MS);
      });
  };

  connect();
}

export function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}
