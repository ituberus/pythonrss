// src/server.ts
import app from './app';
import config from './config/default';
import connectDB from './config/db';
import logger from './utils/logger';
import InitService from './services/init.service';

const PORT = config.port;

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Initialize application settings and services
    await InitService.initialize();

    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Server running in ${config.nodeEnv} mode on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();