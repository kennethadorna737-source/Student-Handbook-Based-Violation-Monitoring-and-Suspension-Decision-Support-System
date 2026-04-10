# Supabase Edge Function: Send Student Email (Gmail SMTP)

## Local Development
1. Install Deno VSCode extension
2. Reload VSCode window (Ctrl+Shift+P > Developer: Reload Window)
3. Set local env vars (or .env file):
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key
   GMAIL_USER=kennethadorna737@gmail.com
   GMAIL_APP_PASSWORD=hlieofjvauksjteh
   ```
4. Run:
   ```
   cd supabase/functions/send-student-email
   deno task start
   ```

## Deploy
```
supabase functions deploy send-student-email
```
**Set env vars in Supabase dashboard > Settings > Edge Functions > send-student-email > Environment Variables**

## Required Environment Variables
```
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
```

## Test
```bash
curl -X POST http://localhost:54321/functions/v1/send-student-email \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test",
    "body": "Hello from PhilTechGMA!"
  }'
```

**Admin-only: Checks `admin_users` table or `user_metadata.role == 'admin'`. TS errors resolved via deno.json.**

