# DataForSEO Setup Guide

## Environment Variables

Add the following to your `.env.local` file:

```
DATAFORSEO_LOGIN=your_dataforseo_login
DATAFORSEO_PASSWORD=your_dataforseo_password
```

## Getting DataForSEO Credentials

1. Sign up at https://app.dataforseo.com/register/
2. Navigate to Settings > API Access
3. Copy your Login (email) and Password
4. Paste them into your `.env.local` file

## Free Trial

DataForSEO offers a free trial with $1 in credits. This is enough to test the Product Price Monitor tool with several searches.

## API Costs

- Google Shopping Products: ~$0.0006 per task
- Google Shopping Sellers: ~$0.0008 per task
- See full pricing: https://dataforseo.com/pricing/merchant/google-shopping-api

## Testing

After adding your credentials, restart your development server:

```bash
npm run dev
```

Then visit `/tools/product-price-monitor` to test the tool.
