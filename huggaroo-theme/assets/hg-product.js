/**
 * Huggaroo – product page controller
 * Gallery, Color + Size variant picker, add-on toggles, single-item add-to-cart.
 */
(function () {
  const root = document.querySelector('[data-hg-product]');
  if (!root) return;

  const cfgEl = root.querySelector('[data-hg-config]');
  if (!cfgEl) return;
  const cfg = JSON.parse(cfgEl.textContent || '{}');

  const q = (sel, el = root) => el.querySelector(sel);
  const qa = (sel, el = root) => Array.from(el.querySelectorAll(sel));

  const initial = cfg.variants.find((v) => String(v.id) === String(cfg.selectedVariantId)) || cfg.variants[0];
  const state = {
    color: initial ? initial.option1 : null,
    size: initial ? initial.option2 : null,
    addons: new Set(),
  };
  cfg.addons.forEach((a, i) => {
    if (a.defaultOn && a.variantId) state.addons.add(i);
  });

  const money = (cents) => {
    const amount = (cents / 100).toFixed(2);
    const fmt = cfg.moneyFormat || '${{amount}}';
    const withThousands = amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fmt
      .replace('{{amount}}', withThousands)
      .replace('{{amount_no_decimals}}', Math.round(cents / 100).toString())
      .replace('{{amount_with_comma_separator}}', amount.replace('.', ','));
  };
  const currentVariant = () => cfg.variants.find((v) => v.option1 === state.color && v.option2 === state.size);

  const mainImg = q('[data-hg-main-image]');
  const thumbs = qa('[data-hg-thumb]');
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
  q('[data-hg-prev]')?.addEventListener('click', () => showImage(galleryIndex - 1));
  q('[data-hg-next]')?.addEventListener('click', () => showImage(galleryIndex + 1));

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

  qa('[data-hg-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.color = btn.dataset.hgColor;
      qa('[data-hg-color]').forEach((b) => b.classList.toggle('is-active', b === btn));
      const label = q('[data-hg-color-label]');
      if (label) label.textContent = state.color;
      const v = currentVariant();
      if (v && v.imageIndex != null && v.imageIndex >= 0) showImage(v.imageIndex);
      render();
    });
  });

  qa('[data-hg-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.size = btn.dataset.hgSize;
      qa('[data-hg-size]').forEach((b) => b.classList.toggle('is-active', b === btn));
      const label = q('[data-hg-size-label]');
      if (label) label.textContent = state.size;
      render();
    });
  });

  qa('[data-hg-addon-input]').forEach((input) => {
    input.addEventListener('change', () => {
      const i = Number(input.dataset.hgAddonInput);
      if (input.checked) state.addons.add(i);
      else state.addons.delete(i);
      input.closest('[data-hg-addon]')?.classList.toggle('is-on', input.checked);
      render();
    });
  });

  function computeTotals() {
    const v = currentVariant();
    const now = v ? v.price : 0;
    const was = v && v.compareAtPrice > v.price ? v.compareAtPrice : now;
    let addonTotal = 0;
    state.addons.forEach((i) => (addonTotal += cfg.addons[i]?.price || 0));
    return { now, was, total: now + addonTotal, totalWas: was + addonTotal };
  }

  function render() {
    const v = currentVariant();

    const priceNow = q('[data-hg-price-now]');
    const priceWas = q('[data-hg-price-was]');
    const pricePill = q('[data-hg-price-pill]');
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

    const available = !!(v && v.available);
    const btn = q('[data-hg-atc]');
    if (btn) {
      btn.disabled = !available;
      const label = q('[data-hg-btn-label]', btn);
      if (label) label.textContent = available ? cfg.text.addToCart : cfg.text.soldOut;
    }

    const totals = computeTotals();
    const stickyTotal = q('[data-hg-sticky-total]');
    const stickyWas = q('[data-hg-sticky-was]');
    if (stickyTotal) stickyTotal.textContent = money(totals.total);
    if (stickyWas) {
      stickyWas.textContent = totals.totalWas > totals.total ? money(totals.totalWas) : '';
      stickyWas.hidden = !(totals.totalWas > totals.total);
    }
  }

  function buildItems() {
    const v = currentVariant();
    const items = v ? [{ id: Number(v.id), quantity: 1 }] : [];
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

    if (typeof window.hgCartSubmit === 'function') {
      window.hgCartSubmit(form);
      return;
    }
    const ret = document.createElement('input');
    ret.name = 'return_to';
    ret.value = window.location.pathname;
    form.appendChild(ret);
    form.submit();
  }

  function addToCart() {
    const btn = q('[data-hg-atc]');
    if (!btn || btn.disabled) return;
    submitCartForm(buildItems());
  }

  q('[data-hg-atc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart();
  });
  q('[data-hg-sticky-atc]')?.addEventListener('click', (e) => {
    e.preventDefault();
    addToCart();
  });

  const sticky = q('[data-hg-sticky]');
  const atcBtn = q('[data-hg-atc]');
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
