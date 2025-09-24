# 🚀 Grub API - Vercel Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Grub Food Distribution Management API to Vercel through GitHub integration.

## Prerequisites

- [x] GitHub account with repository access
- [x] Vercel account (free tier available)
- [x] Firebase project with Firestore enabled
- [x] All required environment variables ready

## 📋 Pre-Deployment Checklist

### ✅ Project Configuration
- [x] `vercel.json` configuration file created
- [x] `package.json` optimized for Vercel deployment
- [x] TypeScript configuration optimized for serverless
- [x] Build process tested locally
- [x] Environment variables template (`.env.example`) created

### ✅ Required Environment Variables
Ensure you have all these values ready:

**Required:**
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `JWT_SECRET` (minimum 32 characters)

**Optional but Recommended:**
- `FLIP_SECRET_KEY` (for payments)
- `FLIP_VALIDATION_TOKEN` (for payments)
- `EMAIL_*` variables (for notifications)

## 🚀 Deployment Steps

### Step 1: Prepare Your Repository

1. **Commit all changes to GitHub:**
   ```bash
   git add .
   git commit -m "feat: configure project for Vercel deployment"
   git push origin main
   ```

2. **Verify your repository structure:**
   ```
   grub/
   ├── src/                 # Source code
   ├── dist/               # Build output (auto-generated)
   ├── package.json        # Dependencies and scripts
   ├── tsconfig.json       # TypeScript configuration
   ├── vercel.json         # Vercel configuration
   ├── .env.example        # Environment variables template
   └── README.md
   ```

### Step 2: Connect to Vercel

1. **Go to Vercel Dashboard:**
   - Visit [vercel.com](https://vercel.com)
   - Sign in with your GitHub account

2. **Import Your Project:**
   - Click "New Project"
   - Select "Import Git Repository"
   - Choose your `grub` repository
   - Click "Import"

### Step 3: Configure Build Settings

Vercel should automatically detect the configuration from `vercel.json`, but verify:

- **Framework Preset:** Other
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm ci`

### Step 4: Set Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add each required variable:

```env
# Production Environment Variables
NODE_ENV=production
PORT=8520

# Firebase Configuration
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
JWT_EXPIRES_IN=1d

# API URLs (update after first deployment)
API_BASE_URL=https://your-project-name.vercel.app
FRONTEND_URL=https://your-frontend-domain.com

# Payment Gateway (Optional)
FLIP_SECRET_KEY=your-flip-secret-key
FLIP_VALIDATION_TOKEN=your-flip-validation-token

# Rate Limiting
DEVICE_RATE_LIMIT_ENABLED=true
DEVICE_RATE_LIMIT_REQUIRE_DEVICE_ID=false
DEVICE_RATE_LIMIT_FALLBACK_TO_IP=true
DEVICE_RATE_LIMIT_WINDOW_MS=900000
DEVICE_RATE_LIMIT_MAX_REQUESTS=100

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=Grub Distributor
```

**Important Notes:**
- For `FIREBASE_PRIVATE_KEY`: Paste the entire key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
- Use actual newlines, not `\n` in Vercel environment variables
- Generate a strong `JWT_SECRET` using: `openssl rand -base64 64`

### Step 5: Deploy

1. **Trigger Deployment:**
   - Click "Deploy" in Vercel dashboard
   - Or push changes to your main branch for automatic deployment

2. **Monitor Deployment:**
   - Watch the build logs in Vercel dashboard
   - Deployment typically takes 2-5 minutes

### Step 6: Update API URLs

After successful deployment:

1. **Get your deployment URL** (e.g., `https://grub-api-xyz.vercel.app`)
2. **Update environment variables:**
   - Set `API_BASE_URL` to your Vercel deployment URL
   - Update `FRONTEND_URL` if you have a frontend

3. **Redeploy** to apply the updated environment variables

## 🧪 Testing Your Deployment

### Health Check
```bash
curl https://your-project-name.vercel.app/health
```

Expected response:
```json
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### API Documentation
Visit: `https://your-project-name.vercel.app/api/docs`

### Test Authentication
```bash
curl -X POST https://your-project-name.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

## 🔧 Troubleshooting

### Common Issues

1. **Build Failures:**
   - Check build logs in Vercel dashboard
   - Ensure all dependencies are in `package.json`
   - Verify TypeScript compilation locally

2. **Environment Variable Issues:**
   - Double-check variable names (case-sensitive)
   - Ensure Firebase private key has proper formatting
   - Verify JWT_SECRET length (minimum 32 characters)

3. **Firebase Connection Issues:**
   - Verify Firebase project ID
   - Check service account permissions
   - Ensure Firestore is enabled

4. **Rate Limiting Issues:**
   - Check device rate limiting configuration
   - Verify IP extraction in serverless environment

### Debug Commands

```bash
# Test build locally
npm run build

# Check environment variables
npm run dev

# Run tests
npm test
```

## 🔄 Continuous Deployment

Once configured, your API will automatically redeploy when you push to the main branch:

```bash
git add .
git commit -m "feat: add new feature"
git push origin main
```

## 📊 Monitoring

- **Vercel Dashboard:** Monitor deployments, functions, and analytics
- **Logs:** View real-time function logs in Vercel dashboard
- **Performance:** Monitor response times and error rates

## 🔒 Security Considerations

- ✅ Environment variables are encrypted in Vercel
- ✅ HTTPS is enforced by default
- ✅ Rate limiting is configured
- ✅ CORS is properly configured
- ✅ Input validation is implemented

## 📞 Support

If you encounter issues:
1. Check Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
2. Review build logs in Vercel dashboard
3. Test locally first: `npm run build && npm start`

---

**🎉 Congratulations!** Your Grub API is now deployed and ready for production use on Vercel!
