# Pleenty Grocery Delivery

Next.js grocery-delivery MVP with a storefront, basket, checkout, and admin dashboard.

## Stack
- Next.js App Router + TypeScript
- Supabase PostgreSQL accessed through Prisma
- Client-side basket persistence
- Vercel deployment
- Admin dashboard at `/admin`

## Required environment variables

Copy `.env.example` to `.env.local` for local development, then configure the same variables in **Vercel → Project Settings → Environment Variables** for Production, Preview, and Development as needed.

- `DATABASE_URL`: Supabase PostgreSQL connection URI (include the database password; use the connection details shown in Supabase Project Settings → Database).
- `ADMIN_ACCESS_KEY`: a long, random secret used by the MVP admin gate.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: reserved for the Supabase client integration.

Do not commit real environment values or expose database passwords/service-role keys in browser code. The current Vercel project has no environment variables configured, so database-backed catalogue, admin, and checkout features will not work until these are added.

## Database

The Prisma models map to the existing Supabase tables and column names (`categories`, `products`, `orders`, and `order_items`). Generate the client with:

```bash
npm install
npx prisma generate
npm run dev
```

The seed script inserts or updates the demo categories and products. Run it only after `DATABASE_URL` points to the intended database:

```bash
npx prisma db seed
```

**Do not run `prisma db push` against the existing Supabase project.** The project already has tables and security policies; schema changes should be reviewed and applied through a deliberate migration.

## Admin

Open `/admin` and enter the value configured as `ADMIN_ACCESS_KEY`. This is an MVP access gate, not a replacement for Supabase Auth and role-based authorization. Before allowing multiple staff members or handling real customer orders, replace it with Supabase Auth and server-side role checks.

## Known MVP limits

- Storefront display data is currently a curated static list; the checkout validates product slugs and prices against the database.
- Payment-provider integration, live courier tracking, notifications, and delivery maps are not implemented.
- Do not accept real payments or rely on the demo tracking timeline until those integrations are completed and tested.
