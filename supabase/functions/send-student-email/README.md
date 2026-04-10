# Supabase Edge Function: Send Student Email

## Local Development

1. Install Deno VSCode extension
2. Reload VSCode window (Ctrl+Shift+P > Developer: Reload Window)
3. Run:
```
cd supabase/functions/send-student-email
deno task start
```

## Deploy
```
supabase functions deploy send-student-email
```

## Required Environment Variables
```
SUPABASE_URL=your_project_url
SUPABASE_ANON_KEY=your_anon_key  
RESEND_API_KEY=your_resend_key
FROM_EMAIL=noreply@yourdomain.com
```

**TS errors should now be resolved via deno.json + VSCode Deno settings.**

