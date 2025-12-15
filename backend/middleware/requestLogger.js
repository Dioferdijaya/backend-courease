// middleware/requestLogger.js - HTTP Request Logging Middleware
const morgan = require('morgan');
const logger = require('../logger');

// Create stream object for Morgan to use Winston
const stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Custom token for response time in ms
morgan.token('response-time-ms', (req, res) => {
  if (!req._startAt || !res._startAt) {
    return '-';
  }
  
  const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
             (res._startAt[1] - req._startAt[1]) * 1e-6;
  
  return ms.toFixed(2);
});

// Custom morgan format with more details
const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time-ms ms';

// Production format (concise)
const productionFormat = ':method :url :status :response-time-ms ms';

// Determine format based on environment
const format = process.env.NODE_ENV === 'production' ? productionFormat : morganFormat;

// Create Morgan middleware
const requestLogger = morgan(format, { 
  stream,
  skip: (req, res) => {
    // Skip health check endpoints
    return req.url === '/health' || req.url === '/ping';
  }
});

// Additional request logging middleware
const logRequest = (req, res, next) => {
  // Log request start
  req._startTime = Date.now();
  
  logger.info(`Incoming ${req.method} request`, {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    requestId: req.id
  });
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - req._startTime;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    logger[logLevel](`${req.method} ${req.url} ${res.statusCode}`, {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      requestId: req.id
    });
  });
  
  next();
};

module.exports = { requestLogger, logRequest };
