# Universal one-product Shopify store (Dani's template, v2 2026-10-03)

The same store as Skynap and JollyLight, for any product. The homepage IS the product page.
Built on top of Shopify's free Horizon theme, so it drops into any new store. The playbook for
Claude is the `shopify-store-build` skill; say "build the store for <product>" in the product chat.

## What the page has

- Buy box: square swipe gallery (images AND autoplay videos), 4-thumb strip, title + "N ordered in 24h" pill,
  price + SAVE badge, 3 icon benefits, 1/2/3 bundle cards with gift strips, color swatches (only when the
  product has several variants), add-ons with sticker icons, deadline bar ("Order by Dec 8 for Christmas
  delivery") or stock bar, Add to cart, payment badges, Ordered / Ships / Delivered timeline, guarantee bar.
- Cart drawer with qty steppers, upsell card, free shipping banner, Secure checkout.
- Mobile sticky Add to cart bar (appears once the main button scrolls away).
- Top marquee offer bar, trust chips, 4 Facebook posts, "Seen on your feed" UGC videos, comparison table,
  10 reviews with photos, FAQ, 50% spin wheel, dark footer with policies and newsletter.
- One accent colour for everything; every tint is calculated from it. Fonts Baloo 2 + Nunito.

## Files

- `store.example.json`  every product-specific thing in one file (filled with JollyLight as the example).
- `build_store.py`      turns a store.json into finished theme files (`out/`).
- `theme/`              the master theme source. Never edit per product.
- `examples/`           admin checklists with policy texts (Skynap, JollyLight) and the Skynap page template.

## New store, step by step (Claude does all of this in the product chat)

1. Dani: create the Shopify store, connect it to the Shopify connector. Tell Claude: product, supplier cost
   (USD), variants/sizes, accent colour if any, competitor page for content.
2. Price: cost / 0.30, rounded to .95 (CAD), compare-at = 2x. Tiers: 2x = 2*price*0.89, 3x = 3*price*0.78.
3. Images (Higgsfield nano_banana_pro, logo as a reference): branded hero first, 3 steps, in the box,
   use-case, before/after, lifestyle, packshot; sn-avatar-1..6, sn-rev-1..6 (proper product use only),
   sn-ugc-1..4 (9:16), sn-icon-ship / sn-icon-warranty stickers, upsell image.
4. Shopify: product (ACTIVE, published to Online Store), add-ons `shipping-protection` + `30-day-warranty`
   (no shipping required) + upsell product, two automatic bundle discounts (min qty 2 and 3, scoped to the
   product), free insured shipping (Canada + Worldwide), images + videos to Content > Files with the exact
   names above, 1 product video as gallery item 2 (staged upload; pick a clip where the product visibly works).
5. Copy `store.example.json` to `<Product>/08 Store & Admin/Shopify design/store.json`, fill it, then:
   `python3 ~/Documents/UGC\ Products/_Store\ Template/build_store.py store.json`
   It prints `problems: none` when no Skynap leftovers or unknown icons remain.
6. Duplicate the live theme ("<Brand> v1 draft <date>"), upload `out/` via themeFilesUpsert:
   assets + sections FIRST, then templates + header/footer groups. Read every file back to confirm.
7. Dani: preview, publish, paste policies (examples/), logo in Customize > Header, payments, markets,
   remove password.

Icons available: check, breath, pouch, moon, truck, shield, plane, badge, phone, spark, plug, snow, gift,
heart, star, leaf, clock, bolt, drop, paw.

Deadline bar: `deadline_date` "YYYY-MM-DD" + `deadline_text`; leave the date empty for the stock bar.

Reference builds: Travel Pillow (Skynap, x9cefb-it.myshopify.com) and PatioLume (JollyLight,
466wqt-d1.myshopify.com). Their CLAUDE.md files hold the full revision history.
