const express = require('express');
const { prisma } = require('../../data/database');
const router = express.Router();

/**
 * Health check endpoint with database connection verification
 */
router.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      api: 'ok',
      database: 'unknown'
    }
  };

  try {
    // Check database connection with a simple query
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'ok';
  } catch (error) {
    health.status = 'error';
    health.services.database = 'error';
    health.error = {
      database: error.message
    };
  }

  // Return 200 if everything is ok, 503 if there are issues
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router; 