// ─── Navigation scroll effect ───────────────────
const nav = document.querySelector('.nav');
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });
}

// ─── Mobile menu ────────────────────────────────
const hamburger = document.querySelector('.nav__hamburger');
const navLinks = document.querySelector('.nav__links');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const open = navLinks.style.display === 'flex';
    navLinks.style.display = open ? 'none' : 'flex';
    navLinks.style.flexDirection = 'column';
    navLinks.style.position = 'absolute';
    navLinks.style.top = '72px';
    navLinks.style.left = '0'; navLinks.style.right = '0';
    navLinks.style.background = 'rgba(247,245,242,0.98)';
    navLinks.style.padding = '1.5rem 2rem';
    navLinks.style.gap = '1.25rem';
    navLinks.style.borderBottom = '1px solid rgba(42,42,42,0.1)';
  });
}

// ─── Intersection Observer for fade-in ──────────
const fadeEls = document.querySelectorAll('.fade-in');
if (fadeEls.length) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  fadeEls.forEach(el => io.observe(el));
}

// ─── Active nav link ────────────────────────────
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav__links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === 'index.html' && href === '/') || (path === '' && href === '/')) {
      a.style.color = 'var(--charcoal)';
      a.style.fontWeight = '500';
    }
  });
}
setActiveNav();

// ─── Session-aware navigation ───────────────────
async function updateSessionNav() {
  const links = document.querySelector('.nav__links');
  if (!links) return;

  try {
    const resp = await fetch('/api/auth/me', { credentials: 'same-origin' });
    const data = await resp.json();
    if (!data.user) return;

    const portalLink = links.querySelector('a[href="portal.html"], a[href="/portal"]');
    if (portalLink) {
      portalLink.textContent = data.user.role === 'admin' ? 'Admin' : 'Dashboard';
      portalLink.href = data.user.role === 'admin' ? 'admin.html' : 'dashboard.html';
    }

    if (data.user.role === 'admin') {
      links.querySelectorAll('a[href="ficha.html"], a[href="/ficha"]').forEach((link) => {
        link.closest('li')?.remove();
      });
    }

    if (!links.querySelector('[data-nav-logout]')) {
      const item = document.createElement('li');
      const logout = document.createElement('a');
      logout.href = 'portal.html';
      logout.textContent = 'Sair';
      logout.dataset.navLogout = 'true';
      logout.addEventListener('click', async (event) => {
        event.preventDefault();
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
        window.location.href = 'portal.html';
      });
      item.appendChild(logout);
      links.appendChild(item);
    }
  } catch {
    // Public pages remain usable if the session endpoint is unavailable.
  }
}

updateSessionNav();
