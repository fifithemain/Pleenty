# Freshcart Specials Importer

Standalone Next.js internal tool for turning grocery store flyers into Freshcart weekly specials.

## Included workflow
- Upload JPG/PNG/WEBP images and PDFs.
- AI vision extraction through the OpenAI Responses API.
- Product name, brand, description, advertised cost, unit and catalogue extraction.
- Duplicate/featured detection.
- Automatic catalogue assignment.
- Default 40% markup on food: selling price = advertised cost x 1.40.
- Household items default to 0% markup.
- Review-before-publish workflow.
- Normalized image bounding boxes are requested for future product-image cropping.
- Designed to be hosted as its own Vercel project using specials-importer as Root Directory.

## Vercel
Set Root Directory to specials-importer and add:
- OPENAI_API_KEY
- optional OPENAI_MODEL

The app does not publish products automatically. Connect the review/approve action to Freshcart's catalogue database next.

## Pricing
A 40% markup is applied to food. Example: R69.00 cost -> R96.60 selling price. This is a markup, not a 40% gross margin.

Never expose OPENAI_API_KEY to the browser.
