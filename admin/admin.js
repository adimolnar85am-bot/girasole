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
            <p>Încarcă un fișier Excel sau JSON pentru a actualiza produsele și ordinea lor. Importul înlocuiește categoriile prezente în fișier.</p>
            <p class="menu-import-format">Excel: foi numite <strong>Panini</strong> și <strong>Caffe</strong>, coloane <strong>Pozitie</strong>, <strong>Produs</strong>, <strong>Pret</strong>, <strong>Descriere</strong>. Pentru o singură foaie, include și coloana <strong>Categorie</strong>.</p>
          </div>
          <div class="menu-import-actions">
            <button type="button" class="btn btn-ghost" data-menu-template>Descarcă Excel</button>
            <button type="button" class="btn btn-ghost" data-menu-export>Exportă JSON</button>
            <label class="btn btn-primary menu-import-file-label">
              Importă fișier
              <input type="file" accept=".xlsx,.xls,.csv,.json,application/json" hidden data-menu-import-file />
            </label>
          </div>
          <p class="menu-import-status" data-menu-import-status role="status">Descarcă Excelul actual, editează produsele și reîncarcă-l.</p>
        </div>
        <h3 class="menu-category-title">Panini</h3>
        ${renderListEditor("menu.panini", content.menu.panini, [
          { label: "Nume", name: "name" },
          { label: "Preț", name: "price" },
          { label: "Descriere", name: "desc", type: "textarea", rows: 2 },
        ])}
        <h3 class="menu-category-title">Caffè</h3>
        ${renderListEditor("menu.caffe", content.menu.caffe, [
          { label: "Nume", name: "name" },
          { label: "Preț", name: "price" },
          { label: "Descriere", name: "desc", type: "textarea", rows: 2 },
        ])}
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
  }

  function menuExportData() {
    collectFormData();
    const toRows = (items) =>
      (items || [])
        .filter((item) => item && String(item.name || "").trim())
        .map((item, index) => ({
          position: index + 1,
          name: String(item.name || "").trim(),
          price: String(item.price ?? "").trim(),
          desc: String(item.desc ?? "").trim(),
        }));

    return {
      panini: toRows(content.menu.panini),
      caffe: toRows(content.menu.caffe),
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
    downloadFile(
      "girasole-meniu.json",
      JSON.stringify(data, null, 2),
      "application/json;charset=utf-8"
    );
  }

  let xlsxLibraryPromise = null;

  function loadXlsxLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxLibraryPromise) return xlsxLibraryPromise;

    xlsxLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
      script.async = true;
      script.onload = () => {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error("Nu am putut inițializa biblioteca Excel."));
      };
      script.onerror = () => {
        xlsxLibraryPromise = null;
        reject(new Error("Biblioteca Excel nu s-a putut încărca. Încearcă importul JSON."));
      };
      document.head.appendChild(script);
    });

    return xlsxLibraryPromise;
  }

  async function downloadMenuExcel() {
    const XLSX = await loadXlsxLibrary();
    const data = menuExportData();
    const workbook = XLSX.utils.book_new();

    const addSheet = (name, rows) => {
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((item) => ({
          Pozitie: item.position,
          Produs: item.name,
          Pret: item.price,
          Descriere: item.desc,
        })),
        { header: ["Pozitie", "Produs", "Pret", "Descriere"] }
      );
      sheet["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 14 }, { wch: 58 }];
      XLSX.utils.book_append_sheet(workbook, sheet, name);
    };

    addSheet("Panini", data.panini);
    addSheet("Caffe", data.caffe);
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

  function normalizeJsonMenu(parsed) {
    const source = parsed?.menu && typeof parsed.menu === "object" ? parsed.menu : parsed;
    const result = {};

    ["panini", "caffe"].forEach((category) => {
      if (Object.prototype.hasOwnProperty.call(source || {}, category)) {
        result[category] = normalizeMenuRows(source[category], category === "panini" ? "Panini" : "Caffe");
      }
    });

    const genericItems = source?.items || source?.products;
    if (!Object.keys(result).length && Array.isArray(genericItems)) {
      result.panini = [];
      result.caffe = [];
      genericItems.forEach((item, index) => {
        const category = normalizeColumn(getRowValue({ category: item.category || item.categorie || item.type || "" }, ["category"]));
        if (["panini", "panino", "sandwich", "sandwiches"].includes(category)) {
          result.panini.push({ ...item, position: item.position ?? item.pozitie ?? index + 1 });
        } else if (["caffe", "cafe", "cafea", "coffee", "bauturi", "drink", "drinks"].includes(category)) {
          result.caffe.push({ ...item, position: item.position ?? item.pozitie ?? index + 1 });
        } else {
          throw new Error(`Categorie necunoscută pentru produsul ${item.name || item.nume || index + 1}.`);
        }
      });
      result.panini = normalizeMenuRows(result.panini, "Panini");
      result.caffe = normalizeMenuRows(result.caffe, "Caffe");
    }

    if (!Object.keys(result).length) {
      throw new Error("JSON invalid. Folosește cheile «panini» și «caffe», fiecare cu nume, pret și descriere.");
    }
    return result;
  }

  function parseWorkbookMenu(workbook, XLSX) {
    const result = {};
    const names = workbook.SheetNames || [];
    const normalizedNames = names.map((name) => ({ name, key: normalizeColumn(name) }));
    const paniniSheet = normalizedNames.find((sheet) => sheet.key.includes("panini"));
    const caffeSheet = normalizedNames.find((sheet) =>
      ["caffe", "cafe", "cafea", "coffee", "bauturi", "drinks"].some((key) => sheet.key.includes(key))
    );

    if (paniniSheet) {
      result.panini = normalizeMenuRows(
        XLSX.utils.sheet_to_json(workbook.Sheets[paniniSheet.name], { defval: "", raw: false }),
        "Panini"
      );
    }
    if (caffeSheet) {
      result.caffe = normalizeMenuRows(
        XLSX.utils.sheet_to_json(workbook.Sheets[caffeSheet.name], { defval: "", raw: false }),
        "Caffe"
      );
    }
    if (Object.keys(result).length) return result;

    const genericSheet = normalizedNames.find((sheet) =>
      ["meniu", "menu", "produse", "products"].includes(sheet.key)
    ) || normalizedNames[0];
    if (!genericSheet) throw new Error("Fișierul Excel nu conține foi cu produse.");

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[genericSheet.name], { defval: "", raw: false });
    const grouped = { panini: [], caffe: [] };
    rows.forEach((row, index) => {
      const category = normalizeColumn(getRowValue(row, ["categorie", "category", "sectiune", "section", "tip", "type", "grup"]));
      if (!category) {
        const hasContent = Object.values(row).some((value) => String(value ?? "").trim() !== "");
        if (hasContent) throw new Error("Pentru o singură foaie Excel, adaugă o coloană «Categorie» cu valorile Panini sau Caffe.");
        return;
      }
      const item = { ...row, position: getRowValue(row, ["pozitie", "position", "ordine", "order"]) || index + 1 };
      if (["panini", "panino", "sandwich", "sandwiches"].includes(category)) grouped.panini.push(item);
      else if (["caffe", "cafe", "cafea", "coffee", "bauturi", "drink", "drinks"].includes(category)) grouped.caffe.push(item);
      else throw new Error(`Categorie necunoscută la rândul ${index + 2}: ${category}.`);
    });

    if (!grouped.panini.length && !grouped.caffe.length) {
      throw new Error("Nu am găsit produse. Verifică foile Panini/Caffe sau coloana Categorie.");
    }
    if (grouped.panini.length) {
      result.panini = normalizeMenuRows(grouped.panini, "Panini");
    }
    if (grouped.caffe.length) {
      result.caffe = normalizeMenuRows(grouped.caffe, "Caffe");
    }
    return result;
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
      throw new Error("Format neacceptat. Încarcă un fișier .xlsx, .xls, .csv sau .json.");
    }

    const XLSX = await loadXlsxLibrary();
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    return parseWorkbookMenu(workbook, XLSX);
  }

  function bindMenuImportActions() {
    const fileInput = adminMain.querySelector("[data-menu-import-file]");
    const importStatus = adminMain.querySelector("[data-menu-import-status]");
    const templateButton = adminMain.querySelector("[data-menu-template]");
    const exportButton = adminMain.querySelector("[data-menu-export]");

    exportButton?.addEventListener("click", () => {
      try {
        downloadMenuJson();
        if (importStatus) importStatus.textContent = "Meniul curent a fost exportat în JSON.";
      } catch (err) {
        if (importStatus) importStatus.textContent = err.message;
      }
    });

    templateButton?.addEventListener("click", async () => {
      if (importStatus) importStatus.textContent = "Se pregătește fișierul Excel…";
      try {
        await downloadMenuExcel();
        if (importStatus) importStatus.textContent = "Excelul editabil a fost descărcat.";
      } catch (err) {
        if (importStatus) {
          importStatus.textContent = err.message;
          importStatus.classList.add("is-error");
        }
      }
    });

    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      if (importStatus) {
        importStatus.textContent = `Se verifică ${file.name}…`;
        importStatus.classList.remove("is-error");
      }

      try {
        const imported = await parseMenuFile(file);
        const categories = Object.keys(imported);
        if (!categories.length) throw new Error("Fișierul nu conține categorii de meniu.");
        collectFormData();
        categories.forEach((category) => {
          content.menu[category] = imported[category];
        });
        setDirty(true);
        renderPanels();
        const summary = categories.map((category) =>
          category === "panini" ? "Panini" : "Caffe"
        ).join(" și ");
        const count = categories.reduce((total, category) => total + imported[category].length, 0);
        const status = adminMain.querySelector("[data-menu-import-status]");
        if (status) status.textContent = `Import reușit: ${count} produse în ${summary}. Verifică lista și apasă „Salvează modificările”.`;
      } catch (err) {
        if (importStatus) {
          importStatus.textContent = err.message || "Importul a eșuat.";
          importStatus.classList.add("is-error");
        }
      }
    });
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
      await saveContent();
      isDirty = false;
      saveStatus.textContent = "Salvat. Modificările sunt publicate pe site.";
      saveStatus.classList.remove("is-error", "is-pending");
    } catch (err) {
      isDirty = true;
      saveStatus.textContent = err.message;
      saveStatus.classList.add("is-error");
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
