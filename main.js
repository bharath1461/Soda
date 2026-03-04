const CONFIG = {
  brandName: 'SPEED',
  tagline:
    'A modern functional soda brand inspired by futuristic flavors but made with better ingredients.',
  placeholderFrame:
    'https://placehold.co/1920x1080/frame_0001/FFFFFF/webp',
  scrollRangeMultiplier: 2.5,
  variants: [
    {
      id: 'lemon-pepper',
      indexLabel: '01',
      name: 'Lemon Pepper',
      subtitle: 'Soda',
      description:
        'A modern take on a classic soda with a perfect blend of sweet and tart, full of nostalgic flavor.',
      themeColor: '#ffffff',
      mode: 'dark',
      sequence: {
        type: 'single',
        imageUrl:
          'https://dxyifmjskhmskerqrqna.supabase.co/storage/v1/object/public/vids/lemon.webp',
        frameCount: 1
      }
    },
    {
      id: 'watermelon',
      indexLabel: '02',
      name: 'Watermelon',
      subtitle: 'Soda',
      description:
        'A modern functional soda brand inspired by classic flavors but made with better ingredients.',
      themeColor: '#ffffff',
      mode: 'dark',
      sequence: {
        type: 'single',
        imageUrl:
          'https://dxyifmjskhmskerqrqna.supabase.co/storage/v1/object/public/vids/watermeln.webp',
        frameCount: 1
      }
    }
  ]
};

const state = {
  currentVariantIndex: 0,
  isInitialLoaded: false,
  isSwitchingVariant: false,
  latestScrollY: 0,
  rafScheduled: false,
  prefersReducedMotion: window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches,
  sequenceCache: {},
  canvas: null,
  ctx: null,
  devicePixelRatio: window.devicePixelRatio || 1,
  heroScrollEnd: window.innerHeight * CONFIG.scrollRangeMultiplier
};

function formatFrameNumber(index, startIndex, padding) {
  const value = startIndex + index;
  return String(value).padStart(padding, '0');
}

function buildFrameSrc(sequence, index) {
  if (sequence.type === 'numbered') {
    const num = formatFrameNumber(
      index,
      sequence.startIndex ?? 1,
      sequence.padding ?? 4
    );
    return sequence.frameTemplate.replace('####', num);
  }
  if (sequence.type === 'single') {
    return sequence.imageUrl;
  }
  return CONFIG.placeholderFrame;
}

function createSequenceRecord(variant) {
  const total =
    variant.sequence?.frameCount && variant.sequence.frameCount > 0
      ? variant.sequence.frameCount
      : 1;
  return {
    variantId: variant.id,
    total,
    loaded: 0,
    frames: new Array(total),
    ready: false
  };
}

function preloadVariantSequence(variant, onProgress) {
  const existing = state.sequenceCache[variant.id];
  if (existing && existing.ready) {
    onProgress?.(100);
    return Promise.resolve(existing);
  }

  const record = existing || createSequenceRecord(variant);
  state.sequenceCache[variant.id] = record;

  const { total } = record;

  return new Promise((resolve) => {
    if (state.prefersReducedMotion) {
      const img = new Image();
      img.src = buildFrameSrc(variant.sequence, 0);
      img.onload = () => {
        record.frames[0] = img;
        record.loaded = 1;
        record.ready = true;
        onProgress?.(100);
        resolve(record);
      };
      img.onerror = () => {
        onProgress?.(100);
        record.ready = true;
        resolve(record);
      };
      return;
    }

    let completed = 0;
    for (let i = 0; i < total; i += 1) {
      const img = new Image();
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = buildFrameSrc(variant.sequence, i);
      img.onload = () => {
        record.frames[i] = img;
        completed += 1;
        record.loaded = completed;
        const pct = Math.round((completed / total) * 100);
        onProgress?.(pct);
        if (completed === total) {
          record.ready = true;
          resolve(record);
        }
      };
      img.onerror = () => {
        completed += 1;
        record.loaded = completed;
        const pct = Math.round((completed / total) * 100);
        onProgress?.(pct);
        if (completed === total) {
          record.ready = true;
          resolve(record);
        }
      };
    }
  });
}

function setupCanvas() {
  const canvas = document.getElementById('hero-sequence');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  state.canvas = canvas;
  state.ctx = ctx;
  resizeCanvas();
}

