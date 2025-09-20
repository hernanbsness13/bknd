# RespondeYA - Backend (Webhook + IA)

## Overview
Minimal Node.js Express backend that receives WhatsApp Cloud webhooks, calls OpenAI for replies and sends messages back via WhatsApp Cloud API. Persists messages to Supabase (optional).

## Files
- index.js            # main server
- package.json        # npm config
- .env.example        # example env vars

## Env variables
Copy `.env.example` to `.env` and fill values:
- WHATSAPP_TOKEN: Meta WhatsApp token (Page access token)
- WHATSAPP_PHONE_ID: Phone Number ID from Meta (used in messages endpoint)
- WHATSAPP_VERIFY_TOKEN: random string for webhook verification
- OPENAI_API_KEY: OpenAI API key
- SUPABASE_URL, SUPABASE_KEY: optional, for persisting messages
- PORT: optional port

## Run locally (for testing)
1. Install deps: `npm install`
2. Start server: `npm start`
3. Expose with ngrok: `ngrok http 3000`
4. In Meta App -> WhatsApp -> Webhooks: set callback URL to `https://<ngrok-id>.ngrok.io/webhook` and verify with your WHATSAPP_VERIFY_TOKEN.

## Deploy
- Recommended providers: Render, Railway, Fly.io or Heroku.
- On render, create a new web service, set build/start commands to `npm install` and `npm start`, and set environment variables.

## Notes
- This is an MVP scaffold. Add authentication, logging and rate limits for production.
