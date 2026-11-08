const menuLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.site-header nav a'))
  .map((link) => ({ link, url: new URL(link.href) }));

function updateActiveLink() {
  const currentPath = location.pathname.replace(/\/$/, '');
  const pageLinks = menuLinks.filter(({ url }) =>
    url.origin === location.origin && url.pathname.replace(/\/$/, '') === currentPath
  );
  const active = pageLinks.find(({ url }) => url.hash === location.hash)
    ?? pageLinks.find(({ url }) => !url.hash);

  for (const entry of menuLinks) {
    if (entry === active) {
      entry.link.setAttribute('aria-current', entry.url.hash ? 'location' : 'page');
    } else {
      entry.link.removeAttribute('aria-current');
    }
  }
}

updateActiveLink();
window.addEventListener('hashchange', updateActiveLink);

const header = document.querySelector<HTMLElement>('.site-header');
const menuToggle = header?.querySelector<HTMLButtonElement>('.menu-toggle');

if (header && menuToggle) {
  const closeMenu = () => menuToggle.setAttribute('aria-expanded', 'false');

  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
  });

  header.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('a')) closeMenu();
  });
  header.addEventListener('focusout', (event) => {
    if (event.relatedTarget instanceof Node && !header.contains(event.relatedTarget)) closeMenu();
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !header.contains(event.target)) closeMenu();
  });
  header.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      menuToggle.focus();
    }
  });
  matchMedia('(max-width: 900px)').addEventListener('change', closeMenu);
  header.setAttribute('data-menu-ready', '');
}
