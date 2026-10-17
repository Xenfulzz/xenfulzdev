/* ==========================================================================
   Xenfulz — script.js
   1. Picture fallbacks (profile + project icons)
   2. Glow / accent colour picked from the profile picture
   3. Placeholder links (GitHub)
   4. "More" popover
   5. Smooth in-page scrolling
   6. Footer year
   ========================================================================== */
(() => {
  'use strict';

  /* ---- Settings you might want to change ---------------------------------- */

  // While a link's URL still contains this text, it is shown as "Coming soon".
  // (It matches the GitHub placeholder in index.html. Replace that URL and the
  // item becomes a normal, working link — no change needed here.)
  const PLACEHOLDER_MARKER = 'YOUR_GITHUB_USERNAME';

  // On phones and short (landscape) screens the More menu becomes a bottom sheet.
  // Keep in sync with the "More bottom sheet" media query in style.css.
  const SHEET_QUERY = '(max-width: 720px), (max-height: 520px)';

  /* ------------------------------------------------------------------------- */

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sheetLayout = window.matchMedia(SHEET_QUERY);


  /* 1. PICTURE FALLBACKS
     Profile picture and project icons: if the image file is missing or fails
     to load, show a clean letter badge instead of a broken-image icon. */
  function initImageFallbacks() {
    document.querySelectorAll('[data-fallback]').forEach((wrapper) => {
      const img = wrapper.querySelector('img');
      if (!img) return;

      const showFallback = () => wrapper.classList.add('is-fallback');
      const hideFallback = () => wrapper.classList.remove('is-fallback');

      img.addEventListener('error', showFallback);
      img.addEventListener('load', () => {
        if (img.naturalWidth > 0) hideFallback();
      });

      // The image may already have failed before this script ran.
      if (img.complete && img.naturalWidth === 0) showFallback();
    });
  }


  /* 2. GLOW / ACCENT COLOUR FROM THE PROFILE PICTURE
     Samples profile.png, finds its most vivid and most prominent hue, and uses
     it for the glow, the avatar ring and the hover / focus colours. Swap the
     picture and the colour follows — nothing to edit.

     Note: browsers only let a page read a picture's pixels when it is served over
     http(s) (any web host, or a local server). When index.html is opened straight
     from disk (file://) that is blocked, and the default colour set in style.css
     (--accent) stays in place. */
  function initAccentColour() {
    const img = document.querySelector('.avatar__img');
    if (!img) return;

    const apply = () => {
      try {
        setAccent(pickAccent(img));
      } catch (error) {
        /* pixel access blocked — keep the default colour from style.css */
      }
    };

    if (img.complete && img.naturalWidth > 0) apply();
    else img.addEventListener('load', apply, { once: true });
  }

  function setAccent({ r, g, b }) {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--accent', `rgb(${r}, ${g}, ${b})`);
    rootStyle.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  }

  function pickAccent(img) {
    const SIZE = 64;   // a small copy is plenty for finding a colour
    const BINS = 36;   // 10-degree hue buckets
    const NEUTRAL = { r: 209, g: 209, b: 209 }; // used for black & white pictures

    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Centre-crop to a square, the same way the circle shows it.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);

    const { data } = ctx.getImageData(0, 0, SIZE, SIZE); // throws if blocked

    const weight = new Array(BINS).fill(0);
    const sumCos = new Array(BINS).fill(0);
    const sumSin = new Array(BINS).fill(0);
    const sumSat = new Array(BINS).fill(0);
    let vivid = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // transparent
      const [h, s, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      const chroma = s * v;
      if (v < 0.2 || chroma < 0.18) continue; // too dark or too grey to be "the colour"

      const w = chroma * chroma; // vivid pixels count for far more than dull ones
      const bin = Math.min(BINS - 1, Math.floor(h * BINS));
      weight[bin] += w;
      sumCos[bin] += w * Math.cos(h * 2 * Math.PI);
      sumSin[bin] += w * Math.sin(h * 2 * Math.PI);
      sumSat[bin] += w * s;
      vivid += 1;
    }

    if (vivid < SIZE * SIZE * 0.02) return NEUTRAL; // practically no colour in the picture

    // Strongest hue, counting each bucket together with its two neighbours.
    let best = 0;
    let bestScore = -1;
    for (let b = 0; b < BINS; b++) {
      const score = weight[(b + BINS - 1) % BINS] + 2 * weight[b] + weight[(b + 1) % BINS];
      if (score > bestScore) {
        bestScore = score;
        best = b;
      }
    }

    let w = 0, c = 0, n = 0, sat = 0;
    for (const k of [-1, 0, 1]) {
      const b = (best + k + BINS) % BINS;
      w += weight[b];
      c += sumCos[b];
      n += sumSin[b];
      sat += sumSat[b];
    }
    const hue = ((Math.atan2(n, c) / (2 * Math.PI)) + 1) % 1;
    const saturation = Math.min(0.9, Math.max(0.6, (sat / w) * 1.3));

    // Same hue, tuned to a soft, bright tone that reads well on the dark page.
    return hslToRgb(hue, saturation, 0.7);
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = (h / 6 + 1) % 1;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  function hslToRgb(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return {
      r: Math.round(f(0) * 255),
      g: Math.round(f(8) * 255),
      b: Math.round(f(4) * 255),
    };
  }


  /* 3. PLACEHOLDER LINKS */
  function initPlaceholderLinks() {
    document.querySelectorAll('a[href]').forEach((link) => {
      if (!link.getAttribute('href').includes(PLACEHOLDER_MARKER)) return;

      link.classList.add('is-pending');
      link.setAttribute('aria-disabled', 'true');

      const meta = link.querySelector('[data-link-meta]');
      if (meta) meta.textContent = 'Coming soon';

      // "(opens in a new tab)" would be misleading for an inactive link.
      const hint = link.querySelector('.sr-only');
      if (hint) hint.remove();
    });
  }


  /* 4. "MORE" POPOVER
     Disclosure pattern: the button toggles aria-expanded; the panel holds
     plain links. Extras: arrow-key navigation, Escape, outside click,
     focus leaving the menu, and a flip-upwards when there's no room below. */
  function initMoreMenu() {
    const root = document.querySelector('[data-more]');
    const button = root && root.querySelector('[data-more-button]');
    const panel = root && root.querySelector('[data-more-panel]');
    if (!root || !button || !panel) return;

    const getLinks = () => Array.from(panel.querySelectorAll('a'));
    const isOpen = () => button.getAttribute('aria-expanded') === 'true';

    // Open upwards if the panel would run off the bottom of the screen.
    function place() {
      panel.classList.remove('is-up');
      if (sheetLayout.matches) return; // bottom sheet is fixed to the screen

      const rect = button.getBoundingClientRect();
      const needed = panel.offsetHeight + 16;
      const below = window.innerHeight - rect.bottom;
      const above = rect.top;
      if (needed > below && above > below) panel.classList.add('is-up');
    }

    function focusLink(which) {
      const links = getLinks();
      if (!links.length) return;
      (which === 'last' ? links[links.length - 1] : links[0]).focus();
    }

    function open(focusTarget) {
      if (!isOpen()) {
        place();
        panel.classList.add('is-open');
        button.setAttribute('aria-expanded', 'true');
      }
      if (focusTarget) focusLink(focusTarget);
    }

    function close(returnFocus = false) {
      if (!isOpen()) return;
      panel.classList.remove('is-open');
      button.setAttribute('aria-expanded', 'false');
      if (returnFocus) button.focus();
    }

    // Toggle with mouse, touch, Enter or Space.
    button.addEventListener('click', (event) => {
      if (isOpen()) {
        close();
      } else {
        // event.detail === 0 means it was triggered from the keyboard.
        open(event.detail === 0 ? 'first' : null);
      }
    });

    // Arrow keys on the button open the menu and jump into it.
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        open('first');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        open('last');
      }
    });

    // Arrow / Home / End move between items inside the panel.
    panel.addEventListener('keydown', (event) => {
      const links = getLinks();
      const index = links.indexOf(document.activeElement);
      let next = null;

      switch (event.key) {
        case 'ArrowDown': next = links[(index + 1) % links.length]; break;
        case 'ArrowUp':   next = links[(index - 1 + links.length) % links.length]; break;
        case 'Home':      next = links[0]; break;
        case 'End':       next = links[links.length - 1]; break;
        default: return;
      }

      event.preventDefault();
      if (next) next.focus();
    });

    // Choosing a link closes the menu (inactive placeholder links do nothing).
    panel.addEventListener('click', (event) => {
      const link = event.target.closest('a');
      if (!link) return;

      if (link.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
        return;
      }
      close(true);
    });

    // Escape closes it; focus goes back to the button if it was inside the menu.
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        close(root.contains(document.activeElement));
      }
    });

    // Click / tap anywhere outside closes it.
    document.addEventListener('pointerdown', (event) => {
      if (isOpen() && !root.contains(event.target)) close();
    });

    // Tabbing (or otherwise moving focus) out of the menu closes it.
    document.addEventListener('focusin', (event) => {
      if (isOpen() && !root.contains(event.target)) close();
    });

    // A change of width (rotate, resize) could leave it badly placed — close it.
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return; // ignore mobile address-bar resizes
      lastWidth = window.innerWidth;
      close();
    });

    // Coming back via the browser's back button must never show an open menu.
    window.addEventListener('pageshow', () => close());
  }


  /* 5. SMOOTH IN-PAGE SCROLLING
     Used by the scroll hint, "Back to top" and the top-left label. */
  function initSmoothScroll() {
    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-scroll]');
      if (!link) return;

      const id = (link.getAttribute('href') || '').slice(1);
      const target = id && document.getElementById(id);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: reduceMotion.matches ? 'auto' : 'smooth',
        block: 'start',
      });
      target.focus({ preventScroll: true }); // keep keyboard / screen-reader position in step
    });
  }


  /* 6. FOOTER YEAR */
  function initYear() {
    const year = String(new Date().getFullYear());
    document.querySelectorAll('[data-year]').forEach((el) => {
      el.textContent = year;
    });
  }


  function init() {
    initImageFallbacks();
    initAccentColour();
    initPlaceholderLinks();
    initMoreMenu();
    initSmoothScroll();
    initYear();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();