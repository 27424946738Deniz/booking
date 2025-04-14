require('dotenv').config();
const { disconnectDatabase, prisma } = require('./data/database');
const logger = require('./utils/logger');
const { setupServer } = require('./api/server');

/**
 * Start the application
 */
async function start() {
  try {
    // Connect to the database
    try {
      await prisma.$connect();
      logger.info('Database connection successful');
    } catch (dbError) {
      logger.error(`Database connection failed: ${dbError.message}`);
      process.exit(1);
    }
    
    // Setup and start the API server
    const app = setupServer();
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
      logger.info(`API server started on port ${PORT}`);
      logger.info(`Swagger documentation available at: http://localhost:${PORT}/swagger`);
    });
    
  } catch (error) {
    logger.error(`Application error: ${error.message}`);
    process.exit(1);
  }
}

// Start the application
start();

// Handle shutdown signals
process.on('SIGINT', async () => {
  logger.info('Application shutting down...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Application shutting down...');
  await disconnectDatabase();
  process.exit(0); 
});
