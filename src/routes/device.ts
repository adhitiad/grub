import { Router } from 'express';
import {
  generateDeviceId,
  validateDevice,
  getDeviceInfo,
  resetDeviceRateLimit,
  getDeviceRateLimit
} from '../controllers/device.controller';
import { protect, authorize } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/device/generate
 * @desc    Generate a new secure device ID
 * @access  Public
 */
router.get('/generate', generateDeviceId);

/**
 * @route   POST /api/device/validate
 * @desc    Validate a device ID
 * @access  Public
 */
router.post('/validate', validateDevice);

/**
 * @route   GET /api/device/info
 * @desc    Get device information from request headers
 * @access  Public
 */
router.get('/info', getDeviceInfo);

/**
 * @route   GET /api/device/rate-limit
 * @desc    Get current device rate limit status
 * @access  Public
 */
router.get('/rate-limit', getDeviceRateLimit);

/**
 * @route   POST /api/device/:deviceId/reset-rate-limit
 * @desc    Reset rate limit for a specific device
 * @access  Admin/Owner only
 */
router.post('/:deviceId/reset-rate-limit', protect, authorize('admin', 'owner'), resetDeviceRateLimit);

export default router;
