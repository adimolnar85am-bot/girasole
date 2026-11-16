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

  function renderAboutSlides(items, fallbackImage, fallbackAlt) {
    const slider = document.querySelector("[data-about-slider]");
    if (!slider) return;

    const slides = (Array.isArray(items) ? items : [])
      .filter((item) => item && item.src)
      .map((item) => ({ src: item.src, alt: item.alt || "" }));

    if (!slides.length && fallbackImage) {
      slides.push({ src: fallbackImage, alt: fallbackAlt || "" });
    }

    if (!slides.length) return;

    slider.innerHTML =
      slides
        .map(
          (slide, index) => `<img
            class="about-slide${index === 0 ? " is-active" : ""}"
            data-about-slide
            src="${escapeAttr(slide.src)}"
            alt="${escapeAttr(slide.alt)}"
            loading="lazy"
            decoding="async"
          />`
        )
        .join("") +
      (slides.length > 1
        ? `<div class="about-slider-dots" data-about-slider-dots aria-label="Alege fotografia">
            ${slides
              .map(
                (_, index) =>
                  `<button
                    class="about-slider-dot${index === 0 ? " is-active" : ""}"
                    type="button"
                    data-about-slide-to="${index}"
                    aria-label="Fotografia ${index + 1}"
                    aria-current="${index === 0 ? "true" : "false"}"
                  ></button>`
              )
              .join("")}
          </div>`
        : "");
  }

  function applySiteContent(data) {
    if (!data) return;

    document.title = data.meta?.title || document.title;
    setAttr('meta[name="description"]', "content", data.meta?.description);

    setText("[data-content='hero.line']", data.hero?.line);
    setText("[data-content='hero.ctaPrimary']", data.hero?.ctaPrimary);
    renderHeroSlides(data.hero?.slides);

    setText("[data-content='about.eyebrow']", data.about?.eyebrow);
    setText("[data-content='about.title']", data.about?.title);
    setText("[data-content='about.text']", data.about?.text);
    renderAboutSlides(data.about?.images, data.about?.image, data.about?.imageAlt);

    renderGallery(data.gallery);

    setText("[data-content='menu.eyebrow']", data.menu?.eyebrow);
    setText("[data-content='menu.title']", data.menu?.title);
    setText("[data-content='menu.text']", data.menu?.text);
    setText("[data-content='menu.footnote']", data.menu?.footnote);
    const menuSections = document.querySelector("[data-menu-sections]");
    if (menuSections && Array.isArray(data.menu?.sections) && data.menu.sections.length) {
      menuSections.innerHTML = data.menu.sections
        .filter((section) => section && String(section.title || "").trim())
        .map((section) => `<div class="menu-col reveal is-visible">
          <h3>${escapeHtml(section.title)}</h3>
          <ul class="menu-list">${renderMenuItems(section.items)}</ul>
        </div>`)
        .join("");
    } else {
      const paniniList = document.querySelector("[data-menu-panini]");
      const caffeList = document.querySelector("[data-menu-caffe]");
      if (paniniList) paniniList.innerHTML = renderMenuItems(data.menu?.panini);
      if (caffeList) caffeList.innerHTML = renderMenuItems(data.menu?.caffe);
    }

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
  }

  const SANITY_PROJECT_ID = "zw7ud6de";
  const SANITY_DATASET = "production";
  const SANITY_API_VERSION = "2025-08-01";

  function sanityImageUrl(image) {
    const ref = image?.asset?._ref;
    if (!ref) return "";
    const match = /^image-([a-f0-9]+)-(\d+x\d+)-([a-z0-9]+)$/i.exec(ref);
    if (!match) return "";
    return `https://cdn.sanity.io/images/${SANITY_PROJECT_ID}/${SANITY_DATASET}/${match[1]}-${match[2]}.${match[3]}`;
  }

  function imageItems(items) {
    return (items || []).map((item) => ({
      src: sanityImageUrl(item),
      alt: item?.alt || "",
    })).filter((item) => item.src);
  }

  async function loadSanityContent(signal) {
    const query = encodeURIComponent(`{
      "settings": *[_type == "siteSettings" && _id == "siteSettings"][0],
      "categories": *[_type == "menuCategory"] | order(order asc)
    }`);
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${SANITY_DATASET}?query=${query}`;
    const response = await fetch(url, {headers: {"Accept": "application/json"}, signal});
    if (!response.ok) throw new Error(`Sanity API returned ${response.status}`);
    const payload = await response.json();
    const settings = payload?.result?.settings;
    if (!settings) throw new Error("Continutul Girasole nu a fost importat inca in Sanity.");

    const heroSlides = imageItems(settings.heroSlides).map((item) => item.src);
    const aboutImages = imageItems(settings.aboutImages);
    const gallery = imageItems(settings.gallery);
    const sections = (payload.result.categories || []).map((category) => ({
      id: category._id,
      title: category.title,
      items: (category.items || []).map((item) => ({
        name: item.name || "",
        price: item.price || "",
        desc: item.desc || "",
      })),
    }));

    return {
      meta: {title: settings.metaTitle, description: settings.metaDescription},
      hero: {line: settings.heroLine, ctaPrimary: settings.heroCtaPrimary, slides: heroSlides},
      about: {
        eyebrow: settings.aboutEyebrow,
        title: settings.aboutTitle,
        text: settings.aboutText,
        images: aboutImages,
        image: aboutImages[0]?.src || "",
        imageAlt: aboutImages[0]?.alt || "",
      },
      gallery,
      menu: {
        eyebrow: settings.menuEyebrow,
        title: settings.menuTitle,
        text: settings.menuText,
        footnote: settings.menuFootnote,
        sections,
      },
      contact: {
        eyebrow: settings.contactEyebrow,
        title: settings.contactTitle,
        businessName: settings.businessName,
        street: settings.street,
        city: settings.city,
        hours: settings.hours,
        instagramHandle: settings.instagramHandle,
        instagramUrl: settings.instagramUrl,
        hoursNote: settings.hoursNote,
        mapQuery: settings.mapQuery,
      },
      footer: {
        text: settings.footerText,
        instagramUrl: settings.footerInstagramUrl,
        instagramLabel: settings.footerInstagramLabel,
      },
    };
  }

  async function refreshFromSanity() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    try {
      const sanityData = await loadSanityContent(controller.signal);
      applySiteContent(sanityData);
    } catch (sanityError) {
      console.warn("Sanity nu a raspuns. Continui cu continutul local.", sanityError);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function loadSiteContent() {
    let data = null;

    // Load a local copy first so page initialization and reveal animations never wait for Sanity.
    try {
      const apiResponse = await fetch(CONTENT_URL, {cache: "no-store"});
      if (apiResponse.ok) data = await apiResponse.json();
    } catch {
      /* Use the bundled JSON fallback on static hosts. */
    }

    if (!data) {
      try {
        const fallbackResponse = await fetch(FALLBACK_URL, {cache: "no-store"});
        if (!fallbackResponse.ok) throw new Error(`Local content returned ${fallbackResponse.status}`);
        data = await fallbackResponse.json();
      } catch (fallbackError) {
        console.error("Nu am putut incarca nici continutul local.", fallbackError);
      }
    }

    if (data) applySiteContent(data);

    // Sanity refresh runs independently and only replaces the local copy when it succeeds.
    refreshFromSanity();

    if (!data) throw new Error("Nu am putut incarca continutul Girasole.");
    return data;
  }

  window.GirasoleContent = { loadSiteContent, applySiteContent };
})();
