(function () {
  const TOKEN_KEY = "girasole_admin_token";
  const API = "/api/content";
  const ASSETS_API = "/api/assets";

  let assetLibrary = null;
  let activeImageInput = null;

  const sections = [
    { id: "meta", label: "General" },
    { id: "hero", label: "Cover" },
    { id: "about", label: "Despre" },
    { id: "gallery", label: "Galerie foto" },
    { id: "menu", label: "Meniu" },
    { id: "contact", label: "Contact" },
    { id: "footer", label: "Footer" },
  ];

  let content = null;
  let activeSection = "meta";
  let isDirty = false;
  let isSaving = false;

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
    ensureMenuSections();
  }

  function ensureMenuSections() {
    if (!content.menu || typeof content.menu !== "object") content.menu = {};
    if (Array.isArray(content.menu.sections)) {
      content.menu.sections = content.menu.sections.map((section, index) => ({
        id: section.id || normalizeColumn(section.title || section.name || "categorie") || `categorie-${index + 1}`,
        title: String(section.title || section.name || `Categorie ${index + 1}`),
        items: Array.isArray(section.items) ? section.items : [],
      }));
      return;
    }
    const legacy = [];
    if (Array.isArray(content.menu.panini)) legacy.push({ id: "panini", title: "Panini", items: content.menu.panini });
    if (Array.isArray(content.menu.caffe)) legacy.push({ id: "cafea", title: "Caffè", items: content.menu.caffe });
    content.menu.sections = legacy;
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Serverul a răspuns cu HTTP ${res.status}.`);
    return data;
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

  function listItemActions(key, index, total) {
    return `<div class="list-item-actions">
      <button type="button" class="btn btn-icon" data-move-up="${key}" data-index="${index}" aria-label="Mută în sus" title="Mută în sus" ${index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" class="btn btn-icon" data-move-down="${key}" data-index="${index}" aria-label="Mută în jos" title="Mută în jos" ${index === total - 1 ? "disabled" : ""}>↓</button>
      <button type="button" class="btn btn-danger btn-small" data-remove="${key}">Șterge</button>
    </div>`;
  }

  function renderListEditor(key, items, fields) {
    const list = items || [];
    return `<div class="list-editor" data-list="${key}">
      ${list
        .map(
          (item, i) => `<div class="list-item" data-index="${i}">
          <div class="list-item-head">
            <strong>${key.startsWith("menu.") ? `Poziția ${i + 1} · ${escapeHtml(item.name || `Produs ${i + 1}`)}` : `Element ${i + 1}`}</strong>
            ${listItemActions(key, i, list.length)}
          </div>
          ${fields
            .map((f) => field(f.label, `${key}.${i}.${f.name}`, item[f.name], f.type || "text", f.rows))
            .join("")}
        </div>`
        )
        .join("")}
      <button type="button" class="btn btn-add" data-add="${key}">+ Adaugă element</button>
    </div>`;
  }

  function renderImageListEditor(key, items) {
    const list = items || [];
    return `<div class="list-editor image-list-editor" data-list="${key}">
      ${list
        .map(
          (src, i) => `<div class="list-item image-list-item" data-index="${i}">
            <div class="list-item-head">
              <strong>Slide ${i + 1}</strong>
              ${listItemActions(key, i, list.length)}
            </div>
            ${imageField("Fotografie", `${key}.${i}`, src)}
          </div>`
        )
        .join("")}
      <button type="button" class="btn btn-add" data-add="${key}">+ Adaugă fotografie</button>
    </div>`;
  }

  function setDirty(value = true) {
    isDirty = value;
    saveBtn.disabled = isSaving || !isDirty;
    saveBtn.classList.toggle("has-changes", isDirty);
    saveBtn.textContent = isSaving ? "Se salvează…" : isDirty ? "Salvează modificările" : "Totul salvat";
    if (!isDirty && !isSaving) {
      saveStatus.textContent = "Toate modificările sunt salvate.";
      saveStatus.classList.remove("is-error", "is-pending");
    } else if (isDirty && !isSaving) {
      saveStatus.textContent = "Ai modificări nesalvate.";
      saveStatus.classList.remove("is-error");
      saveStatus.classList.add("is-pending");
    }
  }

  function renderMenuSectionsEditor() {
    const sections = content.menu.sections || [];
    return sections.map((section, index) => `<div class="menu-section-editor" data-menu-section="${index}">
      <div class="menu-section-editor-head">
        <div class="menu-section-title-field">${field("Nume categorie", `menu.sections.${index}.title`, section.title)}</div>
        <div class="menu-section-actions">
          <button type="button" class="btn btn-small btn-ghost" data-menu-section-up="${index}" ${index === 0 ? "disabled" : ""} aria-label="Mută categoria în sus">↑</button>
          <button type="button" class="btn btn-small btn-ghost" data-menu-section-down="${index}" ${index === sections.length - 1 ? "disabled" : ""} aria-label="Mută categoria în jos">↓</button>
          <button type="button" class="btn btn-small btn-ghost" data-menu-section-remove="${index}">Șterge categoria</button>
        </div>
      </div>
      ${renderListEditor(`menu.sections.${index}.items`, section.items, [
        { label: "Produs", name: "name" },
        { label: "Preț", name: "price" },
        { label: "Descriere / gramaj", name: "desc", type: "textarea", rows: 2 },
      ])}
    </div>`).join("");
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
          ${field("Text buton meniu", "hero.ctaPrimary", content.hero.ctaPrimary)}
        </div>
        <div class="panel-section">
          <div class="panel-section-heading">
            <div>
              <h3>Fotografii cover</h3>
              <p>Adaugă, șterge sau schimbă ordinea imaginilor care rulează în prima secțiune.</p>
            </div>
          </div>
          ${renderImageListEditor("hero.slides", content.hero.slides)}
        </div>
      </section>

      <section class="admin-panel${activeSection === "about" ? " is-active" : ""}" data-panel="about">
        <h2>Despre</h2>
        <div class="field-grid">
          ${field("Etichetă", "about.eyebrow", content.about.eyebrow)}
          ${field("Titlu", "about.title", content.about.title)}
          ${field("Text", "about.text", content.about.text, "textarea", 4)}
          <p class="panel-hint">Fotografiile din sliderul sectiunii Despre. Le poti adauga, sterge sau reordona aici.</p>
          ${renderListEditor("about.images", content.about.images || (content.about.image ? [{ src: content.about.image, alt: content.about.imageAlt || "" }] : []), [
            { label: "Fotografie", name: "src", type: "image" },
            { label: "Descriere foto", name: "alt" },
          ])}
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
        <div class="menu-import-panel">
          <div class="menu-import-copy">
            <h3>Importă sau exportă meniul</h3>
            <p>Încarcă un fișier Excel, CSV sau JSON. Categoriile din fișier sunt recunoscute automat. Importul actualizează categoriile găsite și păstrează categoriile care lipsesc din fișier.</p>
            <p class="menu-import-format">Excel: foi separate pentru categorii sau o singură foaie cu coloana <strong>Categorie</strong>. CSV: coloane Produs, Pret, Descriere și Categorie. JSON: secțiuni sau produse grupate pe categorie.</p>
          </div>
          <div class="menu-import-actions">
            <button type="button" class="btn btn-ghost" data-menu-template>Descarcă Excel</button>
            <button type="button" class="btn btn-ghost" data-menu-export>Exportă JSON</button>
            <button type="button" class="btn btn-ghost" data-menu-diagnostics>Verifică salvarea</button>
            <label class="btn btn-primary menu-import-file-label">
              Importă fișier
              <input type="file" accept=".xlsx,.xls,.csv,.json,application/json,text/csv" hidden data-menu-import-file />
            </label>
          </div>
          <p class="menu-import-status" data-menu-import-status role="status">Importul este pregătit pentru categorii multiple.</p>
          <p class="menu-import-status" data-menu-diagnostic-status role="status" aria-live="polite"></p>
        </div>
        <div class="menu-sections-toolbar">
          <div><h3>Categorii meniu</h3><p>Poți redenumi, reordona, adăuga sau elimina categorii și produse.</p></div>
          <button type="button" class="btn btn-ghost" data-menu-add-category>+ Adaugă categorie</button>
        </div>
        ${renderMenuSectionsEditor()}
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
    bindMenuImportActions();
    bindMenuCategoryActions();
  }

  function menuExportData() {
    collectFormData();
    return {
      sections: (content.menu.sections || []).map((section) => ({
        title: String(section.title || "").trim(),
        items: (section.items || []).filter((item) => item && String(item.name || "").trim()).map((item, index) => ({
          position: index + 1,
          name: String(item.name || "").trim(),
          price: String(item.price ?? "").trim(),
          desc: String(item.desc ?? "").trim(),
        })),
      })).filter((section) => section.title && section.items.length),
    };
  }

  function downloadFile(filename, contents, mimeType) {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadMenuJson() {
    const data = menuExportData();
    downloadFile("girasole-meniu.json", JSON.stringify(data, null, 2), "application/json;charset=utf-8");
  }

  let xlsxLibraryPromise = null;

  function loadXlsxLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxLibraryPromise) return xlsxLibraryPromise;
    xlsxLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("Nu am putut inițializa biblioteca Excel."));
      script.onerror = () => { xlsxLibraryPromise = null; reject(new Error("Biblioteca Excel nu s-a putut încărca. Încearcă importul JSON.")); };
      document.head.appendChild(script);
    });
    return xlsxLibraryPromise;
  }

  function safeSheetName(value, used) {
    let name = String(value || "Categorie").replace(/[\\/?*:[\]]/g, " ").trim().slice(0, 31) || "Categorie";
    let candidate = name;
    let suffix = 2;
    while (used.has(candidate.toLowerCase())) {
      const tail = ` ${suffix++}`;
      candidate = name.slice(0, 31 - tail.length) + tail;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  }

  async function downloadMenuExcel() {
    const XLSX = await loadXlsxLibrary();
    const data = menuExportData();
    const workbook = XLSX.utils.book_new();
    const used = new Set();
    data.sections.forEach((section) => {
      const sheet = XLSX.utils.json_to_sheet(section.items.map((item) => ({
        Pozitie: item.position, Produs: item.name, Pret: item.price, Descriere: item.desc,
      })), { header: ["Pozitie", "Produs", "Pret", "Descriere"] });
      sheet["!cols"] = [{ wch: 10 }, { wch: 32 }, { wch: 14 }, { wch: 68 }];
      XLSX.utils.book_append_sheet(workbook, sheet, safeSheetName(section.title, used));
    });
    XLSX.writeFile(workbook, "girasole-meniu-editabil.xlsx");
  }
  function normalizeColumn(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  }

  function getRowValue(row, aliases) {
    for (const [key, value] of Object.entries(row || {})) {
      if (aliases.includes(normalizeColumn(key))) return value;
    }
    return "";
  }

  function normalizeMenuRows(rows, label) {
    if (!Array.isArray(rows)) throw new Error(`Lista ${label} trebuie să fie un tabel de produse.`);

    const normalized = [];
    rows.forEach((row, index) => {
      const name = getRowValue(row, ["produs", "nume", "name", "product", "title", "denumire", "denumireprodus"]);
      const price = getRowValue(row, ["pret", "price", "cost"]);
      const desc = getRowValue(row, ["descriere", "desc", "description", "ingrediente", "ingredients"]);
      const position = getRowValue(row, ["pozitie", "position", "ordine", "order", "sortorder"]);
      const hasAnyValue = [name, price, desc, position].some((value) => String(value ?? "").trim() !== "");
      if (!hasAnyValue) return;
      if (!String(name ?? "").trim()) {
        throw new Error(`Produs fără nume în categoria ${label}, rândul ${index + 2}.`);
      }

      const hasPosition = String(position ?? "").trim() !== "" && Number.isFinite(Number(position));
      normalized.push({
        item: {
          name: String(name).trim(),
          price: String(price ?? "").trim(),
          desc: String(desc ?? "").trim(),
        },
        position: hasPosition ? Number(position) : index + 1,
        sourceIndex: index,
      });
    });

    normalized.sort((a, b) => a.position - b.position || a.sourceIndex - b.sourceIndex);
    return normalized.map((entry) => entry.item);
  }

  function categoryKey(title) {
    const key = normalizeColumn(title);
    const aliases = { caffe: "cafea", cafe: "cafea", coffee: "cafea", cafea: "cafea", panino: "panini", sandwich: "panini", sandwiches: "panini" };
    return aliases[key] || key || "categorie";
  }

  function createMenuSection(title, rows) {
    const cleanTitle = String(title || "Categorie").trim();
    return { id: categoryKey(cleanTitle), title: cleanTitle, items: normalizeMenuRows(rows, cleanTitle) };
  }

  function groupMenuRows(rows) {
    const groups = new Map();
    rows.forEach((row, index) => {
      const rawCategory = getRowValue(row, ["categorie", "category", "sectiune", "section", "tip", "type", "grup"]);
      if (!String(rawCategory || "").trim()) {
        const hasContent = Object.values(row || {}).some((value) => String(value ?? "").trim() !== "");
        if (hasContent) throw new Error(`Lipsește categoria la rândul ${index + 2}. Adaugă o coloană Categorie.`);
        return;
      }
      const title = String(rawCategory).trim();
      const key = categoryKey(title);
      if (!groups.has(key)) groups.set(key, { title, rows: [] });
      const position = getRowValue(row, ["pozitie", "position", "ordine", "order"]);
      groups.get(key).rows.push({ ...row, position: position || groups.get(key).rows.length + 1 });
    });
    return [...groups.values()].map((group) => createMenuSection(group.title, group.rows));
  }

  function normalizeJsonMenu(parsed) {
    const source = parsed?.menu && typeof parsed.menu === "object" ? parsed.menu : parsed;
    if (Array.isArray(source?.sections)) {
      const sections = source.sections.map((section) => {
        const title = section.title || section.name || section.category || section.categorie;
        const rows = section.items || section.products || section.produse || [];
        return createMenuSection(title, rows);
      }).filter((section) => section.items.length);
      if (sections.length) return { sections };
    }
    const genericItems = source?.items || source?.products || source?.produse;
    if (Array.isArray(genericItems)) {
      const sections = groupMenuRows(genericItems);
      if (sections.length) return { sections };
    }
    const legacyOrNamedCategories = Object.entries(source || {}).filter(([key, value]) => Array.isArray(value));
    const sections = legacyOrNamedCategories.map(([title, rows]) => createMenuSection(title, rows)).filter((section) => section.items.length);
    if (sections.length) return { sections };
    throw new Error("JSON invalid. Folosește sections sau produse cu o categorie, nume, preț și descriere.");
  }

  function parseWorkbookMenu(workbook, XLSX) {
    const names = workbook.SheetNames || [];
    if (!names.length) throw new Error("Fișierul Excel nu conține foi cu produse.");
    const genericNames = ["meniu", "menu", "produse", "products"];
    const useCategoryColumn = names.length === 1 || names.every((name) => genericNames.includes(normalizeColumn(name)));
    if (useCategoryColumn) {
      const rows = names.flatMap((name) => XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "", raw: false }));
      const sections = groupMenuRows(rows);
      if (sections.length) return { sections };
      if (names.length === 1 && rows.length) return { sections: [createMenuSection(names[0] === "Sheet1" ? "Meniu" : names[0], rows)] };
      throw new Error("Nu am găsit produse. Verifică foaia și coloana Categorie.");
    }
    const sections = names.map((name) => {
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { defval: "", raw: false });
      return createMenuSection(name, rows);
    }).filter((section) => section.items.length);
    if (!sections.length) throw new Error("Nu am găsit produse în foile Excel.");
    return { sections };
  }
  async function parseMenuFile(file) {
    const extension = file.name.split(".").pop().toLowerCase();
    if (extension === "json") {
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("Nu am putut citi JSON-ul. Verifică virgulele și acoladele.");
      }
      return normalizeJsonMenu(parsed);
    }

    if (!["xlsx", "xls", "csv"].includes(extension)) {
      throw new Error("Format neacceptat. Încarcă un fișier Excel, CSV sau JSON. PDF-ul trebuie convertit înainte de import.");
    }

    const XLSX = await loadXlsxLibrary();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return parseWorkbookMenu(workbook, XLSX);
  }

  function mergeImportedMenuSections(importedSections) {
    const existing = content.menu.sections || [];
    const replacements = new Map(importedSections.map((section) => [categoryKey(section.title), section]));
    const used = new Set();
    const merged = existing.map((section) => {
      const key = categoryKey(section.title);
      if (!replacements.has(key)) return section;
      used.add(key);
      return replacements.get(key);
    });
    importedSections.forEach((section) => {
      const key = categoryKey(section.title);
      if (!used.has(key) && !existing.some((item) => categoryKey(item.title) === key)) merged.push(section);
    });
    content.menu.sections = merged;
  }

  function bindMenuImportActions() {
    const fileInput = adminMain.querySelector("[data-menu-import-file]");
    const importStatus = adminMain.querySelector("[data-menu-import-status]");
    const templateButton = adminMain.querySelector("[data-menu-template]");
    const exportButton = adminMain.querySelector("[data-menu-export]");
    const diagnosticsButton = adminMain.querySelector("[data-menu-diagnostics]");
    const diagnosticsStatus = adminMain.querySelector("[data-menu-diagnostic-status]");

    diagnosticsButton?.addEventListener("click", async () => {
      if (diagnosticsStatus) { diagnosticsStatus.textContent = "Se verifică ramura și conexiunea GitHub…"; diagnosticsStatus.classList.remove("is-error"); }
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
          body: JSON.stringify({ action: "diagnostics" }),
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Diagnostic indisponibil (HTTP ${res.status}).`);
        const menu = data.contentFile?.menu;
        const summary = menu?.categories?.map((item) => `${item.title}: ${item.productCount}`).join(" · ") || "fără categorii";
        const lines = [
          `Mediu: ${data.environment}`,
          `Ramura de salvare: ${data.branch} (${data.branchSource})`,
          `GITHUB_TOKEN: ${data.githubTokenConfigured ? "configurat" : "LIPSEȘTE"}`,
          `Fișier GitHub: HTTP ${data.contentFile?.status}`,
          `Produse existente: ${menu?.productCount ?? "necunoscut"} în ${menu?.categoryCount ?? 0} categorii`,
          summary,
        ];
        if (data.branchLooksLikePreviewFallback) lines.push("ATENȚIE: preview-ul ar folosi fallback-ul master; salvarea este blocată pentru protecție.");
        if (diagnosticsStatus) diagnosticsStatus.textContent = lines.join(" | ");
        if (!data.githubTokenConfigured || data.branchLooksLikePreviewFallback) diagnosticsStatus?.classList.add("is-error");
      } catch (err) {
        if (diagnosticsStatus) { diagnosticsStatus.textContent = err.message; diagnosticsStatus.classList.add("is-error"); }
      }
    });

    exportButton?.addEventListener("click", () => {
      try { downloadMenuJson(); if (importStatus) importStatus.textContent = "Meniul curent a fost exportat în JSON."; }
      catch (err) { if (importStatus) importStatus.textContent = err.message; }
    });

    templateButton?.addEventListener("click", async () => {
      if (importStatus) { importStatus.textContent = "Se pregătește fișierul Excel…"; importStatus.classList.remove("is-error"); }
      try { await downloadMenuExcel(); if (importStatus) importStatus.textContent = "Excelul editabil a fost descărcat."; }
      catch (err) { if (importStatus) { importStatus.textContent = err.message; importStatus.classList.add("is-error"); } }
    });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      if (importStatus) { importStatus.textContent = `Se verifică ${file.name}…`; importStatus.classList.remove("is-error"); }
      try {
        const imported = await parseMenuFile(file);
        if (!imported.sections?.length) throw new Error("Fișierul nu conține categorii de meniu.");
        collectFormData();
        mergeImportedMenuSections(imported.sections);
        setDirty(true);
        renderPanels();
        const count = imported.sections.reduce((total, section) => total + section.items.length, 0);
        const names = imported.sections.map((section) => section.title).join(", ");
        const status = adminMain.querySelector("[data-menu-import-status]");
        if (status) status.textContent = `Import reușit: ${count} produse în ${imported.sections.length} categorii (${names}). Verifică lista și apasă „Salvează modificările”.`;
      } catch (err) {
        if (importStatus) { importStatus.textContent = err.message || "Importul a eșuat."; importStatus.classList.add("is-error"); }
      }
    });
  }

  function bindMenuCategoryActions() {
    adminMain.querySelector("[data-menu-add-category]")?.addEventListener("click", () => {
      collectFormData();
      const title = "Categorie nouă";
      content.menu.sections.push({ id: `categorie-${Date.now()}`, title, items: [] });
      setDirty(true); renderPanels();
    });
    adminMain.querySelectorAll("[data-menu-section-remove]").forEach((button) => button.addEventListener("click", () => {
      if (!window.confirm("Ștergi categoria și toate produsele din ea?")) return;
      collectFormData(); content.menu.sections.splice(Number(button.dataset.menuSectionRemove), 1);
      setDirty(true); renderPanels();
    }));
    adminMain.querySelectorAll("[data-menu-section-up], [data-menu-section-down]").forEach((button) => button.addEventListener("click", () => {
      collectFormData();
      const index = Number(button.dataset.menuSectionUp ?? button.dataset.menuSectionDown);
      const next = button.hasAttribute("data-menu-section-up") ? index - 1 : index + 1;
      if (next < 0 || next >= content.menu.sections.length) return;
      [content.menu.sections[index], content.menu.sections[next]] = [content.menu.sections[next], content.menu.sections[index]];
      setDirty(true); renderPanels();
    }));
  }
  function renderNav() {
    const groups = [
      { label: "Conținut", ids: ["meta", "hero", "about", "gallery", "menu"] },
      { label: "Informații", ids: ["contact", "footer"] },
    ];
    adminNav.innerHTML = groups
      .map((group) => `<div class="admin-nav-group">
        <p class="admin-nav-label">${group.label}</p>
        <div class="admin-nav-items">
          ${group.ids
            .map((id) => {
              const section = sections.find((item) => item.id === id);
              return section
                ? `<button type="button" class="${id === activeSection ? "is-active" : ""}" data-section="${id}">${section.label}</button>`
                : "";
            })
            .join("")}
        </div>
      </div>`)
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
          setDirty(true);
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
        if (key === "hero.slides") list.push("");
        else if (key === "gallery" || key === "about.images") list.push({ src: "", alt: "" });
        else if (key.startsWith("menu.")) list.push({ name: "", price: "", desc: "" });
        else list.push({ name: "", desc: "" });
        setNested(content, key, list);
        setDirty(true);
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
        setDirty(true);
        renderPanels();
      });
    });

    adminMain.querySelectorAll("[data-move-up], [data-move-down]").forEach((btn) => {
      btn.addEventListener("click", () => {
        collectFormData();
        const key = btn.dataset.moveUp || btn.dataset.moveDown;
        const index = Number(btn.dataset.index);
        const list = getNested(content, key) || [];
        const nextIndex = btn.hasAttribute("data-move-up") ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= list.length) return;
        [list[index], list[nextIndex]] = [list[nextIndex], list[index]];
        setNested(content, key, list);
        setDirty(true);
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
    setDirty(false);
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

  adminMain.addEventListener("input", () => setDirty(true));
  adminMain.addEventListener("change", () => setDirty(true));

  window.addEventListener("beforeunload", (event) => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  saveBtn.addEventListener("click", async () => {
    if (isSaving || !isDirty) return;
    collectFormData();
    // Remove empty entries before persisting image lists.
    content.hero.slides = (content.hero.slides || []).filter((src) => String(src || "").trim());
    content.about.images = (content.about.images || []).filter((item) => item && item.src && item.src.trim());
    content.gallery = (content.gallery || []).filter((item) => item && item.src && item.src.trim());
    isSaving = true;
    setDirty(true);
    saveStatus.textContent = "Se salvează modificările…";
    saveStatus.classList.remove("is-error", "is-pending");
    try {
      const saveResult = await saveContent();
      isDirty = false;
      const branchMessage = saveResult.branch ? ` pe ramura ${saveResult.branch}` : "";
      saveStatus.textContent = `Salvat${branchMessage}. ${saveResult.menu?.productCount ?? "Conținutul"} produse / elemente confirmate în GitHub.`;
      saveStatus.classList.remove("is-error", "is-pending");
    } catch (err) {
      isDirty = true;
      saveStatus.textContent = err.message;
      saveStatus.classList.add("is-error");
      saveStatus.setAttribute("aria-live", "assertive");
      saveStatus.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally {
      isSaving = false;
      setDirty(isDirty);
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
