#!/usr/bin/env python3
"""Universal one-product Shopify store builder (Dani's Skynap / JollyLight template).

Usage:
  python3 build_store.py store.json            -> writes <folder of store.json>/out/
  python3 build_store.py store.json --out DIR

store.json holds everything product-specific (brand, accent colour, prices, copy, reviews,
FAQ, image/video file names). See store.example.json (the JollyLight store). The theme
source in theme/ is never edited per product; this script adapts it.

out/ file names use '__' for '/', e.g. sections__<slug>-buy-box.liquid -> sections/<slug>-buy-box.liquid.
Upload order: assets + sections first, then templates + header/footer groups.
"""
import json, os, re, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'theme')

# ---------- colours: every violet-family colour in the source is mapped by role ----------
def hex2rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def rgb2hex(c):
    return '#' + ''.join(f'{max(0, min(255, round(v))):02X}' for v in c)

def mix(a, b, t):  # t=0 -> a, t=1 -> b
    return tuple(x + (y - x) * t for x, y in zip(a, b))

def palette(accent, ink):
    A, I, W, K = hex2rgb(accent), hex2rgb(ink), (255, 255, 255), (0, 0, 0)
    roles = {
        '#5B3FE0': A, '#1C1540': I, '#31239E': mix(A, K, .35), '#7A5CF0': mix(A, W, .12),
        '#8B6FF0': mix(A, W, .22), '#A99AF0': mix(A, W, .45), '#CFC8EF': mix(A, W, .74),
        '#D9D2F2': mix(A, W, .80), '#D9CEFF': mix(A, W, .80), '#E6E2F6': mix(A, W, .87),
        '#E7E1FB': mix(A, W, .88), '#EFE9FF': mix(A, W, .91), '#F1EDFD': mix(A, W, .92),
        '#EFEBFB': mix(A, W, .93), '#F6F4FE': mix(A, W, .96), '#FBFAFF': mix(A, W, .98),
        '#403966': mix(I, W, .15), '#5E5880': mix(I, W, .30), '#9C96BB': mix(I, W, .55),
        '#F3F1FA': mix(I, W, .95),
    }
    m = {k: rgb2hex(v) for k, v in roles.items()}
    m['rgba(28,21,64'] = 'rgba(%d,%d,%d' % I
    m['rgba(91,63,224'] = 'rgba(%d,%d,%d' % A
    return m

# ---------- extra icons (benefit lines, trust chips, marquee) ----------
ICONS = {
    'phone': '<path d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M11 18h2"/>',
    'spark': '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    'plug': '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0zM12 17v5"/>',
    'snow': '<path d="M12 2v20M4 7l16 10M4 17L20 7M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    'gift': '<path d="M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z"/>',
    'heart': '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21z"/>',
    'star': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    'leaf': '<path d="M5 19C5 9 11 4 20 4c0 9-5 15-15 15zM5 19l8-8"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'bolt': '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    'drop': '<path d="M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z"/>',
    'paw': '<circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="4.5" cy="13" r="1.8"/><circle cx="19.5" cy="13" r="1.8"/><path d="M12 12c-3 0-5.5 3.5-5.5 6 0 1.5 1.5 2 3 2h5c1.5 0 3-.5 3-2 0-2.5-2.5-6-5.5-6z"/>',
}
BUILTIN = ['check', 'breath', 'pouch', 'moon', 'truck', 'shield', 'plane', 'badge']

def svg(name, size, sw):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</svg>')

GIFT = svg('gift', 16, 2)

def rep(t, old, new, required=True):
    if old not in t:
        if required:
            raise SystemExit(f'template text not found: {old[:70]!r}')
        return t
    return t.replace(old, new, 1)

