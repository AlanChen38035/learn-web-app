// 自動建立 header（在 DOMContentLoaded 執行）
document.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('header');
  if (!header) return;

  // 判斷相對路徑前綴（根目錄或子資料夾）
  const p = window.location.pathname;
  let prefix = '';
  if (p.includes('/english/') || p.includes('/chinese/')) prefix = '../';

  // 連結清單（統一由此管理）
  const links = [
    { text: '首頁', href: `${prefix}index.html` },
    { text: '試題演練', href: `${prefix}quiz.html` },
    { text: '關於我們', href: '#about' },
    { text: '新增題庫', href: `${prefix}english/editor.html` }
  ];

  // 建立 header HTML（logo 與連結）
  header.innerHTML = `
    <div class="logo">
      <a class="logo-link" href="${prefix}index.html">
        <img src="${prefix}images/logo.svg" alt="知識酷" height="50" style="margin-right:10px;">
        <img src="${prefix}images/logo.png" alt="知識酷字標" height="40">
      </a>
    </div>
    <div class="links">
      ${links.map(l => `<a class="header-link" href="${l.href}">${l.text}</a>`).join('')}
    </div>
  `;

  // 標記當前 active（以 pathname 比對 href）
  const anchors = header.querySelectorAll('.header-link');
  anchors.forEach(a => {
    try {
      const href = a.getAttribute('href');
      // 若為內部 hash（#...）則不比較
      if (href && !href.startsWith('#')) {
        const normalizedHref = new URL(href, window.location.origin + window.location.pathname).pathname;
        if (normalizedHref === window.location.pathname || window.location.pathname.endsWith(href)) {
          a.classList.add('active');
        }
      }
    } catch (e) { /* ignore invalid URL */ }
    // 可在此統一攔截特定連結行為：例如 #about / #contact 用 modal 顯示
    a.addEventListener('click', (ev) => {
      const h = a.getAttribute('href');
      if (h && h.startsWith('#')) {
        ev.preventDefault();
        // 目前為範例：滾動到對應 id（若存在）
        const target = document.querySelector(h);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});