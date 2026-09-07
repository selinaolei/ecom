/**
 * Dear Paws – product page controller
 * Handles: gallery, variant pills, bundle tiers, add-on toggles, live totals,
 * and multi-item add-to-cart that plays nicely with Horizon's cart drawer.
 */
(function () {
  const root = document.querySelector('[data-dp-product]');
  if (!root) return;

  const cfgEl = root.querySelector('[data-dp-config]');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}');

  const state = {
    variantId: cfg.selectedVariantId,
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
  const currentVariant = () => cfg.variants.find((v) => String(v.id) === String(state.variantId)) || cfg.variants[0];
  const currentTier = () => cfg.tiers[state.tierIndex] || { quantity: 1, discount: 0 };

  const q = (sel, el = root) => el.querySelector(sel);
  const qa = (sel, el = root) => Array.from(el.querySelectorAll(sel));

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

  // swipe on main image
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

  /* ---------- variants ---------- */
  qa('[data-dp-variant]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.variantId = btn.dataset.dpVariant;
      qa('[data-dp-variant]').forEach((b) => b.classList.toggle('is-active', b === btn));
      const label = q('[data-dp-variant-label]');
      if (label) label.textContent = btn.dataset.title || '';
      const v = currentVariant();
      if (v && v.imageIndex != null && v.imageIndex >= 0) showImage(v.imageIndex);
      render();
    });
  });

  /* ---------- tiers ---------- */
  qa('[data-dp-tier]').forEach((card) => {
    card.addEventListener('click', () => {
      state.tierIndex = Number(card.dataset.dpTier);
      qa('[data-dp-tier]').forEach((c) => c.classList.toggle('is-active', c === card));
      render();
    });
  });

  /* ---------- add-ons ---------- */
  qa('[data-dp-addon]').forEach((row) => {
    const i = Number(row.dataset.dpAddon);
    const input = row.querySelector('input[type="checkbox"]');
    const sync = () => {
      if (input.checked) state.addons.add(i);
      else state.addons.delete(i);
      row.classList.toggle('is-on', input.checked);
      render();
    };
    input?.addEventListener('change', sync);
    row.classList.toggle('is-on', !!input?.checked);
  });

  /* ---------- totals ---------- */
  function computeTotals() {
    const v = currentVariant();
    const tier = currentTier();
    const unit = v ? v.price : 0;
    const compareUnit = v && v.compareAtPrice && v.compareAtPrice > unit ? v.compareAtPrice : unit;
    const gross = unit * tier.quantity;
    const discounted = Math.round(gross * (1 - (tier.discount || 0) / 100));
    let addonTotal = 0;
    state.addons.forEach((i) => (addonTotal += cfg.addons[i]?.price || 0));
    return {
      unit,
      compareUnit,
      quantity: tier.quantity,
      bundleWas: compareUnit * tier.quantity,
      bundleNow: discounted,
      total: discounted + addonTotal,
      totalWas: compareUnit * tier.quantity + addonTotal,
    };
  }

  function render() {
    const t = computeTotals();
    const v = currentVariant();

    // tier prices (per card)
    qa('[data-dp-tier]').forEach((card, i) => {
      const tier = cfg.tiers[i];
      const gross = t.unit * tier.quantity;
      const now = Math.round(gross * (1 - (tier.discount || 0) / 100));
      const was = t.compareUnit * tier.quantity;
      const nowEl = card.querySelector('[data-dp-tier-now]');
      const wasEl = card.querySelector('[data-dp-tier-was]');
      const eachEl = card.querySelector('[data-dp-tier-each]');
      const saveEl = card.querySelector('[data-dp-tier-save]');
      if (nowEl) nowEl.textContent = money(now);
      if (wasEl) {
        wasEl.textContent = was > now ? money(was) : '';
        wasEl.hidden = !(was > now);
      }
      if (eachEl) eachEl.textContent = money(Math.round(now / tier.quantity)) + ' ' + (cfg.text.each || 'each');
      if (saveEl) {
        const save = was - now;
        saveEl.textContent = save > 0 ? (cfg.text.save || 'Save') + ' ' + money(save) : '';
        saveEl.hidden = !(save > 0);
      }
    });

    // header price
    const priceNow = q('[data-dp-price-now]');
    const priceWas = q('[data-dp-price-was]');
    const pricePill = q('[data-dp-price-pill]');
    if (priceNow) priceNow.textContent = money(t.unit);
    if (priceWas) {
      priceWas.textContent = t.compareUnit > t.unit ? money(t.compareUnit) : '';
      priceWas.hidden = !(t.compareUnit > t.unit);
    }
    if (pricePill) {
      const pct = t.compareUnit > t.unit ? Math.round((1 - t.unit / t.compareUnit) * 100) : 0;
      pricePill.textContent = pct > 0 ? (cfg.text.savePct || 'SAVE {pct}%').replace('{pct}', pct) : '';
      pricePill.hidden = !(pct > 0);
    }

    // button
    const btnTotal = q('[data-dp-btn-total]');
    const btnWas = q('[data-dp-btn-was]');
    if (btnTotal) btnTotal.textContent = money(t.total);
    if (btnWas) {
      btnWas.textContent = t.totalWas > t.total ? money(t.totalWas) : '';
      btnWas.hidden = !(t.totalWas > t.total);
    }

    const btn = q('[data-dp-atc]');
    if (btn) {
      const available = v ? v.available : false;
      btn.disabled = !available;
      const label = btn.querySelector('[data-dp-btn-label]');
      if (label) label.textContent = available ? cfg.text.addToCart : cfg.text.soldOut;
    }

    // savings line
    const savings = q('[data-dp-savings]');
    const savingsAmount = q('[data-dp-savings-amount]');
    const saved = t.totalWas - t.total;
    if (savings) savings.hidden = !(saved > 0);
    if (savingsAmount) savingsAmount.textContent = money(saved);

    // sticky bar mirror
    const stickyTotal = q('[data-dp-sticky-total]');
    const stickyWas = q('[data-dp-sticky-was]');
    if (stickyTotal) stickyTotal.textContent = money(t.total);
    if (stickyWas) {
      stickyWas.textContent = t.totalWas > t.total ? money(t.totalWas) : '';
      stickyWas.hidden = !(t.totalWas > t.total);
    }
  }

  /* ---------- add to cart ---------- */
  function buildItems() {
    const v = currentVariant();
    const tier = currentTier();
    const items = [{ id: Number(v.id), quantity: tier.quantity }];
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
