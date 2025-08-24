# Device-Based Rate Limiting Implementation

## Overview
The Grub distributor API now implements advanced device-based rate limiting instead of traditional IP-based limiting. This provides more accurate tracking of individual devices and prevents issues with shared IP addresses or frequently changing IPs.

## Key Features

### 🔧 **Device ID Tracking**
- Uses unique device identifiers instead of IP addresses
- Supports multiple device ID header formats
- Validates device IDs for security and format compliance
- Generates secure device fingerprints as fallback

### 🛡️ **Security Enhancements**
- Device ID validation prevents spoofing attempts
- Detects and blocks suspicious patterns
- Platform-specific validation rules
- Secure fallback mechanisms

### ⚙️ **Flexible Configuration**
- Environment-based configuration
- Optional device ID requirement
- IP fallback for legacy clients
- Configurable rate limits per device

### 📊 **Advanced Monitoring**
- Comprehensive logging and tracking
- Device information extraction
- Rate limit status endpoints
- Admin controls for device management

## Configuration

### Environment Variables

```env
# Device-based Rate Limiting
DEVICE_RATE_LIMIT_ENABLED=true
DEVICE_RATE_LIMIT_REQUIRE_DEVICE_ID=false
DEVICE_RATE_LIMIT_FALLBACK_TO_IP=true
DEVICE_RATE_LIMIT_WINDOW_MS=900000
DEVICE_RATE_LIMIT_MAX_REQUESTS=100
```

### Configuration Options

| Variable | Default | Description |
|----------|---------|-------------|
| `DEVICE_RATE_LIMIT_ENABLED` | `true` | Enable device-based rate limiting |
| `DEVICE_RATE_LIMIT_REQUIRE_DEVICE_ID` | `false` | Require valid device ID in headers |
| `DEVICE_RATE_LIMIT_FALLBACK_TO_IP` | `true` | Fall back to IP-based limiting if no device ID |
| `DEVICE_RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in milliseconds (15 minutes) |
| `DEVICE_RATE_LIMIT_MAX_REQUESTS` | `100` | Maximum requests per window per device |

## Device ID Headers

The system accepts device IDs from multiple header formats:

- `X-Device-ID` (recommended)
- `Device-ID`
- `X-Client-ID`
- `Client-ID`

### Example Request
```bash
curl -H "X-Device-ID: abc123-def456-ghi789" \
     -H "Content-Type: application/json" \
     https://api.example.com/api/products
```

## Device ID Requirements

### Valid Format
- Length: 8-128 characters
- Characters: Alphanumeric, hyphens, underscores, dots
- No obvious patterns (test, fake, repeated characters)
- Platform-specific validation when possible

### Examples
```
✅ Valid:   abc123-def456-ghi789
✅ Valid:   550e8400-e29b-41d4-a716-446655440000
✅ Valid:   device_12345_mobile_app
✅ Valid:   client.web.2024.001

❌ Invalid: test
❌ Invalid: 11111111
❌ Invalid: fake-device
❌ Invalid: null
```

## API Endpoints

### Device Management

#### Generate Device ID
```
GET /api/device/generate
```
Generates a cryptographically secure device ID for client applications.

**Response:**
```json
{
  "success": true,
  "message": "Device ID generated successfully",
  "data": {
    "deviceId": "1a2b3c4d-5e6f7g8h9i0j",
    "instructions": {
      "usage": "Include this device ID in the X-Device-ID header for all API requests",
      "headers": ["X-Device-ID", "Device-ID", "X-Client-ID"],
      "example": "curl -H \"X-Device-ID: 1a2b3c4d-5e6f7g8h9i0j\" https://api.example.com/endpoint"
    }
  }
}
```

#### Validate Device ID
```
POST /api/device/validate
Content-Type: application/json

{
  "deviceId": "your-device-id"
}
```

#### Get Device Information
```
GET /api/device/info
X-Device-ID: your-device-id
```

#### Get Rate Limit Status
```
GET /api/device/rate-limit
X-Device-ID: your-device-id
```

#### Reset Device Rate Limit (Admin Only)
```
POST /api/device/{deviceId}/reset-rate-limit
Authorization: Bearer {admin-token}
```

## Rate Limiting Behavior

### Device ID Present & Valid
- Uses device ID as primary tracking key
- Applies configured rate limits per device
- Sets appropriate rate limit headers

### Device ID Missing/Invalid
- **Require Device ID = false**: Falls back to IP or fingerprint
- **Require Device ID = true**: Returns 400 error
- **Fallback to IP = true**: Uses IP-based limiting
- **Fallback to IP = false**: Uses device fingerprint

### Device Fingerprinting
When device ID is unavailable, the system generates a fingerprint based on:
- User-Agent string
- Accept-Language header
- Accept-Encoding header
- Accept header
- Client IP address
- Browser security headers

## Response Headers

All responses include rate limiting information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 900000
```

