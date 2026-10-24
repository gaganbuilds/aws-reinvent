# AWS re:Invent Party, Mysore: event site

Next.js 15 + Tailwind + Supabase (email OTP, Postgres, RLS). Built on the stack of the `collegestudy` admin dashboard.

## Pages
- `/` landing page with full-screen video hero, highlights, how it works, agenda, FAQ
- `/register` event info + email OTP + application form (name, Builder ID, college)
- `/status` applicant status (Pending / Accepted / Rejected); WhatsApp link only when Accepted
- `/admin` moderator dashboard: filter, search, Accept / Reject, CSV export

## 1. Run locally
```bash
npm install
cp .env.example .env.local     # fill in Supabase URL + anon key
npm run dev
```

## 2. Connect Supabase (about 10 minutes)
1. Create a free project at supabase.com.
2. **Project Settings > API**: copy the Project URL and `anon` key into `.env.local`.
3. **SQL Editor**: paste `supabase/schema.sql` and Run. This creates tables, RLS policies and the helper functions.
4. **Authentication > Providers > Email**: enable it. Turn "Confirm email" off or on as you like.
5. **Authentication > Email Templates > Magic Link**: make sure the body includes the code, e.g. `Your code is {{ .Token }}`. The site asks for this code.
6. **Authentication > URL Configuration**: set Site URL to your deployed URL.
7. Make yourself staff: sign in once on `/register`, then in SQL Editor run
   `insert into user_roles (user_id, role) select id, 'admin' from auth.users where email = 'YOU@example.com';`
8. Set the WhatsApp link: Table Editor > `event_settings` > `whatsapp_group_url`.
   Set `applications_open` to false to close registration.

## 3. Emails that actually arrive
Supabase's built-in sender is limited to a few emails per hour. Before launch:
**Authentication > SMTP Settings** and add your own SMTP (Resend, Brevo, or Gmail app password). Verify your sender domain.

## 4. Hero video
Put your video at `public/videos/hero.mp4` (short, muted loop, under about 10 MB, 1080p) or set
`NEXT_PUBLIC_HERO_VIDEO_URL` to a hosted file. Use the video from your AWS organiser kit so you have usage rights.
If the file is missing, the dark gradient shows instead.

## 5. Edit the content
Everything shown on the site (date, venue, organiser, highlights, agenda, FAQ) is in `lib/config.ts`. Search for `TODO`.

## 6. Deploy
Push to GitHub, import into Vercel, add the same env vars. Done.

## Not included (v2)
Bulk acceptance/rejection emails, audit-log UI, CMS tables for sections/speakers/sponsors. The CSV export lets you email accepted people manually for day one.
