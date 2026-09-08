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

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && (data.description || data.message)) || ('Request failed (' + res.status + ')');
      throw new Error(msg);
    }
    if (!data) throw new Error('Unexpected response from the cart.');
    return data;
  }

  async function renderDrawer() {
    if (typeof window.dpCartRender === 'function') {
      await window.dpCartRender();
      return;
    }
    await refreshDrawer();
  }

  async function announce(cart, items) {
    // Best effort: tell Horizon (header cart count) that lines were added.
    try {
      const events = await import('@shopify/events');
      const d = events.CartLinesUpdateEvent.createPromise();
      document.dispatchEvent(
        new events.CartLinesUpdateEvent({
          action: 'add',
          context: 'product',
          lines: items.map((it) => ({ merchandiseId: String(it.id), quantity: it.quantity })),
          promise: d.promise,
        })
      );
      d.resolve({
        cart: events.CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
        detail: { items: cart.items, source: 'dp-product', sourceId: root.id, itemCount: cart.item_count, productId: cfg.productId, didError: false },
      });
    } catch (e) {
      /* ignore */
    }
  }

  const BASIC_CART = true; // plain form submit to Shopify, no scripts in the way

  function submitNativeForm(items) {
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/cart/add';
    form.style.display = 'none';
    items.forEach((it, i) => {
      const id = document.createElement('input'); id.name = `items[${i}][id]`; id.value = String(it.id); form.appendChild(id);
      const qty = document.createElement('input'); qty.name = `items[${i}][quantity]`; qty.value = String(it.quantity); form.appendChild(qty);
    });
    const ret = document.createElement('input'); ret.name = 'return_to'; ret.value = window.location.pathname + '?dpcart=1'; form.appendChild(ret);
    document.body.appendChild(form);
    form.submit();
  }

  async function addToCart() {
    const btn = q('[data-dp-atc]');
    if (!btn || btn.disabled) return;
    const items = buildItems();
    if (BASIC_CART) {
      btn.classList.add('is-loading');
      btn.disabled = true;
      submitNativeForm(items);
      return;
    }
    const err = q('[data-dp-error]');
    btn.classList.add('is-loading');
    btn.disabled = true;
    if (err) err.hidden = true;

    try {
      const getCart = () => fetchJson('/cart.js?t=' + Date.now(), { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
      const countOf = (cart, ids) => (cart.items || []).filter((li) => ids.includes(Number(li.variant_id))).reduce((s, li) => s + li.quantity, 0);
      const ids = items.map((it) => it.id);
      const before = countOf(await getCart(), ids);

      // 1) JSON add
      let cart = null;
      try {
        await fetchJson('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ items }),
        });
        cart = await getCart();
      } catch (e) {
        cart = null;
      }

      // 2) Form-encoded add (the format every app expects)
      if (!cart || countOf(cart, ids) <= before) {
        const fd = new FormData();
        items.forEach((it, i) => {
          fd.append(`items[${i}][id]`, String(it.id));
          fd.append(`items[${i}][quantity]`, String(it.quantity));
        });
        try {
          await fetchJson('/cart/add.js', { method: 'POST', body: fd, credentials: 'same-origin', headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } });
          cart = await getCart();
        } catch (e) {
          cart = null;
        }
      }

      // 3) Real form submit: handled entirely by Shopify, cannot be intercepted by scripts
      if (!cart || countOf(cart, ids) <= before) {
        const form = document.createElement('form');
        form.method = 'post';
        form.action = '/cart/add';
        form.style.display = 'none';
        items.forEach((it, i) => {
          const id = document.createElement('input'); id.name = `items[${i}][id]`; id.value = String(it.id); form.appendChild(id);
          const qty = document.createElement('input'); qty.name = `items[${i}][quantity]`; qty.value = String(it.quantity); form.appendChild(qty);
        });
        const ret = document.createElement('input'); ret.name = 'return_to'; ret.value = window.location.pathname + '?dpcart=1#dp-cart'; form.appendChild(ret);
        document.body.appendChild(form);
        form.submit();
        return;
      }

      await renderDrawer();
      openDrawer();
      announce(cart, items);
      if (typeof window.dpCartGuardCheck === 'function') setTimeout(window.dpCartGuardCheck, 300);

      btn.classList.add('is-added');
      setTimeout(() => btn.classList.remove('is-added'), 2000);
    } catch (e) {
      if (err) {
        err.textContent = (e && e.message) || 'Something went wrong. Please try again.';
        err.hidden = false;
      }
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      render();
    }
  }

  async function refreshDrawer() {
    const wrapper = document.getElementById('shopify-section-cart-drawer-section');
    if (!wrapper) return;
    try {
      const r = await fetch(`${window.location.pathname}?section_id=cart-drawer-section`, { credentials: 'same-origin' });
      const html = await r.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('[data-dp-cart]');
      const current = document.querySelector('[data-dp-cart]');
      if (fresh && current) {
        current.innerHTML = fresh.innerHTML;
        current.className = fresh.className;
      }
    } catch (e) {
      /* ignore */
    }
  }

  function openDrawer() {
    const drawer = document.getElementById('cart-drawer');
    if (!drawer) return;
    if (typeof drawer.open === 'function') {
      if (!drawer.hasAttribute('open')) drawer.open();
      return;
    }
    const dialog = drawer.querySelector('dialog');
    if (dialog && !dialog.open && typeof dialog.showModal === 'function') dialog.showModal();
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
