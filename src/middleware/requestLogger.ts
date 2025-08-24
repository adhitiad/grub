import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Extend Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  logger.apiRequest(
    req.method,
    req.path,
    req.user?.id,
    req.requestId
  );

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.apiResponse(
      req.method,
      req.path,
      res.statusCode,
      duration,
      req.user?.id,
      req.requestId
    );

    return originalJson.call(this, body);
  };

  // Override res.send to log response
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - (req.startTime || 0);
    
    logger.apiResponse(
      req.method,
      req.path,
      res.statusCode,
      duration,
      req.user?.id,
      req.requestId
    );

    return originalSend.call(this, body);
  };

  next();
};
