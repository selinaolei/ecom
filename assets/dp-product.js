/**
 * Dear Paws – product page controller
 * Gallery, stacked bundle rows (per-unit variant pickers + add-on toggles),
 * live totals, and multi-item add-to-cart that plays nicely with Horizon's cart drawer.
 */
(function () {
  const root = document.querySelector('[data-dp-product]');
  if (!root) return;

  const cfgEl = root.querySelector('[data-dp-config]');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}');

  const q = (sel, el = root) => el.querySelector(sel);
  const qa = (sel, el = root) => Array.from(el.querySelectorAll(sel));

  const state = {
    tierIndex: cfg.defaultTier || 0,
    addons: new Set(),
  };
  cfg.addons.forEach((a, i) => {
    if (a.defaultOn && a.variantId) state.addons.add(i);
  });

  /* ---------- helpers ---------- */
  const money = (cents) => {
    const amount = (cents / 100).toFixed(2);
    const fmt = cfg.moneyFormat || '${{amount}}';
    const withThousands = amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt
      .replace('{{amount}}', withThousands)
      .replace('{{amount_no_decimals}}', Math.round(cents / 100).toString())
      .replace('{{amount_with_comma_separator}}', amount.replace('.', ','));
  };
  const variantById = (id) => cfg.variants.find((v) => String(v.id) === String(id));
  const currentTier = () => cfg.tiers[state.tierIndex] || { quantity: 1, discount: 0 };
  const tierEl = (i) => q(`[data-dp-tier="${i}"]`);

  /** Variant ids chosen for each unit of a tier (falls back to the default variant). */
  function unitVariants(tierIndex) {
    const tier = cfg.tiers[tierIndex] || { quantity: 1 };
    const el = tierEl(tierIndex);
    const selects = el ? qa('[data-dp-unit]', el) : [];
    const ids = [];
    for (let u = 0; u < tier.quantity; u++) {
      const sel = selects[u];
      ids.push(sel ? sel.value : cfg.selectedVariantId);
    }
    return ids;
  }

  /* ---------- gallery ---------- */
  const mainImg = q('[data-dp-main-image]');
  const thumbs = qa('[data-dp-thumb]');
  let galleryIndex = 0;

  function showImage(i) {
    if (!thumbs.length || !mainImg) return;
    galleryIndex = (i + thumbs.length) % thumbs.length;
    const t = thumbs[galleryIndex];
    mainImg.src = t.dataset.src;
    if (t.dataset.srcset) mainImg.srcset = t.dataset.srcset;
    mainImg.alt = t.dataset.alt || '';
    thumbs.forEach((el, idx) => el.classList.toggle('is-active', idx === galleryIndex));
    t.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }
  thumbs.forEach((t, i) => t.addEventListener('click', () => showImage(i)));
  q('[data-dp-prev]')?.addEventListener('click', () => showImage(galleryIndex - 1));
  q('[data-dp-next]')?.addEventListener('click', () => showImage(galleryIndex + 1));

  let touchX = null;
  mainImg?.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
  mainImg?.addEventListener(
    'touchend',
    (e) => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 40) showImage(galleryIndex + (dx < 0 ? 1 : -1));
      touchX = null;
    },
    { passive: true }
  );

  /* ---------- tiers ---------- */
  qa('[data-dp-tier]').forEach((el) => {
    const head = q('[data-dp-tier-select]', el);
    const select = () => {
      state.tierIndex = Number(el.dataset.dpTier);
      qa('[data-dp-tier]').forEach((c) => {
        const on = c === el;
        c.classList.toggle('is-active', on);
        q('[data-dp-tier-select]', c)?.setAttribute('aria-expanded', on ? 'true' : 'false');
      });
      render();
    };
    head?.addEventListener('click', select);
    // clicking anywhere on an inactive row (except controls) selects it
    el.addEventListener('click', (e) => {
      if (el.classList.contains('is-active')) return;
      if (e.target.closest('select, input, label')) return;
      select();
    });
  });

  /* ---------- per-unit variant pickers ---------- */
  qa('[data-dp-unit]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const v = variantById(sel.value);
      if (v && v.imageIndex != null && v.imageIndex >= 0 && sel.dataset.dpUnit === '0') showImage(v.imageIndex);
      render();
    });
  });

  /* ---------- add-ons (same add-on appears inside every tier; keep them in sync) ---------- */
  qa('[data-dp-addon-input]').forEach((input) => {
    input.addEventListener('change', () => {
      const i = Number(input.dataset.dpAddonInput);
      if (input.checked) state.addons.add(i);
      else state.addons.delete(i);
      qa(`[data-dp-addon-input="${i}"]`).forEach((other) => {
        other.checked = input.checked;
        other.closest('[data-dp-addon]')?.classList.toggle('is-on', input.checked);
      });
      render();
    });
  });

  /* ---------- totals ---------- */
  function tierTotals(tierIndex) {
    const tier = cfg.tiers[tierIndex] || { quantity: 1, discount: 0 };
    const ids = unitVariants(tierIndex);
    let gross = 0;
    let compare = 0;
    ids.forEach((id) => {
      const v = variantById(id) || cfg.variants[0];
      if (!v) return;
      gross += v.price;
      compare += v.compareAtPrice && v.compareAtPrice > v.price ? v.compareAtPrice : v.price;
    });
    const now = Math.round(gross * (1 - (tier.discount || 0) / 100));
    return { now, was: compare, quantity: tier.quantity };
  }

  function computeTotals() {
    const t = tierTotals(state.tierIndex);
    let addonTotal = 0;
    state.addons.forEach((i) => (addonTotal += cfg.addons[i]?.price || 0));
    return { ...t, total: t.now + addonTotal, totalWas: t.was + addonTotal };
  }

  function render() {
    const firstId = unitVariants(state.tierIndex)[0];
    const v = variantById(firstId) || cfg.variants[0];

    // per-row pricing
    cfg.tiers.forEach((_, i) => {
      const el = tierEl(i);
      if (!el) return;
      const t = tierTotals(i);
      const nowEl = q('[data-dp-tier-now]', el);
      const wasEl = q('[data-dp-tier-was]', el);
      const saveEl = q('[data-dp-tier-save]', el);
      if (nowEl) nowEl.textContent = money(t.now);
      if (wasEl) {
        wasEl.textContent = t.was > t.now ? money(t.was) : '';
        wasEl.hidden = !(t.was > t.now);
      }
      if (saveEl) {
        const save = t.was - t.now;
        saveEl.textContent = save > 0 ? (cfg.text.save || 'Save') + ' ' + money(save) : '';
        saveEl.hidden = !(save > 0);
      }
    });

    // header price (single unit)
    const priceNow = q('[data-dp-price-now]');
    const priceWas = q('[data-dp-price-was]');
    const pricePill = q('[data-dp-price-pill]');
    const unit = v ? v.price : 0;
    const compareUnit = v && v.compareAtPrice > unit ? v.compareAtPrice : unit;
    if (priceNow) priceNow.textContent = money(unit);
    if (priceWas) {
      priceWas.textContent = compareUnit > unit ? money(compareUnit) : '';
      priceWas.hidden = !(compareUnit > unit);
    }
    if (pricePill) {
      const pct = compareUnit > unit ? Math.round((1 - unit / compareUnit) * 100) : 0;
      pricePill.textContent = pct > 0 ? (cfg.text.savePct || 'SAVE {pct}%').replace('{pct}', pct) : '';
      pricePill.hidden = !(pct > 0);
    }

    // button state
    const allAvailable = unitVariants(state.tierIndex).every((id) => variantById(id)?.available);
    const btn = q('[data-dp-atc]');
    if (btn) {
      btn.disabled = !allAvailable;
      const label = q('[data-dp-btn-label]', btn);
      if (label) label.textContent = allAvailable ? cfg.text.addToCart : cfg.text.soldOut;
    }

    // sticky bar
    const totals = computeTotals();
    const stickyTotal = q('[data-dp-sticky-total]');
    const stickyWas = q('[data-dp-sticky-was]');
    if (stickyTotal) stickyTotal.textContent = money(totals.total);
    if (stickyWas) {
      stickyWas.textContent = totals.totalWas > totals.total ? money(totals.totalWas) : '';
      stickyWas.hidden = !(totals.totalWas > totals.total);
    }
  }

  /* ---------- add to cart ---------- */
  function buildItems() {
    const counts = new Map();
    unitVariants(state.tierIndex).forEach((id) => counts.set(String(id), (counts.get(String(id)) || 0) + 1));
    const items = Array.from(counts, ([id, quantity]) => ({ id: Number(id), quantity }));
    state.addons.forEach((i) => {
      const a = cfg.addons[i];
      if (a && a.variantId) items.push({ id: Number(a.variantId), quantity: 1 });
    });
    return items;
  }

  async function addToCart() {
    const btn = q('[data-dp-atc]');
    if (!btn || btn.disabled) return;
    const items = buildItems();
    btn.classList.add('is-loading');
    btn.disabled = true;
    const err = q('[data-dp-error]');
    if (err) err.hidden = true;

    const sectionIds = Array.from(document.querySelectorAll('cart-items-component'))
      .map((el) => el.dataset.sectionId)
      .filter(Boolean);

    let events = null;
    try {
      events = await import('@shopify/events');
    } catch (e) {
      events = null;
    }

    let deferred = null;
    if (events && events.CartLinesUpdateEvent) {
      deferred = events.CartLinesUpdateEvent.createPromise();
      root.dispatchEvent(
        new events.CartLinesUpdateEvent({
          action: 'add',
          context: 'product',
          lines: items.map((it) => ({ merchandiseId: String(it.id), quantity: it.quantity })),
          promise: deferred.promise,
        })
      );
    }

    try {
      const res = await fetch((window.Theme && Theme.routes && Theme.routes.cart_add_url) || '/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items, sections: sectionIds.join(',') }),
      });
      const data = await res.json();
      if (data.status) throw new Error(data.description || data.message || 'Could not add to cart');

      const cartRes = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
      const cart = await cartRes.json();

      if (deferred && events) {
        deferred.resolve({
          cart: events.CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
          detail: {
            items: cart.items,
            source: 'dp-product',
            sourceId: root.id,
            itemCount: items.reduce((s, i) => s + i.quantity, 0),
            productId: cfg.productId,
            sections: data.sections,
            didError: false,
          },
        });
      } else {
        window.location.href = '/cart';
      }
      btn.classList.add('is-added');
      setTimeout(() => btn.classList.remove('is-added'), 2000);
    } catch (e) {
      if (deferred) deferred.reject(e);
      if (err) {
        err.textContent = e.message || 'Something went wrong. Please try again.';
        err.hidden = false;
      }
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      render();
    }
  }

  q('[data-dp-atc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart();
  });
  q('[data-dp-sticky-atc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart();
  });

  /* ---------- sticky bar ---------- */
  const sticky = q('[data-dp-sticky]');
  const atcBtn = q('[data-dp-atc]');
  if (sticky && atcBtn && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => sticky.classList.toggle('is-visible', !en.isIntersecting && en.boundingClientRect.top < 0));
      },
      { threshold: 0 }
    );
    io.observe(atcBtn);
  }

  render();
})();
