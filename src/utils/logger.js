const winston = require('winston');

// Winston logger yapılandırması
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'room-scraper' },
  transports: [
    // Konsol çıktısı
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}`
        )
      )
    }),
    // Dosya çıktısı
    new winston.transports.File({
      filename: 'logs/room-scraper-error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: 'logs/room-scraper.log'
    })
  ]
});

// Geliştirme ortamında daha detaylı loglama
if (process.env.NODE_ENV !== 'production') {
  logger.level = 'debug';
}

module.exports = logger; 