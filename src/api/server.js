const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

// Create route files
const healthRoutes = require('./routes/health');
const scraperRoutes = require('./routes/scraper');

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Booking Data API',
      version: '1.0.0',
      description: 'API for scraping and managing hotel data from Booking.com',
    },
    servers: [
      {
        url: '/api',
        description: 'API Server',
      },
    ],
  },
  apis: [path.join(__dirname, './documentation/*.yaml')],
};

const setupServer = () => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Setup Swagger
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Routes
  app.use('/api', healthRoutes);
  app.use('/api', scraperRoutes);

  return app;
};

module.exports = { setupServer }; 