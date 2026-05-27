# Fix for Production Authorization Errors

## Issues Found & Fixed

### 1. **Missing JWT_SECRET in Production (Vercel)**
- **Problem**: The 401 errors occur because `JWT_SECRET` environment variable is not set in Vercel
- **Solution**: Added validation in `server.js` to check for missing `JWT_SECRET`
- **Action Required**: Set `JWT_SECRET` in Vercel environment variables

### 2. **Model Initialization Timing**
- **Problem**: Models were being imported before fully initialized, causing "User.findByPk is not a function"
- **Solution**: Modified `authMiddleware.js` to import models at runtime instead of module load time
- **Impact**: Ensures models are ready when middleware needs them

### 3. **CORS Configuration Issues**
- **Problem**: Frontend requests weren't properly configured for credentials and cross-origin requests
- **Solution**: 
  - Updated server CORS to accept credentials and specific origins
  - Added `withCredentials: true` to axios instance
  - Added response interceptor to handle 401 errors

## Required Vercel Environment Variables

Set these in your Vercel project settings:

```
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your-very-long-random-secret-key-here
NODE_ENV=production
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click "Settings" → "Environment Variables"
3. Add the following variables:
   - `DATABASE_URL` (from your Supabase dashboard)
   - `JWT_SECRET` (generate a strong random string, e.g., using `openssl rand -base64 32`)

## Testing Locally

Before deploying to Vercel, test locally:

```bash
# Ensure .env file in backend/ has:
# DATABASE_URL=your_local_or_supabase_db
# JWT_SECRET=test-secret-key

# In backend directory:
npm run dev

# In frontend directory:
npm run dev
```

## Debugging Steps

If you still see 401 errors:

1. **Check Network Tab** (Browser DevTools):
   - Verify Authorization header is being sent: `Bearer <token>`
   - Check response headers for proper CORS headers

2. **Check Vercel Logs**:
   - Go to Vercel dashboard → Deployments → Function logs
   - Look for JWT validation errors

3. **Clear Browser Storage**:
   ```javascript
   localStorage.clear()
   location.reload()
   ```

4. **Verify Token is Saved**:
   - Open DevTools → Application → Local Storage
   - Check if `master_token` exists after login

## Files Modified

- `backend/server.js` - Enhanced CORS config and env validation
- `backend/middleware/authMiddleware.js` - Runtime model import
- `frontend/src/api/api.js` - Added credentials and error handling
- `backend/.env.example` - Documentation of required variables
