(function () {
  const CONTENT_URL = "/api/content";
  const FALLBACK_URL = "/data/site-content.json";

  function setText(sel, value) {
    const el = document.querySelector(sel);
    if (el && value != null) el.textContent = value;
  }

  function setAttr(sel, attr, value) {
    const el = document.querySelector(sel);
    if (el && value != null) el.setAttribute(attr, value);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function renderWeeklyItems(items) {
    const list = document.querySelector("[data-weekly-list]");
    if (!list || !Array.isArray(items)) return;
    list.innerHTML = items
      .map(
        (item) => `<li>
        <span class="item-name">${escapeHtml(item.name)}</span>
        <span class="item-desc">${escapeHtml(item.desc)}</span>
      </li>`
      )
      .join("");
  }

  function renderMenuItems(items) {
    return (items || [])
      .map(
        (item) => `<li>
        <div class="menu-line">
          <span>${escapeHtml(item.name)}</span>
          <span class="menu-price">${escapeHtml(item.price)}</span>
        </div>
        <p>${escapeHtml(item.desc)}</p>
      </li>`
      )
      .join("");
  }

  function renderGallery(items) {
    const track = document.querySelector("[data-gallery-track]");
    if (!track || !Array.isArray(items)) return;
    track.innerHTML = items
      .map((item) => `<figure><img src="${escapeAttr(item.src)}" alt="${escapeAttr(item.alt)}" /></figure>`)
      .join("");
  }

  function renderHeroSlides(slides) {
    const media = document.querySelector("[data-hero-media]");
    if (!media || !Array.isArray(slides) || !slides.length) return;
    media.innerHTML =
      slides
        .map(
          (src, i) =>
            `<img src="${escapeAttr(src)}" alt="" class="hero-img${i === 0 ? " is-active" : ""}" data-hero-slide />`
        )
        .join("") + '<div class="hero-veil"></div>';
  }

  function applySiteContent(data) {
    if (!data) return;

    document.title = data.meta?.title || document.title;
    setAttr('meta[name="description"]', "content", data.meta?.description);

    setText("[data-content='hero.line']", data.hero?.line);
    setText("[data-content='hero.ctaPrimary']", data.hero?.ctaPrimary);
    setText("[data-content='hero.ctaSecondary']", data.hero?.ctaSecondary);
    renderHeroSlides(data.hero?.slides);

    setText("[data-content='about.eyebrow']", data.about?.eyebrow);
    setText("[data-content='about.title']", data.about?.title);
    setText("[data-content='about.text']", data.about?.text);
    setAttr("[data-content='about.image']", "src", data.about?.image);
    setAttr("[data-content='about.image']", "alt", data.about?.imageAlt);

    renderGallery(data.gallery);

    setText("[data-content='weekly.eyebrow']", data.weekly?.eyebrow);
    setText("[data-content='weekly.title']", data.weekly?.title);
    setText("[data-content='weekly.text']", data.weekly?.text);
    setText("[data-content='weekly.caption']", data.weekly?.caption);
    setAttr("[data-content='weekly.image']", "src", data.weekly?.image);
    setAttr("[data-content='weekly.image']", "alt", data.weekly?.imageAlt);
    setAttr("[data-content='weekly.instagram']", "href", data.weekly?.instagramUrl);
    setText("[data-content='weekly.instagram']", data.weekly?.instagramLabel);
    renderWeeklyItems(data.weekly?.items);

    setText("[data-content='menu.eyebrow']", data.menu?.eyebrow);
    setText("[data-content='menu.title']", data.menu?.title);
    setText("[data-content='menu.text']", data.menu?.text);
    setText("[data-content='menu.footnote']", data.menu?.footnote);
    const paniniList = document.querySelector("[data-menu-panini]");
    const caffeList = document.querySelector("[data-menu-caffe]");
    if (paniniList) paniniList.innerHTML = renderMenuItems(data.menu?.panini);
    if (caffeList) caffeList.innerHTML = renderMenuItems(data.menu?.caffe);

    setText("[data-content='reservations.eyebrow']", data.reservations?.eyebrow);
    setText("[data-content='reservations.title']", data.reservations?.title);
    setText("[data-content='reservations.text']", data.reservations?.text);

    setText("[data-content='contact.eyebrow']", data.contact?.eyebrow);
    setText("[data-content='contact.title']", data.contact?.title);
    setText("[data-content='contact.businessName']", data.contact?.businessName);
    setText("[data-content='contact.street']", data.contact?.street);
    setText("[data-content='contact.city']", data.contact?.city);
    setText("[data-content='contact.hours']", data.contact?.hours);
    setText("[data-content='contact.hoursNote']", data.contact?.hoursNote);
    setAttr("[data-content='contact.instagram']", "href", data.contact?.instagramUrl);
    setText("[data-content='contact.instagram']", data.contact?.instagramHandle);
    const map = document.querySelector("[data-contact-map]");
    if (map && data.contact?.mapQuery) {
      map.src = `https://maps.google.com/maps?q=${encodeURIComponent(data.contact.mapQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    }

    setText("[data-content='footer.text']", data.footer?.text);
    setAttr("[data-content='footer.instagram']", "href", data.footer?.instagramUrl);
    setText("[data-content='footer.instagram']", data.footer?.instagramLabel);

    window.__SITE_CONTENT__ = data;
    window.__RESERVATION_EMAIL__ = data.reservations?.email || "hello@girasole.bucuresti";
  }

  async function loadSiteContent() {
    let data;
    try {
      const res = await fetch(CONTENT_URL, { cache: "no-store" });
      if (res.ok) data = await res.json();
    } catch {
      /* fallback */
    }
    if (!data) {
      const res = await fetch(FALLBACK_URL, { cache: "no-store" });
      data = await res.json();
    }
    applySiteContent(data);
    return data;
  }

  window.GirasoleContent = { loadSiteContent, applySiteContent };
})();
