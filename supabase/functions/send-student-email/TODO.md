# Fix Email Sending (HTTP 401 Gmail SMTP)

## Steps:
- [x] Step 1: Add Deno SMTP library to deno.json
- [x] Step 2: Rewrite index.ts with proper SMTP client (smtp.gmail.com:587, STARTTLS)
- [x] Step 3: Update README.md with Gmail env vars
- [x] Step 4: Remove unused Resend/Gmail fetch code
- [ ] Step 5: Deploy: supabase functions deploy send-student-email
- [ ] Step 6: Test locally: deno task start, curl POST
- [ ] Step 7: Update callers if needed (e.g. dashboard.js)

