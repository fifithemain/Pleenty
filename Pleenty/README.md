# FreshCart Grocery Delivery

GitHub/Vercel-ready Next.js grocery delivery MVP based on the supplied architecture specification.

## Stack
- Next.js 14 App Router + TypeScript
- Tailwind CSS
- Zustand/local persistence for the basket
- Supabase PostgreSQL + Prisma
- Vercel deployment
- Admin dashboard at `/admin`

## GitHub → Vercel deployment
1. Create a GitHub repository and push this project.
2. Import the repository into Vercel.
3. Add `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ADMIN_ACCESS_KEY` under Vercel Environment Variables.
4. Build command: `npm run build`.
5. Deploy.

## Database
Create a Supabase PostgreSQL project, then run:
```bash
npm install
npx prisma generate
npx prisma db push
```

The existing product UI is ready for the database-backed catalogue; seed your catalogue through Prisma or the admin dashboard after categories exist.

## Admin
Open `/admin`. The MVP admin gate uses the `ADMIN_ACCESS_KEY` environment variable. This is intentionally separate from the customer storefront. For production, replace the key gate with Supabase Auth + an admin role/RLS policy before giving access to multiple staff members.

## Local development
```bash
npm install
npx prisma generate
npm run dev
```

The architecture specification calls for Supabase Auth, Realtime, Mapbox/Leaflet, PayFast/Yoco/Stripe and Resend/WhatsApp/Twilio integrations. Payment, notifications and live mapping are left behind the configured interfaces until their credentials/business rules are supplied.