# ---------- per-file source patches (run on the Skynap source before brand/colour mapping) ----------
def patch(name, t, c):
    unit1, unitN = c['unit'], c['unit_plural']
    if name == 'sections__skynap-buy-box.liquid':
        extra = ''.join(f"            {{% when '{k}' %}}{svg(k, 13, 2.2)}\n" for k in ICONS)
        t = rep(t, "            {% else %}<svg width=\"13\"", extra + "            {% else %}<svg width=\"13\"")
        opts = ''.join(f',{{"value":"{k}","label":"{k.title()}"}}' for k in ICONS)
        t = rep(t, '{"value":"moon","label":"Moon"} ]', '{"value":"moon","label":"Moon"}' + opts + ' ]')
        t = rep(t, 'A surprise travel sleep bundle', c.get('upsell_sub', 'A little extra in your order'))
        for n, word in ((1, unit1), (2, unitN), (3, unitN)):
            old = {1: '"default": "1 Pillow"', 2: '"default": "2 Pillows"', 3: '"default": "3 Pillows"'}[n]
            t = rep(t, old, f'"default": "{n} {word}"')
        t = rep(t, '"default": "Inflates in 3 breaths"', '"default": "Free insured shipping"')
        # gallery: product videos autoplay muted; thumbs use preview images
        t = rep(t, """<div class="pt-buy__slide" data-alt="{{ media.alt | escape }}">{{ media | image_url: width: 1100 | image_tag: loading: 'lazy', alt: media.alt, widths: '550,1100', class: 'pt-buy__mainimg' }}</div>""",
                """<div class="pt-buy__slide" data-alt="{{ media.alt | escape }}">{% if media.media_type == 'video' %}{{ media | video_tag: autoplay: true, loop: true, muted: true, playsinline: true, controls: false, preload: 'metadata', class: 'pt-buy__mainimg', image_size: '1100x' }}{% else %}{{ media | image_url: width: 1100 | image_tag: loading: 'lazy', alt: media.alt, widths: '550,1100', class: 'pt-buy__mainimg' }}{% endif %}</div>""")
        t = rep(t, """{{ media | image_url: width: 200 | image_tag: loading: 'lazy', alt: '', width: 200 }}""",
                """{{ media.preview_image | image_url: width: 200 | image_tag: loading: 'lazy', alt: '', width: 200 }}{% if media.media_type == 'video' %}<span class="pt-buy__play">&#9654;</span>{% endif %}""")
        # deadline bar (e.g. Christmas); the stock bar shows when no deadline is set or it has passed
        t = rep(t, """      <div class="pt-buy__stock">""",
                f"""      <div class="pt-buy__xmas" data-pt-xmas data-cutoff="{{{{ section.settings.xmas_cutoff }}}}" hidden>
        <span class="pt-buy__xmasico">{GIFT}</span>
        <span class="pt-buy__xmastext"><b>Order by <span data-pt-xmas-date></span></b> {{{{ section.settings.deadline_text }}}}</span>
        <em data-pt-xmas-left></em>
      </div>
      <div class="pt-buy__stock" data-pt-stock>""")
        # mobile sticky add to cart
        t = rep(t, """  {%- assign up = section.settings.upsell -%}""",
                """  <div class="pt-sticky" data-pt-sticky aria-hidden="true">
    {%- assign sfm = p.media | first -%}
    {% if sfm %}{{ sfm.preview_image | image_url: width: 96 | image_tag: class: 'pt-sticky__img', loading: 'lazy', alt: '' }}{% endif %}
    <span class="pt-sticky__info"><b>{{ section.settings.title | default: p.title }}</b><span><span data-pt-sticky-price>{{ section.settings.b1_price }}</span> <s data-pt-sticky-compare>{{ section.settings.b1_compare }}</s></span></span>
    <button type="button" class="pt-sticky__btn" data-pt-sticky-btn>Add to cart</button>
  </div>
  {%- assign up = section.settings.upsell -%}""")
        t = rep(t, """    { "type": "text", "id": "stock_text", "label": "Stock urgency text", "default": "Selling fast" }""",
                """    { "type": "text", "id": "stock_text", "label": "Stock urgency text", "default": "Selling fast" },
    { "type": "text", "id": "xmas_cutoff", "label": "Order deadline (YYYY-MM-DD, blank = off)" },
    { "type": "text", "id": "deadline_text", "label": "Deadline text", "default": "for Christmas delivery" }""")
    if name == 'sections__skynap-trust-strip.liquid':
        extra = ''.join(f"          {{% when '{k}' %}}{svg(k, 16, 2)}\n" for k in ICONS)
        t = rep(t, "          {% when 'breath' %}", extra + "          {% when 'breath' %}")
        opts = ''.join(f',{{"value":"{k}","label":"{k.title()}"}}' for k in ICONS)
        t = re.sub(r'(\{"value":"badge","label":"[^"]*"\})', lambda m: m.group(1) + opts, t, count=1)
    if name == 'assets__skynap-buy.css':
        t = t + CSS
    if name == 'assets__skynap-buy.js':
        t = rep(t, "var b=+box.dataset.ptStyles;if(b!==state.bundle){box.innerHTML='';return}",
                "var b=+box.dataset.ptStyles;if(b!==state.bundle||opts.length<2){box.innerHTML='';return}")
        t = rep(t, "'Color · pillow '", "'" + c.get('option_name', 'Color') + " · " + unit1.lower() + " '")
        t = rep(t, "'Color')+'</span>", "'" + c.get('option_name', 'Color') + "')+'</span>", required=False)
        t = rep(t, "  root.querySelector('[data-pt-atc]').addEventListener('click',function(){",
                JS + "  root.querySelector('[data-pt-atc]').addEventListener('click',function(){")
    if name == 'sections__skynap-reviews.liquid':
        t = t.replace('What travelers say', 'What customers say').replace('Share your Skynap flight', 'Share your Skynap story').replace('Slept the whole flight', 'Exactly what I hoped for')
    if name == 'sections__skynap-comparison.liquid':
        t = t.replace('Fresh flowers vs Skynap', 'Others vs Skynap').replace('U-shaped neck pillow', 'The usual option').replace('Head falls forward all flight', 'The usual problem').replace('Face rests supported on the tray', 'Solved')
    if name == 'sections__skynap-faq.liquid':
        t = re.sub(r'"default": "Does it really fit on the tray table\?"', '"default": "How does it work?"', t)
        t = re.sub(r'("id": "a", "label": "Answer", "default": ")[^"]*(")', r'\1Answer here.\2', t)
    if name == 'sections__skynap-wheel-popup.liquid':
        t = t.replace('Up to $15 off your Skynap.', 'Up to 50% off your Skynap.')
    if name == 'sections__skynap-footer.liquid':
        t = re.sub(r'"default": "The inflatable pillow[^"]*"', '"default": "' + c['footer']['tagline'].replace('"', "'") + '"', t)
        t = t.replace('Travel', 'Shop').replace('support@skynap.store', c['footer']['email'])
    if name == 'sections__skynap-fb-posts.liquid':
        pass
    return t

