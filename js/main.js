(() => {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav]");
  const slides = [...document.querySelectorAll("[data-hero-slide]")];
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
  if (dateInput) {
    const today = new Date();
    const iso = today.toISOString().slice(0, 10);
    dateInput.min = iso;
    if (!dateInput.value) dateInput.value = iso;
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

    const subject = encodeURIComponent("Rezervare Girasole");
    const body = encodeURIComponent(summary);
    window.location.href = `mailto:hello@girasole.bucuresti?subject=${subject}&body=${body}`;

    form.reset();
    if (dateInput) dateInput.value = iso;
  });
})();
