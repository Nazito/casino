import mongoose from 'mongoose';

const RETRY_MS = 5_000;

let stopped = false;
let connectStarted = false;
let listenersAttached = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

export function connectDb(uri: string | undefined): void {
  if (stopped || connectStarted) {
    return;
  }
  if (!uri) {
    console.warn('MONGODB_URI не задан. Нужна строка удалённого кластера MongoDB в server/.env.');
    return;
  }

  connectStarted = true;
  if (!listenersAttached) {
    listenersAttached = true;
    mongoose.connection.on('disconnected', () => {
      if (!stopped) {
        console.warn('MongoDB отключена');
      }
    });
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB снова подключена');
    });
  }

  const connect = () => {
    if (stopped) {
      return;
    }
    mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10_000 })
      .then(() => {
        const { host, name } = mongoose.connection;
        console.log(`MongoDB подключена: ${host}/${name}`);
      })
      .catch(() => {
        if (stopped) {
          return;
        }
        console.error(`Не удалось подключиться к MongoDB, повтор через ${RETRY_MS / 1000} с`);
        retryTimer = setTimeout(() => {
          mongoose.disconnect().catch(() => undefined).finally(connect);
        }, RETRY_MS);
      });
  };

  connect();
}

export async function closeDb(): Promise<void> {
  stopped = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}
