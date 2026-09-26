import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set — check your .env file');

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri);
  console.log(`[mongo] connected -> ${mongoose.connection.name}`);

  mongoose.connection.on('error', (err) => console.error('[mongo] connection error:', err));
  mongoose.connection.on('disconnected', () => console.warn('[mongo] disconnected'));
}
