import mongoose from 'mongoose';

export function connectDb(uri: string | undefined): Promise<void> {
  if (!uri) {
    console.warn('MONGODB_URI не задан. Кошелёк отвечает 503, пока база не подключена.');
    return Promise.resolve();
  }

  return mongoose.connect(uri).then(() => {
    console.log('MongoDB подключена');
  });
}

export function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}
