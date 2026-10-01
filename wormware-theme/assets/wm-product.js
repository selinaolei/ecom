/**
 * HeroMode – product page controller
 * Gallery, single-dimension Color variant picker, add-on toggles, add-to-cart.
 */
(function () {
  const root = document.querySelector('[data-hm-product]');
  if (!root) return;

  const cfgEl = root.querySelector('[data-hm-config]');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}');

  const q = (sel, el = root) => el.querySelector(sel);
  const qa = (sel, el = root) => Array.from(el.querySelectorAll(sel));

  const initial = cfg.variants.find((v) => String(v.id) === String(cfg.selectedVariantId)) || cfg.variants[0];
  const tiers = cfg.tiers && cfg.tiers.length ? cfg.tiers : [{ qty: 1, pct: 0 }];
  const state = {
    color: initial ? initial.option1 : null,
    addons: new Set(),
    tier: tiers[0].qty,
  };
  cfg.addons.forEach((a, i) => {
    if (a.defaultOn && a.variantId) state.addons.add(i);
  });

  const tierInfo = () => tiers.find((t) => t.qty === state.tier) || tiers[0];

  const money = (cents) => {
    const amount = (cents / 100).toFixed(2);
    const fmt = cfg.moneyFormat || '${{amount}}';
    const withThousands = amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt
      .replace('{{amount}}', withThousands)
      .replace('{{amount_no_decimals}}', Math.round(cents / 100).toString())
      .replace('{{amount_with_comma_separator}}', amount.replace('.', ','));
  };
  const currentVariant = () => cfg.variants.find((v) => v.option1 === state.color);

  const mainImg = q('[data-hm-main-image]');
  const thumbs = qa('[data-hm-thumb]');
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
  q('[data-hm-prev]')?.addEventListener('click', () => showImage(galleryIndex - 1));
  q('[data-hm-next]')?.addEventListener('click', () => showImage(galleryIndex + 1));

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

  qa('[data-hm-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.color = btn.dataset.hmColor;
      qa('[data-hm-color]').forEach((b) => b.classList.toggle('is-active', b === btn));
      const label = q('[data-hm-color-label]');
      if (label) label.textContent = state.color;
      const v = currentVariant();
      if (v && v.imageIndex != null && v.imageIndex >= 0) showImage(v.imageIndex);
      render();
    });
  });

  qa('[data-hm-addon-input]').forEach((input) => {
    input.addEventListener('change', () => {
      const i = Number(input.dataset.hmAddonInput);
      if (input.checked) state.addons.add(i);
      else state.addons.delete(i);
      input.closest('[data-hm-addon]')?.classList.toggle('is-on', input.checked);
      render();
    });
  });

  function setAddonsForced(forced) {
    qa('[data-hm-addon-input]').forEach((input) => {
      const i = Number(input.dataset.hmAddonInput);
      input.disabled = forced || !cfg.addons[i]?.variantId;
      if (forced) {
        input.checked = true;
        state.addons.add(i);
      } else {
        const on = !!cfg.addons[i]?.defaultOn;
        input.checked = on;
        if (on) state.addons.add(i);
        else state.addons.delete(i);
      }
      input.closest('[data-hm-addon]')?.classList.toggle('is-on', input.checked);
    });
  }

  qa('[data-hm-tier]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tier = Number(btn.dataset.hmTier);
      qa('[data-hm-tier]').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
      });
      setAddonsForced(false);
      render();
    });
  });

  function computeTotals() {
    const v = currentVariant();
    const unit = v ? v.price : 0;
    const tier = tierInfo();
    const grossMasks = unit * tier.qty;
    const maskOff = Math.round((grossMasks * tier.pct) / 100);
    const netMasks = grossMasks - maskOff;
    // Tier 1 (single mask) keeps showing the variant's own standalone sale price
    // (its compareAtPrice), not a bundle-savings figure. Tiers 2+ show bundle-only
    // savings against buying that many units at the current per-unit price, so the
    // two savings stories never stack into an inflated combined percentage.
    const maskWas = tier.qty === 1 && v && v.compareAtPrice > unit ? v.compareAtPrice : grossMasks;
    let addonTotal = 0;
    state.addons.forEach((i) => (addonTotal += cfg.addons[i]?.price || 0));
    return { maskNow: netMasks, maskWas, total: netMasks + addonTotal, totalWas: maskWas + addonTotal };
  }

  function render() {
    const v = currentVariant();

    const priceNow = q('[data-hm-price-now]');
    const priceWas = q('[data-hm-price-was]');
    const pricePill = q('[data-hm-price-pill]');
    const totals = computeTotals();
    if (priceNow) priceNow.textContent = money(totals.maskNow);
    if (priceWas) {
      priceWas.textContent = totals.maskWas > totals.maskNow ? money(totals.maskWas) : '';
      priceWas.hidden = !(totals.maskWas > totals.maskNow);
    }
    if (pricePill) {
      const pct = totals.maskWas > totals.maskNow ? Math.round((1 - totals.maskNow / totals.maskWas) * 100) : 0;
      pricePill.textContent = pct > 0 ? (cfg.text.savePct || 'SAVE {pct}%').replace('{pct}', pct) : '';
      pricePill.hidden = !(pct > 0);
    }

    const available = !!(v && v.available);
    const btn = q('[data-hm-atc]');
    if (btn) {
      btn.disabled = !available;
      const label = q('[data-hm-btn-label]', btn);
      if (label) label.textContent = available ? cfg.text.addToCart : cfg.text.soldOut;
    }

    const stickyTotal = q('[data-hm-sticky-total]');
    const stickyWas = q('[data-hm-sticky-was]');
    if (stickyTotal) stickyTotal.textContent = money(totals.total);
    if (stickyWas) {
      stickyWas.textContent = totals.totalWas > totals.total ? money(totals.totalWas) : '';
      stickyWas.hidden = !(totals.totalWas > totals.total);
    }
  }

  function buildItems() {
    const v = currentVariant();
    const tier = tierInfo();
    const items = v ? [{ id: Number(v.id), quantity: tier.qty }] : [];
    state.addons.forEach((i) => {
      const a = cfg.addons[i];
      if (a && a.variantId) items.push({ id: Number(a.variantId), quantity: 1 });
    });
    return items;
  }

  function submitCartForm(items) {
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/cart/add';
    form.style.display = 'none';
    items.forEach((it, i) => {
      const id = document.createElement('input'); id.name = `items[${i}][id]`; id.value = String(it.id); form.appendChild(id);
      const qty = document.createElement('input'); qty.name = `items[${i}][quantity]`; qty.value = String(it.quantity); form.appendChild(qty);
    });
    document.body.appendChild(form);

    if (typeof window.hmCartSubmit === 'function') {
      window.hmCartSubmit(form);
      return;
    }
    const ret = document.createElement('input');
    ret.name = 'return_to';
    ret.value = window.location.pathname;
    form.appendChild(ret);
    form.submit();
  }

  function addToCart() {
    const btn = q('[data-hm-atc]');
    if (!btn || btn.disabled) return;
    submitCartForm(buildItems());
  }

  q('[data-hm-atc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart();
  });
  q('[data-hm-sticky-atc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart();
  });

  const sticky = q('[data-hm-sticky]');
  const atcBtn = q('[data-hm-atc]');
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
