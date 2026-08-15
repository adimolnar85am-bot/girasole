(async () => {
  if (window.GirasoleContent) {
    await window.GirasoleContent.loadSiteContent();
  }

  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  const form = document.getElementById("reservation-form");
  const status = document.querySelector("[data-form-status]");

  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-solid", window.scrollY > 24);
    document.querySelector(".hero")?.classList.toggle("is-scrolled", window.scrollY > 40);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && mobileNav) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      mobileNav.hidden = open;
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        toggle.setAttribute("aria-expanded", "false");
        mobileNav.hidden = true;
      });
    });
  }

  const slides = [...document.querySelectorAll("[data-hero-slide]")];
  if (slides.length > 1) {
    let index = 0;
    setInterval(() => {
      slides[index].classList.remove("is-active");
      index = (index + 1) % slides.length;
      slides[index].classList.add("is-active");
    }, 6500);
  }

  const revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  const dateInput = form?.querySelector('input[name="date"]');
  let todayIso = "";
  if (dateInput) {
    const today = new Date();
    todayIso = today.toISOString().slice(0, 10);
    dateInput.min = todayIso;
    if (!dateInput.value) dateInput.value = todayIso;
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      status.textContent = "Completează toate câmpurile obligatorii.";
      status.classList.add("is-error");
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const summary = [
      `Nume: ${data.get("name")}`,
      `Telefon: ${data.get("phone")}`,
      `Email: ${data.get("email")}`,
      `Persoane: ${data.get("guests")}`,
      `Data: ${data.get("date")}`,
      `Ora: ${data.get("time")}`,
      data.get("message") ? `Mesaj: ${data.get("message")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    status.classList.remove("is-error");
    status.textContent = "Rezervarea a fost pregătită. Se deschide emailul tău…";

    const reservationEmail = window.__RESERVATION_EMAIL__ || "hello@girasole.bucuresti";
    const subject = encodeURIComponent("Rezervare Girasole");
    const body = encodeURIComponent(summary);
    window.location.href = `mailto:${reservationEmail}?subject=${subject}&body=${body}`;

    form.reset();
    if (dateInput && todayIso) dateInput.value = todayIso;
  });
})();