function resizeCanvas() {
  if (!state.canvas) return;
  const { innerWidth, innerHeight } = window;
  const ratio = state.devicePixelRatio;
  state.canvas.width = innerWidth * ratio;
  state.canvas.height = innerHeight * ratio;
  state.canvas.style.width = `${innerWidth}px`;
  state.canvas.style.height = `${innerHeight}px`;
}

function clearCanvasWithPlaceholder() {
  const { ctx, canvas } = state;
  if (!ctx || !canvas) return;
  ctx.save();
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function drawFrameForScroll() {
  const { ctx, canvas } = state;
  if (!ctx || !canvas) return;

  const variant = CONFIG.variants[state.currentVariantIndex];
  const record = state.sequenceCache[variant.id];
  if (!record || !record.frames || record.loaded === 0) {
    clearCanvasWithPlaceholder();
    return;
  }

  const scrollY = state.latestScrollY;
  const start = 0;
  const end = state.heroScrollEnd;
  const t = Math.min(
    1,
    Math.max(0, (scrollY - start) / Math.max(1, end - start))
  );

  const totalFrames = record.total;
  const frameIndex = state.prefersReducedMotion
    ? 0
    : Math.min(totalFrames - 1, Math.floor(t * (totalFrames - 1)));
  const frame = record.frames[frameIndex] || record.frames[0];
  if (!frame) {
    clearCanvasWithPlaceholder();
    return;
  }

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const imgWidth = frame.naturalWidth || frame.width;
  const imgHeight = frame.naturalHeight || frame.height;

  const canvasAspect = canvasWidth / canvasHeight;
  const imgAspect = imgWidth / imgHeight;

  let drawWidth;
  let drawHeight;
  if (imgAspect > canvasAspect) {
    drawHeight = canvasHeight;
    drawWidth = imgAspect * drawHeight;
  } else {
    drawWidth = canvasWidth;
    drawHeight = drawWidth / imgAspect;
  }

  const dx = (canvasWidth - drawWidth) / 2;
  const dy = (canvasHeight - drawHeight) / 2;

  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(frame, dx, dy, drawWidth, drawHeight);

  // apply a matte black tint over the frame
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  ctx.restore();
}

function onScroll() {
  state.latestScrollY = window.scrollY || window.pageYOffset || 0;
  if (!state.rafScheduled) {
    state.rafScheduled = true;
    window.requestAnimationFrame(() => {
      drawFrameForScroll();
      state.rafScheduled = false;
    });
  }
}

function updateAccentColor(color) {
  document.documentElement.style.setProperty(
    '--accent',
    color || '#ffffff'
  );
  document.documentElement.style.setProperty(
    '--accent-soft',
    'rgba(255,255,255,0.24)'
  );
}

function animateHeroTextChange(nextVariant) {
  const heroText = document.querySelector('.hero-text');
  if (!heroText) return;

  const titleEl = document.getElementById('hero-title');
  const subtitleEl = document.getElementById('hero-subtitle');
  const descEl = document.getElementById('hero-description');
  const indexEl = document.getElementById('hero-variant-index');

  heroText.classList.add('is-transitioning-out');

  const handleTransitionEnd = (event) => {
    if (event.propertyName !== 'opacity') return;
    heroText.removeEventListener('transitionend', handleTransitionEnd);

    if (titleEl) titleEl.textContent = nextVariant.name.toUpperCase();
    if (subtitleEl) subtitleEl.textContent =
      nextVariant.subtitle?.toUpperCase() ?? '';
    if (descEl) descEl.textContent = nextVariant.description ?? '';
    if (indexEl) indexEl.textContent =
      nextVariant.indexLabel ??
      String(
        CONFIG.variants.indexOf(nextVariant) + 1
      ).padStart(2, '0');

    heroText.classList.remove('is-transitioning-out');
    heroText.classList.add('is-transitioning-in');

    window.requestAnimationFrame(() => {
      window.setTimeout(
        () => heroText.classList.remove('is-transitioning-in'),
        260
      );
    });
  };

  heroText.addEventListener('transitionend', handleTransitionEnd);
}

function setVariant(index) {
  const safeIndex =
    (index + CONFIG.variants.length) % CONFIG.variants.length;
  const nextVariant = CONFIG.variants[safeIndex];
  const prevVariant = CONFIG.variants[state.currentVariantIndex];
  if (prevVariant && prevVariant.id === nextVariant.id) return;

  const variantLoading = document.getElementById('variant-loading');
  state.isSwitchingVariant = true;
  if (variantLoading) {
    variantLoading.textContent = 'Loading 0%';
  }

  const heroVideo = document.getElementById('hero-video');

  preloadVariantSequence(nextVariant, (pct) => {
    if (variantLoading) {
      variantLoading.textContent =
        pct >= 100 ? '' : `Loading ${pct}%`;
    }
  }).then(() => {
    state.currentVariantIndex = safeIndex;
    updateAccentColor(nextVariant.themeColor);
    if (heroVideo && nextVariant.sequence?.imageUrl) {
      heroVideo.src = nextVariant.sequence.imageUrl;
    }
    animateHeroTextChange(nextVariant);
    state.isSwitchingVariant = false;
  });
}

function initHeroVariantText() {
  const variant = CONFIG.variants[state.currentVariantIndex];
  const titleEl = document.getElementById('hero-title');
  const subtitleEl = document.getElementById('hero-subtitle');
  const descEl = document.getElementById('hero-description');
  const indexEl = document.getElementById('hero-variant-index');
  if (titleEl) titleEl.textContent = variant.name.toUpperCase();
  if (subtitleEl)
    subtitleEl.textContent = variant.subtitle.toUpperCase();
  if (descEl) descEl.textContent = variant.description;
  if (indexEl)
    indexEl.textContent =
      variant.indexLabel ??
      String(state.currentVariantIndex + 1).padStart(2, '0');
}

function initVariantControls() {
  const prevBtn = document.getElementById('variant-prev');
  const nextBtn = document.getElementById('variant-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', () =>
      setVariant(state.currentVariantIndex - 1)
    );
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () =>
      setVariant(state.currentVariantIndex + 1)
    );
  }
}

