// logger.js - Winston Logger with Grafana Loki Integration
const winston = require('winston');
const LokiTransport = require('winston-loki');

// Environment variables
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if exists
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    
    return msg;
  })
);

// Console format for development (colored)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let msg = `${timestamp} ${level}: ${message}`;
    
    if (Object.keys(metadata).length > 0 && metadata.stack) {
      msg += `\n${metadata.stack}`;
    }
    
    return msg;
  })
);

// Create Winston logger
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { 
    service: 'coursease-backend',
    environment: NODE_ENV 
  },
  transports: [
    // Console transport (always active)
    new winston.transports.Console({
      format: consoleFormat,
      level: NODE_ENV === 'production' ? 'info' : 'debug'
    }),

    // File transports for errors and combined logs
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add Loki transport if credentials are provided
if (process.env.LOKI_HOST && process.env.LOKI_USERNAME && process.env.LOKI_PASSWORD) {
  try {
    logger.add(new LokiTransport({
      host: process.env.LOKI_HOST,
      basicAuth: `${process.env.LOKI_USERNAME}:${process.env.LOKI_PASSWORD}`,
      labels: { 
        job: 'coursease-backend',
        environment: NODE_ENV
      },
      json: true,
      format: winston.format.json(),
      replaceTimestamp: true,
      onConnectionError: (err) => {
        console.error('❌ Loki connection error:', err.message);
      },
      // Batch logs and retry on failure
      batching: true,
      interval: 5,
      timeout: 30000
    }));
    
    console.log('✅ Loki transport enabled');
    console.log(`📡 Loki Host: ${process.env.LOKI_HOST}`);
    console.log(`👤 Loki User: ${process.env.LOKI_USERNAME}`);
  } catch (err) {
    console.error('❌ Failed to add Loki transport:', err.message);
  }
} else {
  console.warn('⚠️ Loki transport disabled (missing credentials in .env)');
}

// Add request ID to logs
logger.addRequestId = (req, res, next) => {
  req.id = Math.random().toString(36).substring(7);
  req.logger = logger.child({ requestId: req.id });
  next();
};

// Export logger
module.exports = logger;