CSS = """
.pt-buy__slide video.pt-buy__mainimg{width:100%;height:100%;object-fit:cover;display:block;background:#1C1540}
.pt-buy__thumb{position:relative}
.pt-buy__play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;text-shadow:0 1px 4px rgba(0,0,0,.55);pointer-events:none}
.pt-buy__xmas{display:flex;align-items:center;gap:10px;margin-top:16px;padding:10px 14px;border-radius:14px;background:#F1EDFD;border:1px solid #E6E2F6;font-size:13px;color:#1C1540}
.pt-buy__xmas[hidden],.pt-buy__stock[hidden]{display:none}
.pt-buy__xmasico{width:30px;height:30px;border-radius:50%;background:#5B3FE0;color:#fff;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.pt-buy__xmastext{flex:1;line-height:1.3}
.pt-buy__xmastext b{color:#31239E}
.pt-buy__xmas em{font-style:normal;font-weight:800;font-size:12px;color:#fff;background:#5B3FE0;padding:4px 10px;border-radius:999px;white-space:nowrap}
.pt-sticky{display:none}
@media (max-width:749px){
  .pt-sticky{display:flex;align-items:center;gap:10px;position:fixed;left:0;right:0;bottom:0;z-index:250;background:#fff;border-top:1px solid #E6E2F6;box-shadow:0 -6px 20px rgba(28,21,64,.1);padding:9px 12px calc(9px + env(safe-area-inset-bottom));transform:translateY(110%);transition:transform .25s ease}
  .pt-sticky.is-on{transform:translateY(0)}
  .pt-sticky__img{width:44px;height:44px;border-radius:10px;object-fit:cover;flex-shrink:0}
  .pt-sticky__info{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}
  .pt-sticky__info b{font-size:13.5px;color:#1C1540;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pt-sticky__info span{font-weight:800;font-size:14px;color:#31239E}
  .pt-sticky__info s{font-weight:600;font-size:12px;color:#9C96BB}
  .pt-sticky__btn{border:none;border-radius:999px;background:#5B3FE0;color:#fff;font-weight:800;font-size:14.5px;padding:13px 20px;cursor:pointer;white-space:nowrap}
  body.pt-sticky-pad{padding-bottom:72px}
}
"""