function initNav() {
  const navLinks = Array.from(
    document.querySelectorAll('.main-nav .nav-link')
  );
  if (!navLinks.length) return;

  navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = link.getAttribute('href')?.slice(1);
      if (!targetId) return;
      const section = document.getElementById(targetId);
      if (!section) return;
      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        const link = navLinks.find((l) =>
          l.getAttribute('href')?.endsWith(`#${id}`)
        );
        if (!link) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.4) {
          navLinks.forEach((l) => l.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    },
    {
      threshold: [0.4, 0.7]
    }
  );

  const sectionIds = [
    'product',
    'ingredients',
    'nutrition',
    'reviews',
    'faq',
    'contact'
  ];
  sectionIds.forEach((id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

function initFAQ() {
  const items = Array.from(
    document.querySelectorAll('.faq-item')
  );
  items.forEach((item) => {
    const button = item.querySelector('.faq-question');
    if (!button) return;
    button.addEventListener('click', () => {
      item.classList.toggle('is-open');
    });
  });
}

function initFooterYear() {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

function hideInitialLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;
  loader.classList.add('is-hidden');
}

function initInitialLoad() {
  document.body.classList.add('is-hero-placeholder');
  setupCanvas();
  initHeroVariantText();
  updateAccentColor(
    CONFIG.variants[state.currentVariantIndex].themeColor
  );

  const loaderFill = document.querySelector('.loader-bar-fill');
  const loaderPercent = document.querySelector('.loader-percent');
  const heroVideo = document.getElementById('hero-video');

  const initialVariant = CONFIG.variants[state.currentVariantIndex];
  preloadVariantSequence(initialVariant, (pct) => {
    if (loaderFill) {
      loaderFill.style.width = `${pct}%`;
    }
    if (loaderPercent) {
      loaderPercent.textContent = `Loading ${pct}%`;
    }
  }).then(() => {
    state.isInitialLoaded = true;
    document.body.classList.remove('is-hero-placeholder');
    hideInitialLoader();
    if (heroVideo && initialVariant.sequence?.imageUrl) {
      heroVideo.src = initialVariant.sequence.imageUrl;
    } else {
      drawFrameForScroll();
    }

    const otherVariants = CONFIG.variants.filter(
      (v) => v.id !== initialVariant.id
    );
    otherVariants.forEach((variant) => {
      preloadVariantSequence(variant, () => {});
    });
  });
}

function initScrollHandling() {
  state.heroScrollEnd =
    window.innerHeight * CONFIG.scrollRangeMultiplier;
  window.addEventListener('scroll', onScroll, { passive: true });
}

function initResizeHandling() {
  window.addEventListener('resize', () => {
    state.heroScrollEnd =
      window.innerHeight * CONFIG.scrollRangeMultiplier;
    resizeCanvas();
    drawFrameForScroll();
  });
}

function initPage() {
  initInitialLoad();
  initVariantControls();
  initNav();
  initFAQ();
  initFooterYear();
  initScrollHandling();
  initResizeHandling();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}

