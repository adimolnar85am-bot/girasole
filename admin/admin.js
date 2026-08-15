(function () {
  const TOKEN_KEY = "girasole_admin_token";
  const API = "/api/content";

  const sections = [
    { id: "meta", label: "General" },
    { id: "hero", label: "Hero" },
    { id: "about", label: "Despre" },
    { id: "gallery", label: "Galerie" },
    { id: "menu", label: "Meniu" },
    { id: "reservations", label: "Rezervări" },
    { id: "contact", label: "Contact" },
    { id: "footer", label: "Footer" },
  ];

  let content = null;
  let activeSection = "meta";

  const loginScreen = document.getElementById("login-screen");
  const adminApp = document.getElementById("admin-app");
  const loginForm = document.getElementById("login-form");
  const loginMsg = document.getElementById("login-msg");
  const adminNav = document.getElementById("admin-nav");
  const adminMain = document.getElementById("admin-main");
  const saveBtn = document.getElementById("save-btn");
  const saveStatus = document.getElementById("save-status");
  const logoutBtn = document.getElementById("logout-btn");

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  async function apiLogin(password) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Autentificare eșuată.");
    return data.token;
  }

  async function loadContent() {
    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) throw new Error("Nu am putut încărca conținutul.");
    content = await res.json();
  }

  async function saveContent() {
    collectFormData();
    const res = await fetch(API, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(content),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Salvare eșuată.");
  }

  function field(label, id, value, type = "text", rows) {
    if (type === "textarea") {
      return `<label><span>${label}</span><textarea data-field="${id}" rows="${rows || 3}">${escapeHtml(value || "")}</textarea></label>`;
    }
    return `<label><span>${label}</span><input data-field="${id}" type="${type}" value="${escapeAttr(value || "")}" /></label>`;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  function renderListEditor(key, items, fields) {
    const list = items || [];
    return `<div class="list-editor" data-list="${key}">
      ${list
        .map(
          (item, i) => `<div class="list-item" data-index="${i}">
          <div class="list-item-head"><strong>Element ${i + 1}</strong>
            <button type="button" class="btn btn-danger btn-small" data-remove="${key}">Șterge</button>
          </div>
          ${fields
            .map((f) => field(f.label, `${key}.${i}.${f.name}`, item[f.name], f.type || "text", f.rows))
            .join("")}
        </div>`
        )
        .join("")}
      <button type="button" class="btn btn-ghost btn-small" data-add="${key}">+ Adaugă element</button>
    </div>`;
  }

  function renderPanels() {
    adminMain.innerHTML = `
      <section class="admin-panel${activeSection === "meta" ? " is-active" : ""}" data-panel="meta">
        <h2>Setări generale</h2>
        <div class="field-grid">${field("Titlu pagină (SEO)", "meta.title", content.meta.title)}
        ${field("Descriere (SEO)", "meta.description", content.meta.description, "textarea", 2)}</div>
      </section>

      <section class="admin-panel${activeSection === "hero" ? " is-active" : ""}" data-panel="hero">
        <h2>Prima pagină</h2>
        <div class="field-grid">
          ${field("Text principal", "hero.line", content.hero.line, "textarea", 2)}
          ${field("Buton principal", "hero.ctaPrimary", content.hero.ctaPrimary)}
          ${field("Buton secundar", "hero.ctaSecondary", content.hero.ctaSecondary)}
          ${field("Imagine slide 1", "hero.slides.0", content.hero.slides?.[0])}
          ${field("Imagine slide 2", "hero.slides.1", content.hero.slides?.[1])}
        </div>
      </section>

      <section class="admin-panel${activeSection === "about" ? " is-active" : ""}" data-panel="about">
        <h2>Despre</h2>
        <div class="field-grid">
          ${field("Etichetă", "about.eyebrow", content.about.eyebrow)}
          ${field("Titlu", "about.title", content.about.title)}
          ${field("Text", "about.text", content.about.text, "textarea", 4)}
          ${field("Imagine (cale)", "about.image", content.about.image)}
          ${field("Descriere imagine", "about.imageAlt", content.about.imageAlt)}
        </div>
      </section>

      <section class="admin-panel${activeSection === "gallery" ? " is-active" : ""}" data-panel="gallery">
        <h2>Galerie foto</h2>
        ${renderListEditor("gallery", content.gallery, [
          { label: "Imagine (cale)", name: "src" },
          { label: "Descriere", name: "alt" },
        ])}
      </section>

      <section class="admin-panel${activeSection === "menu" ? " is-active" : ""}" data-panel="menu">
        <h2>Meniu permanent</h2>
        <div class="field-grid">
          ${field("Etichetă", "menu.eyebrow", content.menu.eyebrow)}
          ${field("Titlu", "menu.title", content.menu.title)}
          ${field("Text intro", "menu.text", content.menu.text, "textarea", 2)}
          ${field("Notă subsol", "menu.footnote", content.menu.footnote, "textarea", 2)}
        </div>
        <h3 style="margin-top:1.25rem;font-size:1rem;color:var(--green)">Panini</h3>
        ${renderListEditor("menu.panini", content.menu.panini, [
          { label: "Nume", name: "name" },
          { label: "Preț", name: "price" },
          { label: "Descriere", name: "desc", type: "textarea", rows: 2 },
        ])}
        <h3 style="margin-top:1.25rem;font-size:1rem;color:var(--green)">Caffè</h3>
        ${renderListEditor("menu.caffe", content.menu.caffe, [
          { label: "Nume", name: "name" },
          { label: "Preț", name: "price" },
          { label: "Descriere", name: "desc", type: "textarea", rows: 2 },
        ])}
      </section>

      <section class="admin-panel${activeSection === "reservations" ? " is-active" : ""}" data-panel="reservations">
        <h2>Rezervări</h2>
        <div class="field-grid">
          ${field("Etichetă", "reservations.eyebrow", content.reservations.eyebrow)}
          ${field("Titlu", "reservations.title", content.reservations.title)}
          ${field("Text", "reservations.text", content.reservations.text, "textarea", 3)}
          ${field("Email rezervări", "reservations.email", content.reservations.email, "email")}
        </div>
      </section>

      <section class="admin-panel${activeSection === "contact" ? " is-active" : ""}" data-panel="contact">
        <h2>Contact</h2>
        <div class="field-grid">
          ${field("Etichetă", "contact.eyebrow", content.contact.eyebrow)}
          ${field("Titlu", "contact.title", content.contact.title)}
          ${field("Nume business", "contact.businessName", content.contact.businessName)}
          ${field("Adresă", "contact.street", content.contact.street)}
          ${field("Oraș", "contact.city", content.contact.city)}
          ${field("Program", "contact.hours", content.contact.hours)}
          ${field("Instagram (handle)", "contact.instagramHandle", content.contact.instagramHandle)}
          ${field("Link Instagram", "contact.instagramUrl", content.contact.instagramUrl)}
          ${field("Notă program", "contact.hoursNote", content.contact.hoursNote, "textarea", 2)}
          ${field("Adresă hartă", "contact.mapQuery", content.contact.mapQuery)}
        </div>
      </section>

      <section class="admin-panel${activeSection === "footer" ? " is-active" : ""}" data-panel="footer">
        <h2>Footer</h2>
        <div class="field-grid">
          ${field("Text", "footer.text", content.footer.text)}
          ${field("Link Instagram", "footer.instagramUrl", content.footer.instagramUrl)}
          ${field("Etichetă Instagram", "footer.instagramLabel", content.footer.instagramLabel)}
        </div>
      </section>`;

    bindListActions();
  }

  function renderNav() {
    adminNav.innerHTML = sections
      .map(
        (s) =>
          `<button type="button" class="${s.id === activeSection ? "is-active" : ""}" data-section="${s.id}">${s.label}</button>`
      )
      .join("");
    adminNav.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        collectFormData();
        activeSection = btn.dataset.section;
        renderNav();
        renderPanels();
      });
    });
  }

  function setNested(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i];
      const next = parts[i + 1];
      if (/^\d+$/.test(next)) {
        if (!Array.isArray(cur[key])) cur[key] = [];
      } else if (cur[key] == null) {
        cur[key] = {};
      }
      cur = cur[key];
    }
    const last = parts[parts.length - 1];
    if (/^\d+$/.test(last)) cur[Number(last)] = value;
    else cur[last] = value;
  }

  function getNested(obj, path) {
    return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
  }

  function collectFormData() {
    if (!content) return;
    adminMain.querySelectorAll("[data-field]").forEach((el) => {
      setNested(content, el.dataset.field, el.value);
    });
  }

  function bindListActions() {
    adminMain.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        collectFormData();
        const key = btn.dataset.add;
        const list = getNested(content, key) || [];
        if (key === "gallery") list.push({ src: "assets/", alt: "" });
        else if (key.startsWith("menu.")) list.push({ name: "", price: "", desc: "" });
        else list.push({ name: "", desc: "" });
        setNested(content, key, list);
        renderPanels();
      });
    });

    adminMain.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        collectFormData();
        const key = btn.dataset.remove;
        const item = btn.closest(".list-item");
        const index = Number(item.dataset.index);
        const list = getNested(content, key) || [];
        list.splice(index, 1);
        setNested(content, key, list);
        renderPanels();
      });
    });
  }

  async function bootAdmin() {
    await loadContent();
    if (!content?.hero || !content?.menu) {
      throw new Error("Conținut incomplet. Reîncarcă pagina sau contactează suportul.");
    }
    loginScreen.hidden = true;
    adminApp.hidden = false;
    renderNav();
    renderPanels();
  }

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginMsg.textContent = "";
    try {
      const token = await apiLogin(document.getElementById("login-password").value);
      setToken(token);
      await bootAdmin();
    } catch (err) {
      loginMsg.textContent = err.message;
    }
  });

  saveBtn.addEventListener("click", async () => {
    saveStatus.textContent = "Se salvează…";
    saveStatus.classList.remove("is-error");
    try {
      collectFormData();
      await saveContent();
      saveStatus.textContent = "Salvat! Modificările apar imediat pe site.";
    } catch (err) {
      saveStatus.textContent = err.message;
      saveStatus.classList.add("is-error");
    }
  });

  logoutBtn.addEventListener("click", () => {
    setToken(null);
    location.reload();
  });

  if (getToken()) {
    bootAdmin().catch((err) => {
      setToken(null);
      loginScreen.hidden = false;
      adminApp.hidden = true;
      loginMsg.textContent = err.message || "Sesiune expirată. Autentifică-te din nou.";
    });
  }
})();
