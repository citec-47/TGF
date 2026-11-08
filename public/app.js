const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
const enquiryForm = document.querySelector("#enquiry-form");
const interestField = document.querySelector("#enquiry-interest");
const nameField = document.querySelector("#enquiry-name");
const messageField = document.querySelector("#enquiry-message");
const locationGrid = document.querySelector("#location-grid");
const locationStatus = document.querySelector("#location-status");

async function loadSiteSettings() {
  try {
    const response = await fetch("/api/site-settings");
    if (!response.ok) throw new Error("Website settings are unavailable.");
    const settings = await response.json();
    if (typeof settings.accentColor === "string" && /^#[\da-f]{6}$/i.test(settings.accentColor)) {
      document.documentElement.style.setProperty("--orange", settings.accentColor);
    }

    const flyer = document.querySelector("#public-flyer");
    if (flyer instanceof HTMLImageElement && typeof settings.flyerImageUrl === "string") {
      flyer.src = settings.flyerImageUrl;
    }

    const resumptionTitle = document.querySelector("#resumption-title");
    const resumptionCopy = document.querySelector("#resumption-copy");
    if (
      typeof settings.resumptionDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(settings.resumptionDate) &&
      resumptionTitle &&
      resumptionCopy
    ) {
      const date = new Date(`${settings.resumptionDate}T00:00:00Z`);
      resumptionTitle.textContent = settings.resumptionLabel || "Training resumes";
      resumptionCopy.textContent = new Intl.DateTimeFormat("en-CM", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(date);
    }
  } catch {
    const resumptionCopy = document.querySelector("#resumption-copy");
    if (resumptionCopy) {
      resumptionCopy.textContent =
        "Current intake details are temporarily unavailable. Contact admissions to confirm.";
    }
  }
}

async function loadLocations() {
  if (!(locationGrid instanceof HTMLElement)) return;

  try {
    const response = await fetch("/api/locations");
    if (!response.ok) throw new Error("Location service is unavailable.");
    const locations = await response.json();
    if (!Array.isArray(locations)) throw new Error("Location data is invalid.");

    locationGrid.replaceChildren(
      ...locations.map((location) => {
        const card = document.createElement("article");
        card.className = "location-card";
        if (location.imageUrl) {
          const image = document.createElement("img");
          image.className = "location-photo";
          image.src = location.imageUrl;
          image.alt = `Photograph of ${location.city}`;
          image.loading = "lazy";
          card.append(image);
        }

        const pin = document.createElement("span");
        pin.className = "location-pin";
        pin.setAttribute("aria-hidden", "true");
        pin.textContent = "↗";

        const region = document.createElement("p");
        region.className = "micro-label";
        region.textContent = location.region || "Cameroon";

        const city = document.createElement("h3");
        city.textContent = location.city;

        const address = document.createElement("p");
        address.textContent = location.address || "Contact admissions for location details.";

        card.append(pin, region, city, address);
        if (location.description) {
          const description = document.createElement("p");
          description.className = "location-description";
          description.textContent = location.description;
          card.append(description);
        }
        return card;
      }),
    );
    if (locationStatus) locationStatus.textContent = "";
  } catch {
    if (locationStatus) {
      locationStatus.textContent =
        "Showing the listed locations. The latest updates are temporarily unavailable.";
    }
  }
}

void loadLocations();
void loadSiteSettings();

if (menuButton instanceof HTMLButtonElement && navigation instanceof HTMLElement) {
  const closeMenu = () => {
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
    navigation.classList.remove("is-open");
  };

  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
    navigation.classList.toggle("is-open", !isOpen);
  });

  navigation.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) closeMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });
}

document.querySelectorAll("[data-programme]").forEach((link) => {
  link.addEventListener("click", () => {
    const programme = link.getAttribute("data-programme");
    if (programme && interestField instanceof HTMLSelectElement) {
      interestField.value = programme;
    }
  });
});

if (
  enquiryForm instanceof HTMLFormElement &&
  interestField instanceof HTMLSelectElement &&
  nameField instanceof HTMLInputElement &&
  messageField instanceof HTMLTextAreaElement
) {
  enquiryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameField.value.trim();

    if (!name) {
      nameField.focus();
      return;
    }

    const message = [
      `Hello TGFVP, my name is ${name}.`,
      `I am interested in: ${interestField.value}.`,
      messageField.value.trim() ? `My question: ${messageField.value.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    window.location.assign(`https://wa.me/237671049642?text=${encodeURIComponent(message)}`);
  });
}

const yearLabel = document.querySelector("#current-year");
if (yearLabel) yearLabel.textContent = String(new Date().getFullYear());