JS = r"""
  // ---- order deadline (blank = off; stock bar shows instead) ----
  var xm=root.querySelector('[data-pt-xmas]'),stockEl=root.querySelector('[data-pt-stock]');
  if(xm){
    var cp=(xm.dataset.cutoff||'').split('-');
    var cut=cp.length===3?new Date(+cp[0],+cp[1]-1,+cp[2],23,59,59):null;
    if(cut&&cut>now){
      xm.querySelector('[data-pt-xmas-date]').textContent=fmt(cut);
      var dl=Math.ceil((cut-now)/day);
      xm.querySelector('[data-pt-xmas-left]').textContent=dl<=1?'Last day':dl+' days left';
      xm.hidden=false;if(stockEl)stockEl.hidden=true;
    }
  }
  // ---- mobile sticky add to cart ----
  var sticky=root.querySelector('[data-pt-sticky]'),mainAtc=root.querySelector('[data-pt-atc]');
  if(sticky&&mainAtc&&'IntersectionObserver' in window){
    new IntersectionObserver(function(es){
      var e=es[0],on=!e.isIntersecting&&e.boundingClientRect.top<0;
      sticky.classList.toggle('is-on',on);document.body.classList.toggle('pt-sticky-pad',on);
    }).observe(mainAtc);
    sticky.querySelector('[data-pt-sticky-btn]').addEventListener('click',function(){mainAtc.click()});
    root.querySelectorAll('[data-pt-bundle-pick]').forEach(function(b){b.addEventListener('click',function(){
      var c=b.closest('[data-pt-bundle]');
      sticky.querySelector('[data-pt-sticky-price]').textContent=c.dataset.price;
      sticky.querySelector('[data-pt-sticky-compare]').textContent=c.dataset.compare;
    })});
  }
"""

# ---------- templates/index.json + product.json from store.json ----------
def blocks(items, typ, prefix, fn):
    b = {f'{prefix}{i + 1}': {'type': typ, 'settings': fn(x)} for i, x in enumerate(items)}
    return {'blocks': b, 'block_order': list(b)}

def img(name):
    return f'shopify://shop_images/{name}' if name else None

def clean(d):
    return {k: v for k, v in d.items() if v not in (None, '')}

def template(c):
    s, slug = c, c['slug']
    bb = c['buy_box']
    buy = {'product': c['handle'], 'title': c['title'], 'rating_text': c['rating_text'], 'ordered_count': c['ordered_count'],
           'avatar_1': img(bb['avatars'][0]), 'avatar_2': img(bb['avatars'][1]), 'avatar_3': img(bb['avatars'][2]),
           'addon_1': bb.get('addon_1'), 'addon_1_img': img(bb.get('addon_1_img')),
           'addon_2': bb.get('addon_2'), 'addon_2_img': img(bb.get('addon_2_img')),
           'stock_text': bb['stock_text'], 'upsell': bb.get('upsell'),
           'xmas_cutoff': bb.get('deadline_date'), 'deadline_text': bb.get('deadline_text')}
    for i, tier in enumerate(bb['tiers'], 1):
        buy.update({f'b{i}_title': tier['title'], f'b{i}_price': tier['price'], f'b{i}_compare': tier['compare'],
                    f'b{i}_save': tier['save'], f'b{i}_gift': tier.get('gift', '-')})
    sec = {}
    sec[f'{slug}_buy_box'] = {'type': f'{slug}-buy-box', 'settings': clean(buy),
                              **blocks(bb['benefits'], 'benefit', 'ben', lambda x: {'icon': x[0], 'text': x[1]})}
    sec[f'{slug}_trust'] = {'type': f'{slug}-trust-strip', 'settings': {'speed': 34},
                            **blocks(c['trust'], 'item', 't', lambda x: {'icon': x[0], 'text': x[1]})}
    sec[f'{slug}_fb_posts'] = {'type': f'{slug}-fb-posts', 'settings': {'eyebrow': 'Straight from Facebook', 'heading': c['fb_heading']},
                               **blocks(c['fb_posts'], 'post', 'p', lambda x: clean({'avatar': img(x['avatar']), 'name': x['name'], 'time': x['time'], 'text': x['text'],
                                                                                    'photo': img(x.get('photo')), 'likes': x['likes'], 'comments': x['comments'], 'shares': x['shares']}))}
    sec[f'{slug}_ugc'] = {'type': f'{slug}-ugc-carousel', 'settings': {'eyebrow': 'Instagram · TikTok', 'heading': 'Seen on your feed'},
                          **blocks(c['ugc'], 'slide', 'u', lambda x: clean({'image': img(x['image']), 'video_url': x.get('video_url')}))}
    cmp_ = c['comparison']
    sec[f'{slug}_comparison'] = {'type': f'{slug}-comparison', 'settings': {'eyebrow': f"Why {c['brand']}", 'heading': cmp_['heading'],
                                 'left_label': cmp_['left_label'], 'right_label': c['brand'], 'cta_label': f"Get my {c['brand']}"},
                                 **blocks(cmp_['rows'], 'row', 'r', lambda x: {'bad': x[0], 'good': x[1]})}
    rv = c['reviews']
    sec[f'{slug}_reviews'] = {'type': f'{slug}-reviews', 'settings': {'eyebrow': 'Reviews', 'heading': rv['heading'], 'average': rv['average'],
                              'count': rv['count'], 'pct_5': rv['pct'][0], 'pct_4': rv['pct'][1], 'pct_3': rv['pct'][2], 'pct_2': rv['pct'][3], 'pct_1': rv['pct'][4],
                              'per_page': 4, 'write_label': 'Write a review', 'form_heading': rv['form_heading'], 'submit_label': 'Submit review',
                              'thanks_text': 'Thank you! Your review is in. It appears once we approve it.'},
                              **blocks(rv['items'], 'review', 'v', lambda x: clean({'name': x['name'], 'date': x['date'], 'rating': x.get('rating', 5), 'verified': True,
                                                                                   'title': x['title'], 'text': x['text'], 'avatar': img(x.get('avatar')), 'photo': img(x.get('photo'))}))}
    sec[f'{slug}_faq'] = {'type': f'{slug}-faq', 'settings': {'heading': c['faq_heading']},
                          **blocks(c['faq'], 'qa', 'q', lambda x: {'q': x[0], 'a': x[1]})}
    w = c['wheel']
    sec[f'{slug}_wheel'] = {'type': f'{slug}-wheel-popup', 'settings': {'heading': w['heading'], 'subheading': f"One spin, one prize. Up to {w['prize']} off your {c['brand']}.",
                            'prize': f"{w['prize']} OFF", 'win_heading': f"You won {w['prize']} off!", 'win_text': f"Lucky spin, the top prize. Your {w['prize']} off is locked in on every price below.",
                            'claim_label': f"Claim my {w['prize']} off", 'delay': 5, 'claim_note': 'Already applied to every price on this page'}}
    return {'sections': sec, 'order': list(sec)}

