// ─── Force video mute — definitivo ───
  (function() {
    function forceMute(v) {
      if (v.muted !== true) v.muted = true;
      if (v.volume !== 0)   v.volume = 0;
    }
    function setup() {
      document.querySelectorAll('video').forEach(function(v) {
        v.removeAttribute('autoplay');
        forceMute(v);
        if (!v.dataset.alwaysMuted) {
          v.dataset.alwaysMuted = '1';
          // Sempre que tentarem mexer no som (clique, slider, teclado), volta a mutar
          v.addEventListener('volumechange', function() { forceMute(v); });
        }
      });
    }
    setup();
    document.addEventListener('DOMContentLoaded', setup);
    window.addEventListener('load', setup);
    document.addEventListener('click', setup, true);
  })();

  // ─── Scroll reveal ───
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ─── Counter animation ───
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function animateCounter(el, target, suffix, duration) {
    if (prefersReducedMotion) { el.textContent = target + suffix; return; }
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      el.textContent = start + suffix;
      if (start >= target) clearInterval(timer);
    }, 16);
  }

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const el = e.target;
        const target = parseInt(el.dataset.target);
        const suffix = el.id === 'counter100' ? '%' : '+';
        animateCounter(el, target, suffix, 1200);
        counterObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  document.querySelectorAll('[data-target]').forEach(el => counterObserver.observe(el));

  // ─── Focus trap reutilizável (acessibilidade de modais/drawers) ───
  // Mantém o Tab preso dentro do container enquanto ele está aberto e
  // devolve o foco ao elemento anterior ao fechar.
  function elementosFocaveis(container) {
    return Array.prototype.slice.call(container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(function (el) { return el.offsetParent !== null; });
  }
  window.criarFocusTrap = function (container) {
    let handler = null;
    let focoAnterior = null;
    return {
      ativar: function () {
        focoAnterior = document.activeElement;
        const foc = elementosFocaveis(container);
        if (foc.length) foc[0].focus();
        handler = function (e) {
          if (e.key !== 'Tab') return;
          const f = elementosFocaveis(container);
          if (!f.length) return;
          const primeiro = f[0];
          const ultimo = f[f.length - 1];
          if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
          else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
        };
        document.addEventListener('keydown', handler);
      },
      desativar: function () {
        if (handler) document.removeEventListener('keydown', handler);
        handler = null;
        if (focoAnterior && typeof focoAnterior.focus === 'function') focoAnterior.focus();
      }
    };
  };

  // ─── Hamburger menu ───
  const btn    = document.getElementById('hamburgerBtn');
  const drawer = document.getElementById('mobileDrawer');
  const body   = document.body;

  // Semântica de diálogo para leitores de tela.
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Menu de navegação');
  const drawerTrap = window.criarFocusTrap(drawer);
  let drawerAberto = false;

  function closeDrawer() {
    if (!drawerAberto) return;
    drawerAberto = false;
    btn.classList.remove('open');
    drawer.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    body.style.overflow = '';
    drawerTrap.desativar();
  }

  btn.addEventListener('click', () => {
    if (drawerAberto) {
      closeDrawer();
    } else {
      drawerAberto = true;
      btn.classList.add('open');
      drawer.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
      body.style.overflow = 'hidden';
      drawerTrap.ativar();
    }
  });

  // Fecha com a tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  // Close drawer on link click
  drawer.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeDrawer);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !drawer.contains(e.target)) {
      closeDrawer();
    }
  });

  // Close on scroll
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const current = window.scrollY;
    if (Math.abs(current - lastScroll) > 60) {
      closeDrawer();
      lastScroll = current;
    }
  }, { passive: true });