## Error Responses

### Rate Limit Exceeded
```json
{
  "success": false,
  "message": "Too many requests from this device, please try again later.",
  "rateLimitInfo": {
    "limit": 100,
    "remaining": 0,
    "resetTime": "2024-01-15T10:30:00.000Z",
    "retryAfter": 300
  },
  "timestamp": "2024-01-15T10:15:00.000Z"
}
```

### Device ID Required
```json
{
  "success": false,
  "message": "Device ID is required. Please include a valid device ID in the request headers.",
  "requiredHeaders": ["x-device-id", "device-id", "x-client-id"],
  "timestamp": "2024-01-15T10:15:00.000Z"
}
```

## Client Implementation

### Web Applications
```javascript
// Generate and store device ID
const deviceId = await fetch('/api/device/generate')
  .then(r => r.json())
  .then(data => data.data.deviceId);

localStorage.setItem('deviceId', deviceId);

// Use in API calls
fetch('/api/products', {
  headers: {
    'X-Device-ID': localStorage.getItem('deviceId'),
    'Content-Type': 'application/json'
  }
});
```

### Mobile Applications
```javascript
// React Native / Expo
import * as Application from 'expo-application';

const deviceId = Application.androidId || 
                 await Application.getIosIdForVendorAsync() ||
                 'fallback-device-id';

// Use in API calls
fetch('/api/products', {
  headers: {
    'X-Device-ID': deviceId,
    'Content-Type': 'application/json'
  }
});
```

### Node.js Applications
```javascript
const crypto = require('crypto');

// Generate persistent device ID
const deviceId = crypto.randomBytes(16).toString('hex');

// Store in environment or config
process.env.DEVICE_ID = deviceId;

// Use in API calls
const response = await fetch('/api/products', {
  headers: {
    'X-Device-ID': process.env.DEVICE_ID,
    'Content-Type': 'application/json'
  }
});
```

## Security Considerations

### Device ID Validation
- Prevents injection attacks
- Blocks obvious spoofing attempts
- Validates format and length
- Platform-specific checks when possible

### Privacy Protection
- Device fingerprints are hashed
- Partial fingerprints in responses
- No storage of sensitive device information
- Automatic cleanup of expired entries

### Anti-Spoofing Measures
- Pattern detection for fake IDs
- Consistency checks with User-Agent
- Rate limiting on validation attempts
- Logging of suspicious activity

## Monitoring and Logging

### Log Events
- Device ID validation attempts
- Rate limit violations
- Fallback to IP/fingerprint
- Admin rate limit resets
- Suspicious device activity

### Metrics Tracked
- Requests per device
- Rate limit hit rates
- Device ID validation success rates
- Fallback mechanism usage
- Geographic distribution of devices

## Migration from IP-Based Limiting

### Gradual Migration
1. Enable device-based limiting with IP fallback
2. Monitor adoption rates and error rates
3. Gradually increase device ID requirements
4. Eventually disable IP fallback for full device tracking

### Backward Compatibility
- IP fallback ensures existing clients continue working
- Graceful degradation for clients without device IDs
- Clear error messages guide client updates
- Documentation and examples for implementation

## Best Practices

### For API Clients
1. Generate and persist device IDs
2. Include device ID in all API requests
3. Handle rate limit responses gracefully
4. Implement retry logic with exponential backoff
5. Monitor rate limit headers

### For API Administrators
1. Monitor device registration patterns
2. Set appropriate rate limits for your use case
3. Use admin endpoints to manage problematic devices
4. Regularly review rate limiting logs
5. Adjust configuration based on usage patterns

## Troubleshooting

### Common Issues
1. **High rate limit violations**: Check if clients are sharing device IDs
2. **Missing device IDs**: Ensure clients implement device ID generation
3. **Invalid device IDs**: Validate client-side device ID generation
4. **Fingerprint collisions**: Consider requiring device IDs for high-traffic scenarios

### Debug Endpoints
- `GET /api/device/info` - Check device detection
- `GET /api/device/rate-limit` - Check current limits
- `POST /api/device/validate` - Validate device ID format
