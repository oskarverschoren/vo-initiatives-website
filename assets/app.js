// Scroll-reveal: add .in when a .fade element enters the viewport, staggering siblings.
const groups = new Map();
document.querySelectorAll('.fade').forEach((el) => {
  const parent = el.parentElement;
  if (!groups.has(parent)) groups.set(parent, []);
  groups.get(parent).push(el);
});

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target;
    const siblings = groups.get(el.parentElement) || [el];
    const idx = siblings.indexOf(el);
    el.style.transitionDelay = `${Math.min(idx, 6) * 70}ms`;
    el.classList.add('in');
    io.unobserve(el);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

document.querySelectorAll('.fade').forEach((el) => io.observe(el));

// Nav: solid background once scrolled past the hero.
const nav = document.querySelector('nav');
if (nav) {
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
