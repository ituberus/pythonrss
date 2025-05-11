import mongoose from 'mongoose';
import config from './default';
import logger from '../utils/logger';

const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoURI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

export default connectDB;