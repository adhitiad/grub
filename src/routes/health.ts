import { Router } from 'express';
import {
  healthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck
} from '../controllers/health.controller';

const router = Router();

/**
 * @route   GET /health
 * @desc    Basic health check endpoint
 * @access  Public
 */
router.get('/', healthCheck);

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with all services
 * @access  Public
 */
router.get('/detailed', detailedHealthCheck);

/**
 * @route   GET /health/ready
 * @desc    Readiness probe for Kubernetes
 * @access  Public
 */
router.get('/ready', readinessCheck);

/**
 * @route   GET /health/live
 * @desc    Liveness probe for Kubernetes
 * @access  Public
 */
router.get('/live', livenessCheck);

/**
 * @route   GET /ping
 * @desc    Simple ping endpoint
 * @access  Public
 */
router.get('/ping', (req, res) => {
  res.status(200).json({
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

/**
 * @route   GET /status
 * @desc    Alias for basic health check
 * @access  Public
 */
router.get('/status', healthCheck);

export default router;
