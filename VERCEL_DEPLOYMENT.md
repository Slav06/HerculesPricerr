# Vercel Deployment Guide

This guide will help you deploy your HerculesPricerr dashboard to Vercel at https://pricerr.vercel.app/

## Quick Deploy

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to [vercel.com](https://vercel.com)** and sign up/sign in
2. **Click "New Project"**
3. **Import your GitHub repository**:
   - Select "Import Git Repository"
   - Choose `Slav06/HerculesPricerr` from the list
   - Click "Import"
4. **Configure your project**:
   - **Project Name**: `pricerr` (or your preferred name)
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as default)
   - **Build Command**: Leave empty (not needed for static files)
   - **Output Directory**: Leave empty (not needed for static files)
5. **Click "Deploy"**

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy from your project directory**:
   ```bash
   vercel
   ```

4. **Follow the prompts** to configure your project

## Configuration Files

The project includes these Vercel-specific files:

- **`vercel.json`**: Configuration for routing and headers
- **`index.html`**: Landing page with auto-redirect to dashboard
- **`dashboard.html`**: Main dashboard application

## Custom Domain Setup

To use your custom domain:

1. **In Vercel Dashboard**, go to your project
2. **Click "Settings" → "Domains"**
3. **Add your domain**: `pricerr.vercel.app`
4. **Configure DNS** if needed

## Environment Variables

For production, you may want to set environment variables:

1. **In Vercel Dashboard**, go to your project
2. **Click "Settings" → "Environment Variables"**
3. **Add variables**:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_ANON_KEY`: Your Supabase anon key

## Updating the Dashboard

After making changes:

1. **Commit and push** to GitHub
2. **Vercel will automatically redeploy** (if auto-deploy is enabled)
3. **Or manually redeploy** from Vercel dashboard

## Troubleshooting

### Common Issues:

1. **Build Errors**: Check that all files are committed to GitHub
2. **404 Errors**: Verify `vercel.json` routing configuration
3. **CORS Issues**: Ensure Supabase allows requests from your Vercel domain

### Performance Tips:

1. **Enable Vercel Analytics** for performance monitoring
2. **Use Vercel Edge Functions** if you need server-side logic
3. **Enable Vercel Speed Insights** for performance optimization

## Support

- **Vercel Documentation**: [vercel.com/docs](https://vercel.com/docs)
- **Vercel Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)
- **GitHub Issues**: [github.com/Slav06/HerculesPricerr/issues](https://github.com/Slav06/HerculesPricerr/issues)

## Next Steps

Once deployed:

1. **Test your dashboard** at the Vercel URL
2. **Configure Supabase** with your production credentials
3. **Set up monitoring** and analytics
4. **Customize the design** and functionality as needed
