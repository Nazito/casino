import mongoose from 'mongoose';

export function connectDb(uri: string | undefined): Promise<void> {
  if (!uri) {
    console.warn('MONGODB_URI не задан. Нужна строка удалённого кластера MongoDB в server/.env.');
    return Promise.resolve();
  }

  return mongoose.connect(uri).then(() => {
    console.log('MongoDB подключена');
  });
}

export function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}