def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    cfg_path = os.path.abspath(sys.argv[1])
    c = json.load(open(cfg_path, encoding='utf-8'))
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(os.path.dirname(cfg_path), 'out')
    slug, brand = c['slug'], c['brand']
    colors = palette(c['accent'], c['ink'])
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    for name in sorted(os.listdir(SRC)):
        if name.startswith('templates__'):
            continue
        t = patch(name, open(os.path.join(SRC, name), encoding='utf-8').read(), c)
        for a, b in colors.items():
            t = t.replace(a, b)
        t = t.replace('skynap-', f'{slug}-').replace('skynap_', f'{slug}_')
        t = t.replace('Skynap&trade;', f'{brand}&trade;').replace('Skynap', brand).replace('violet only', 'one accent colour')
        if name == 'sections__footer-group.json':
            g = json.loads(t); g['sections'][f'{slug}_footer_grp']['settings'].update(c['footer']); t = json.dumps(g, indent=2, ensure_ascii=False)
        if name == 'sections__header-group.json':
            g = json.loads(t); m = g['sections'][f'{slug}_marquee']
            m.update(blocks(c['marquee'], 'item', 'm', lambda x: {'icon': x[0], 'text': x[1]}))
            t = json.dumps(g, indent=2, ensure_ascii=False)
        open(os.path.join(out, name.replace('skynap', slug)), 'w', encoding='utf-8').write(t)
    body = json.dumps(template(c), indent=2, ensure_ascii=False)
    for n in ('templates__index.json', 'templates__product.json'):
        open(os.path.join(out, n), 'w', encoding='utf-8').write(body)
    # sanity: no leftovers from the source product, every icon name exists
    bad = []
    for n in os.listdir(out):
        tx = open(os.path.join(out, n), encoding='utf-8').read().lower()
        for w in ('kynap', 'pillow', 'airplane', '5b3fe0'):
            if w in tx:
                bad.append((n, w))
    known = set(BUILTIN) | set(ICONS)
    for ic, _ in c['buy_box']['benefits'] + c['trust'] + c['marquee']:
        if ic not in known:
            bad.append(('icon', ic))
    print('built', len(os.listdir(out)), 'files ->', out)
    print('problems:', bad or 'none')

if __name__ == '__main__':
    main()
