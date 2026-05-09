// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.getElementById('nav-menu');
if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const open = navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  navMenu.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navMenu.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Footer year
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Contact form (client-side only demo)
const form = document.getElementById('contact-form');
const success = document.getElementById('form-success');
if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.querySelector('[name="name"]');
    const email = form.querySelector('[name="email"]');
    if (!name.value.trim() || !email.checkValidity()) {
      [name, email].forEach(el => {
        if (!el.checkValidity()) el.style.borderColor = '#d6584a';
      });
      return;
    }
    form.style.display = 'none';
    if (success) success.hidden = false;
  });
}
