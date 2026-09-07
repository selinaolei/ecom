# Dear Paws – Shopify theme draft (Horizon)

Theme files for the "Dear Paws - Petalia Style Draft" theme on dearpaws.shop.
Layout mirrors the Petalia advent-calendar product page, restyled in forest green (#1F3D2B) and gold (#C9A96E).

## What is here

| Path | Purpose |
| --- | --- |
| `sections/dp-product-main.liquid` | Product hero: gallery, rating, price, feature list, variant pills, Single/Duo/Trio bundle, add-on toggles (shipping protection, 30-day warranty, mystery box), add to cart, payment icons, trust strip, sticky mobile bar |
| `sections/dp-ugc-grid.liquid` | "People keep posting about Dear Paws" photo grid on a forest green band |
| `sections/dp-comparison.liquid` | "Regular dog toys vs Dear Paws" comparison table |
| `sections/dp-reviews.liquid` | Rating summary with star bars and a photo review masonry |
| `sections/dp-faq.liquid` | FAQ accordion (details/summary, no JS) |
| `sections/header-group.json` | Forest green announcement marquee + centered logo header |
| `sections/footer-group.json` | Forest green footer with logo, tagline, newsletter, policies |
| `templates/product.json` | Product page section order and content |
| `config/settings_data.json` | Theme palette (forest green foreground, gold sale badge) |
| `assets/dp-product.js` | Bundle / add-on / gallery / add-to-cart logic (works with Horizon cart drawer) |
| `assets/dp-addon-*.svg|png` | Add-on artwork |

## Deploying

Files are pushed to the unpublished theme with the Admin GraphQL `themeFilesUpsert` mutation.
Preview it from Online Store > Themes > "Dear Paws - Petalia Style Draft" > Customize.

## Bundle pricing note

The Duo / Trio discount percentages in the product hero are display values.
Create a matching automatic discount (Buy 2 save 15%, Buy 3 save 25%) in Shopify Admin > Discounts so the same price applies at checkout.
