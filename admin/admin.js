(function () {
  const TOKEN_KEY = "girasole_admin_token";
  const API = "/api/content";
  const ASSETS_API = "/api/assets";

  let assetLibrary = null;
  let activeImageInput = null;

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
  const loginPassword = document.getElementById("login-password");
  const loginSubmit = loginForm?.querySelector('button[type="submit"]');
  const mediaModal = document.getElementById("media-modal");
  const mediaGrid = document.getElementById("media-grid");

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
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Serverul admin nu răspunde. Reîncarcă pagina.");
    }
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
    if (type === "image") return imageField(label, id, value);
    if (type === "textarea") {
      return `<label><span>${label}</span><textarea data-field="${id}" rows="${rows || 3}">${escapeHtml(value || "")}</textarea></label>`;
    }
    return `<label><span>${label}</span><input data-field="${id}" type="${type}" value="${escapeAttr(value || "")}" /></label>`;
  }

  function previewUrl(path) {
    if (!path) return "";
    const clean = path.trim().replace(/^\//, "");
    return clean ? `/${clean}?v=${Date.now()}` : "";
  }

  function imageField(label, id, value) {
    const path = value || "";
    const hasImage = Boolean(path.trim());
    const src = hasImage ? previewUrl(path) : "";
    return `<div class="image-field" data-image-field>
      <span class="image-field-label">${escapeHtml(label)}</span>
      <div class="image-field-preview">
        <img src="${escapeAttr(src)}" alt="" data-image-preview ${hasImage ? "" : "hidden"} />
        <span class="image-field-empty" ${hasImage ? "hidden" : ""}>Nicio imagine selectată</span>
      </div>
      <input data-field="${id}" type="text" value="${escapeAttr(path)}" placeholder="assets/nume-imagine.jpg" />
      <div class="image-field-actions">
        <label class="btn btn-ghost btn-small image-upload-btn">
          Încarcă poză
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml" hidden data-image-upload />
        </label>
        <button type="button" class="btn btn-ghost btn-small" data-image-library>Alege din bibliotecă</button>
      </div>
      <p class="image-field-status" data-image-status role="status"></p>
    </div>`;
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
          ${imageField("Imagine slide 1", "hero.slides.0", content.hero.slides?.[0])}
          ${imageField("Imagine slide 2", "hero.slides.1", content.hero.slides?.[1])}
        </div>
      </section>

      <section class="admin-panel${activeSection === "about" ? " is-active" : ""}" data-panel="about">
        <h2>Despre</h2>
        <div class="field-grid">
          ${field("Etichetă", "about.eyebrow", content.about.eyebrow)}
          ${field("Titlu", "about.title", content.about.title)}
          ${field("Text", "about.text", content.about.text, "textarea", 4)}
          ${imageField("Imagine", "about.image", content.about.image)}
          ${field("Descriere imagine", "about.imageAlt", content.about.imageAlt)}
        </div>
      </section>

      <section class="admin-panel${activeSection === "gallery" ? " is-active" : ""}" data-panel="gallery">
        <h2>Galerie foto</h2>
        ${renderListEditor("gallery", content.gallery, [
          { label: "Imagine", name: "src", type: "image" },
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
    bindImageFields();
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

  function updateImagePreview(container, path) {
    const preview = container.querySelector("[data-image-preview]");
    const empty = container.querySelector(".image-field-empty");
    const clean = (path || "").trim();
    if (!preview || !empty) return;
    if (clean) {
      preview.src = previewUrl(clean);
      preview.hidden = false;
      empty.hidden = true;
    } else {
      preview.hidden = true;
      preview.removeAttribute("src");
      empty.hidden = false;
    }
  }

  function setImageStatus(container, message, isError) {
    const status = container.querySelector("[data-image-status]");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  async function fetchAssetLibrary(force) {
    if (assetLibrary && !force) return assetLibrary;
    const res = await fetch(ASSETS_API, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Nu am putut încărca biblioteca.");
    assetLibrary = data.files || [];
    return assetLibrary;
  }

  async function uploadAsset(file) {
    const maxSize = 4 * 1024 * 1024;
    if (file.size > maxSize) throw new Error("Imaginea e prea mare (max. 4 MB).");

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Nu am putut citi fișierul."));
      reader.readAsDataURL(file);
    });

    const res = await fetch(ASSETS_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ filename: file.name, data: dataUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload eșuat.");
    assetLibrary = null;
    return data.path;
  }

  function closeMediaModal() {
    if (!mediaModal) return;
    mediaModal.hidden = true;
    activeImageInput = null;
  }

  async function openMediaModal(inputEl) {
    if (!mediaModal || !mediaGrid) return;
    activeImageInput = inputEl;
    mediaModal.hidden = false;
    mediaGrid.innerHTML = `<p class="media-modal-hint">Se încarcă…</p>`;
    try {
      const files = await fetchAssetLibrary(true);
      if (!files.length) {
        mediaGrid.innerHTML = `<p class="media-modal-hint">Nu există poze în assets/. Încarcă una mai întâi.</p>`;
        return;
      }
      mediaGrid.innerHTML = files
        .map(
          (file) => `<button type="button" class="media-item" data-media-path="${escapeAttr(file.path)}">
            <img src="${escapeAttr(previewUrl(file.path))}" alt="" loading="lazy" />
            <span>${escapeHtml(file.name)}</span>
          </button>`
        )
        .join("");
      mediaGrid.querySelectorAll("[data-media-path]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!activeImageInput) return;
          activeImageInput.value = btn.dataset.mediaPath;
          activeImageInput.dispatchEvent(new Event("input", { bubbles: true }));
          closeMediaModal();
        });
      });
    } catch (err) {
      mediaGrid.innerHTML = `<p class="media-modal-hint is-error">${escapeHtml(err.message)}</p>`;
    }
  }

  function bindImageFields() {
    adminMain.querySelectorAll("[data-image-field]").forEach((container) => {
      const input = container.querySelector("[data-field]");
      const upload = container.querySelector("[data-image-upload]");
      const libraryBtn = container.querySelector("[data-image-library]");
      if (!input) return;

      input.addEventListener("input", () => updateImagePreview(container, input.value));

      libraryBtn?.addEventListener("click", () => openMediaModal(input));

      upload?.addEventListener("change", async () => {
        const file = upload.files?.[0];
        upload.value = "";
        if (!file) return;
        setImageStatus(container, "Se încarcă…");
        try {
          const path = await uploadAsset(file);
          input.value = path;
          updateImagePreview(container, path);
          setImageStatus(container, "Poză încărcată. Apasă Salvează modificările.");
        } catch (err) {
          setImageStatus(container, err.message, true);
        }
      });
    });
  }

  function bindListActions() {
    adminMain.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        collectFormData();
        const key = btn.dataset.add;
        const list = getNested(content, key) || [];
        if (key === "gallery") list.push({ src: "", alt: "" });
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

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginMsg.textContent = "";
    loginMsg.classList.remove("is-loading", "is-error");
    if (loginSubmit) {
      loginSubmit.disabled = true;
      loginSubmit.textContent = "Se autentifică…";
    }
    loginMsg.textContent = "Se autentifică…";
    loginMsg.classList.add("is-loading");
    try {
      const token = await apiLogin(loginPassword?.value || "");
      setToken(token);
      await bootAdmin();
    } catch (err) {
      loginMsg.classList.remove("is-loading");
      loginMsg.classList.add("is-error");
      loginMsg.textContent = err.message;
    } finally {
      if (loginSubmit) {
        loginSubmit.disabled = false;
        loginSubmit.textContent = "Intră";
      }
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

  mediaModal?.querySelectorAll("[data-media-close]").forEach((el) => {
    el.addEventListener("click", closeMediaModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mediaModal && !mediaModal.hidden) closeMediaModal();
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
