# Vercel Account Migration Guide

## Step 1: Prepare for Vercel Deployment

### Update package.json build script
Make sure your build script outputs to the correct directory:

```json
{
  "scripts": {
    "build": "ng build --configuration=production"
  }
}
```

## Step 2: Vercel Account Setup

### Option A: Deploy with New Vercel Account (Recommended)

1. **Create New Vercel Account**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your new account
   - Connect your GitHub/GitLab/Bitbucket account

2. **Deploy from Git**:
   - Push your code to a Git repository
   - Import project in Vercel dashboard
   - Vercel will auto-detect Angular and configure build settings

3. **Configure Environment Variables**:
   - In Vercel dashboard → Settings → Environment Variables
   - Add your Supabase credentials:
     - `SUPABASE_URL` = Your new Supabase project URL
     - `SUPABASE_ANON_KEY` = Your new Supabase anon key

### Option B: Use Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm install -g vercel
   ```

2. **Login to New Account**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

## Step 3: Configure Build Settings

Vercel should auto-detect these settings, but verify:

- **Framework Preset**: Angular
- **Build Command**: `ng build --configuration=production`
- **Output Directory**: `dist/dyad-angular-template`
- **Install Command**: `npm install`

## Step 4: Environment Variables for Production

Set these in Vercel dashboard:

```
NODE_ENV=production
SUPABASE_URL=https://your-new-project.supabase.co
SUPABASE_ANON_KEY=your-new-anon-key
```

## Step 5: Domain Configuration

1. **Custom Domain** (Optional):
   - Go to Vercel dashboard → Settings → Domains
   - Add your custom domain
   - Configure DNS records as instructed

2. **HTTPS**: 
   - Automatically enabled by Vercel
   - SSL certificates auto-managed

## Step 6: Deployment Pipeline

### Automatic Deployments:
- **Production**: Deploys from `main`/`master` branch
- **Preview**: Deploys from feature branches
- **Development**: Use local development server

### Manual Deployment:
```bash
# Build locally
npm run build

# Deploy to Vercel
vercel --prod
```

## Troubleshooting Common Issues

### 1. Build Failures:
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check for TypeScript errors

### 2. Environment Variables:
- Ensure all environment variables are set in Vercel dashboard
- Restart deployment after adding new variables

### 3. Routing Issues:
- The `vercel.json` file handles SPA routing
- All routes redirect to `index.html` for client-side routing

### 4. Performance Optimization:
- Static assets are cached for 1 year
- Gzip compression enabled automatically
- CDN distribution worldwide

## Migration Checklist

- [ ] Create new Vercel account
- [ ] Push code to Git repository
- [ ] Import project in Vercel
- [ ] Configure environment variables
- [ ] Test deployment
- [ ] Configure custom domain (optional)
- [ ] Update DNS records (if using custom domain)
- [ ] Test all application features
- [ ] Update team access (if needed)

## Post-Migration Testing

1. **Functionality Test**:
   - Login/Registration
   - Dashboard loading
   - Data operations (CRUD)
   - Real-time updates

2. **Performance Test**:
   - Page load speeds
   - API response times
   - Mobile responsiveness

3. **Security Test**:
   - HTTPS configuration
   - Environment variable security
   - API endpoint protection

## Support Resources

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Angular on Vercel**: [vercel.com/guides/deploying-angular-with-vercel](https://vercel.com/guides/deploying-angular-with-vercel)
- **Supabase + Vercel**: [supabase.com/docs/guides/getting-started/tutorials/with-angular](https://supabase.com/docs/guides/getting-started/tutorials/with-angular)