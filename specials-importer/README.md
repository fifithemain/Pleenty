# Freshcart Specials Importer

Standalone Next.js internal tool for turning grocery store flyers into Freshcart weekly specials.

## Included workflow

- Upload JPG/PNG/WEBP images and PDFs.
- AI vision extraction through OpenRouter, using the free-model router by default.
- Product name, brand, description, advertised cost, unit and catalogue extraction.
- Automatic duplicate detection against Freshcart specials already published for the current South African week.
- Optional manual list of additional already-featured products.
- Automatic catalogue assignment.
- Default 40% markup on food: selling price = advertised cost x 1.40.
- Household items default to 0% markup.
- Review-before-publish workflow with per-product selection.
- Product-image cropping from image flyers using AI bounding boxes.
- Persistent products, weekly specials and import audit records in the existing Freshcart Supabase project.
- Cropped product images uploaded to Supabase Storage.
- Designed to be hosted using this folder as the Vercel Root Directory.

## Supabase integration

The existing Supabase project is the Pleenty project: `zknldbcttzamqhcptyqz`.

The database migration creates:

- `special_imports`
- `special_import_items`
- `product_specials`
- Freshcart catalogue categories
- `product-images` public storage bucket
- `current_published_specials` view for storefront reads

The importer uses a Supabase secret key only on the server for database writes and Storage uploads. Never expose that key in browser code or commit it to GitHub.

## Vercel

Set Root Directory to `specials-importer` and add:

- `OPENROUTER_API_KEY`
- optional `OPENROUTER_MODEL` (defaults to `openrouter/free`)
- `SUPABASE_URL=https://zknldbcttzamqhcptyqz.supabase.co`
- `SUPABASE_SECRET_KEY` (recommended current Supabase secret key)
- or legacy `SUPABASE_SERVICE_ROLE_KEY`
- `IMPORTER_ADMIN_KEY` — a private key required by the internal importer API

Never commit any of these secrets.

## Pricing

A 40% markup is applied to food. Example: R69.00 cost -> R96.60 selling price. This is a markup, not a 40% gross margin.

## Safety of publishing

The importer API is protected by `IMPORTER_ADMIN_KEY`, and the UI sends it over HTTPS for extraction/publishing. Keep it private and rotate it if exposed. The importer does not publish automatically after extraction. You must review the detected products and click **Approve & publish**. Only selected new products are written to the Freshcart catalogue.

Never expose `OPENROUTER_API_KEY` or the Supabase secret/service-role key to the browser.
