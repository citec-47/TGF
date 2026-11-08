const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".primary-navigation");
const enquiryForm = document.querySelector("#enquiry-form");
const interestField = document.querySelector("#enquiry-interest");
const nameField = document.querySelector("#enquiry-name");
const messageField = document.querySelector("#enquiry-message");
const locationGrid = document.querySelector("#location-grid");
const locationStatus = document.querySelector("#location-status");
const leadershipGroups = document.querySelector("#leadership-groups");
const programmeGrid = document.querySelector(".programme-grid");

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

async function loadBoardMembers() {
  if (!(leadershipGroups instanceof HTMLElement)) return;
  try {
    const response = await fetch("/api/board-members");
    if (!response.ok) throw new Error("Board directory is unavailable.");
    const members = await response.json();
    if (!Array.isArray(members)) throw new Error("Board directory response is invalid.");
    if (!members.length) return;

    const groups = new Map();
    for (const member of members) {
      if (!groups.has(member.hierarchyGroup)) groups.set(member.hierarchyGroup, []);
      groups.get(member.hierarchyGroup).push(member);
    }

    const content = [];
    for (const [groupName, groupMembers] of groups) {
      const section = document.createElement("section");
      section.className = "leadership-group";
      const heading = document.createElement("h3");
      heading.textContent = groupName;
      const cards = document.createElement("div");
      cards.className = "leadership-group-grid";
      for (const member of groupMembers) {
        const card = document.createElement("article");
        card.className = "leadership-card";
        const image = document.createElement("img");
        if (member.photoUrl) {
          image.src = member.photoUrl;
          image.alt = `Portrait of ${member.fullName}`;
          image.loading = "lazy";
        } else {
          image.alt = "";
          image.src =
            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 320'%3E%3Crect width='400' height='320' fill='%2324211d'/%3E%3Ctext x='200' y='180' text-anchor='middle' font-family='Arial' font-size='100' fill='%23f47d20'%3ETGF%3C/text%3E%3C/svg%3E";
          image.setAttribute("aria-hidden", "true");
        }
        const copy = document.createElement("div");
        copy.className = "leadership-card-copy";
        const title = document.createElement("p");
        title.className = "micro-label";
        title.textContent = member.positionTitle;
        const name = document.createElement("h4");
        name.textContent = member.fullName;
        copy.append(title, name);
        if (member.biography) {
          const biography = document.createElement("p");
          biography.textContent = member.biography;
          copy.append(biography);
        }
        card.append(image, copy);
        cards.append(card);
      }
      section.append(heading, cards);
      content.push(section);
    }
    leadershipGroups.replaceChildren(...content);
  } catch {
    const notice = document.createElement("p");
    notice.className = "leadership-empty";
    notice.textContent = "Board profiles are temporarily unavailable. Please check back soon.";
    leadershipGroups.replaceChildren(notice);
  }
}

async function loadProgrammes() {
  if (!(programmeGrid instanceof HTMLElement)) return;
  try {
    const response = await fetch("/api/programmes");
    if (!response.ok) throw new Error("Programmes are unavailable.");
    const programmes = await response.json();
    if (!Array.isArray(programmes) || !programmes.length) return;
    const iconClasses = [
      "icon-code",
      "icon-idea",
      "icon-marketing",
      "icon-electronics",
      "icon-driving",
      "icon-mechanics",
    ];
    const icons = ["</>", "↗", "◎", "ϟ", "→", "✳"];
    const cards = programmes.map((programme, index) => {
      const card = document.createElement("article");
      card.className = "programme-card";
      const number = document.createElement("span");
      number.className = "programme-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const icon = document.createElement("span");
      icon.className = `programme-icon ${iconClasses[index % iconClasses.length]}`;
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = icons[index % icons.length];
      const category = document.createElement("p");
      category.className = "programme-category";
      category.textContent =
        /software|engineering/i.test(programme.title) ? "Technology" :
          /career|entrepreneur/i.test(programme.title) ? "Business" :
            /marketing|creative|digital/i.test(programme.title) ? "Creative & digital" :
              /driving|road/i.test(programme.title) ? "Transport" :
                /mechanic|automotive/i.test(programme.title) ? "Automotive" :
                  "Vocational training";
      const title = document.createElement("h3");
      title.textContent = programme.title;
      const link = document.createElement("a");
      link.className = "card-link";
      link.href = "#contact";
      link.dataset.programme = programme.title;
      const arrow = document.createElement("span");
      arrow.textContent = "↗";
      arrow.setAttribute("aria-hidden", "true");
      link.append(
        document.createTextNode("Enquire about this programme "),
        arrow,
      );
      link.addEventListener("click", () => {
        if (interestField instanceof HTMLSelectElement) {
          const knownOption = [...interestField.options].find(
            (option) => option.value === programme.title,
          );
          if (knownOption) interestField.value = programme.title;
          else {
            const option = document.createElement("option");
            option.value = programme.title;
            option.textContent = programme.title;
            interestField.append(option);
            interestField.value = programme.title;
          }
        }
      });
      card.append(number, icon, category, title);
      if (programme.description) {
        const description = document.createElement("p");
        description.className = "programme-description";
        description.textContent = programme.description;
        card.append(description);
      }
      card.append(link);
      return card;
    });
    programmeGrid.replaceChildren(...cards);
  } catch {
    return;
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
void loadBoardMembers();
void loadProgrammes();

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
