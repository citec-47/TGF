(() => {
  const contentEndpoint = "/api/public/site-content";

  function getPath(value, path) {
    return path.split(".").reduce((current, key) => current?.[key], value);
  }

  function makeTextElement(tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    return element;
  }

  function renderSimpleList(path, values, tag = "li") {
    const list = document.querySelector(`[data-corp-list="${path}"]`);
    if (!(list instanceof HTMLElement)) return;
    list.replaceChildren();
    for (const [index, value] of values.entries()) {
      if (typeof value !== "string" || !value.trim()) continue;
      if (path === "community.points") {
        const row = makeTextElement("p", "", "");
        const number = makeTextElement("span", "", String(index + 1).padStart(2, "0"));
        number.setAttribute("aria-hidden", "true");
        row.append(number, document.createTextNode(` ${value}`));
        list.append(row);
        continue;
      }
      const element = makeTextElement(tag, "", value);
      if (path === "tgfvp.courses") {
        element.className = "corp-course";
      }
      list.append(element);
    }
    if (path === "about.objectives") {
      const section = list.closest(".corp-objectives");
      if (section) section.hidden = list.childElementCount === 0;
    }
  }

  function renderValues(values) {
    const list = document.querySelector('[data-corp-list="about.values"]');
    if (!(list instanceof HTMLOListElement)) return;
    list.replaceChildren();
    values.forEach((value, index) => {
      const item = document.createElement("li");
      item.append(makeTextElement("span", "", String(index + 1).padStart(2, "0")));
      const details = document.createElement("div");
      details.append(makeTextElement("strong", "", value.name));
      details.append(makeTextElement("p", "", value.description));
      item.append(details);
      list.append(item);
    });
  }

  function renderSubsidiaries(items) {
    const list = document.querySelector('[data-corp-list="subsidiaries"]');
    if (!(list instanceof HTMLElement)) return;
    list.replaceChildren();
    for (const [index, item] of items.entries()) {
      const card = document.createElement("article");
      card.className = "corp-company-card";
      const initial = makeTextElement("span", "corp-company-letter", item.name.slice(0, 1));
      initial.setAttribute("aria-hidden", "true");
      card.append(initial);
      card.append(makeTextElement("p", "micro-label", "TGF Group subsidiary"));
      card.append(makeTextElement("h3", "", item.name));
      if (item.description) card.append(makeTextElement("p", "", item.description));
      if (item.website) {
        const link = document.createElement("a");
        link.className = "corp-company-link";
        link.href = item.website;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Visit official website";
        card.append(link);
      } else {
        card.append(makeTextElement("span", "corp-link-unavailable", "Official website link not yet provided"));
      }
      list.append(card);
    }
  }

  function renderNews(items) {
    const list = document.querySelector('[data-corp-list="newsroom.items"]');
    const empty = document.querySelector("[data-corp-news-empty]");
    if (!(list instanceof HTMLElement) || !(empty instanceof HTMLElement)) return;
    const published = items.filter((item) => item.title && item.summary);
    list.replaceChildren();
    for (const item of published) {
      const card = document.createElement("article");
      card.className = "corp-news-card";
      if (item.imageUrl) {
        const image = document.createElement("img");
        image.src = item.imageUrl;
        image.alt = "";
        image.loading = "lazy";
        card.append(image);
      }
      const category = makeTextElement("p", "micro-label", item.type);
      card.append(category);
      if (item.date) card.append(makeTextElement("p", "corp-news-date", item.date));
      card.append(makeTextElement("h3", "", item.title));
      card.append(makeTextElement("p", "", item.summary));
      if (item.link) {
        const link = document.createElement("a");
        link.href = item.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Read more";
        card.append(link);
      }
      list.append(card);
    }
    empty.hidden = published.length > 0;
    list.hidden = published.length === 0;
  }

  function renderVacancies(items) {
    const list = document.querySelector('[data-corp-list="careers.vacancies"]');
    if (!(list instanceof HTMLElement)) return;
    const vacancies = items.filter((item) => item.active);
    list.replaceChildren();
    list.hidden = vacancies.length === 0;
    for (const vacancy of vacancies) {
      const card = document.createElement("article");
      card.className = "corp-vacancy-card";
      const title = makeTextElement("h3", "", vacancy.title);
      card.append(makeTextElement("p", "micro-label", "Current vacancy"), title);
      const meta = [vacancy.location, vacancy.type, vacancy.deadline ? `Apply by ${vacancy.deadline}` : ""]
        .filter(Boolean)
        .join(" · ");
      if (meta) card.append(makeTextElement("p", "corp-vacancy-meta", meta));
      card.append(makeTextElement("p", "", vacancy.description));
      if (vacancy.requirements) card.append(makeTextElement("p", "", `Requirements: ${vacancy.requirements}`));
      const apply = document.createElement("a");
      apply.className = "button button-orange";
      apply.href = "#career-application-form";
      apply.textContent = "Apply with CV";
      apply.addEventListener("click", () => {
        const interest = document.querySelector("#career-interest");
        if (interest instanceof HTMLInputElement && !interest.value) interest.value = vacancy.title;
      });
      card.append(apply);
      list.append(card);
    }
  }

  function appendContactDetail(parent, label, title, detail, href = "") {
    const article = document.createElement("article");
    article.append(makeTextElement("p", "micro-label", label));
    article.append(makeTextElement("h3", "", title));
    const text = makeTextElement("p", "", "");
    if (href && detail) {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = detail;
      text.append(link);
    } else {
      text.textContent = detail;
    }
    article.append(text);
    parent.append(article);
  }

  function renderContact(contact, admissionsPhone) {
    const container = document.querySelector("[data-corp-contact]");
    if (!(container instanceof HTMLElement)) return;
    const domainNote = container.querySelector(".corp-domain-note");
    container.replaceChildren();
    const office = contact.headOffice;
    if (office.name || office.address || office.phone || office.email) {
      const detail = [office.address, office.phone, office.email].filter(Boolean).join(" · ");
      appendContactDetail(container, "Head office", office.name || "Transgenerational Forces Group", detail);
    }
    for (const branch of contact.branches) {
      if (branch.name || branch.address || branch.phone) {
        appendContactDetail(container, "Branch / location", branch.name, [branch.address, branch.phone].filter(Boolean).join(" · "));
      }
    }
    if (admissionsPhone) {
      appendContactDetail(container, "TGFVP admissions", "Vocational Pathways", admissionsPhone, `tel:${admissionsPhone.replace(/[^\d+]/g, "")}`);
    }
    for (const social of contact.socials) {
      const article = document.createElement("article");
      article.append(makeTextElement("p", "micro-label", "Social media"));
      const link = document.createElement("a");
      link.href = social.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = social.name;
      const details = makeTextElement("p", "", "");
      details.append(link);
      article.append(details);
      container.append(article);
    }
    if (!office.name && !office.address && !office.phone && !office.email &&
        contact.branches.length === 0 && !admissionsPhone && contact.socials.length === 0) {
      appendContactDetail(container, "Contact details", "Information not yet available", "Verified corporate contact details have not been provided.");
    }
    if (domainNote) container.append(domainNote);
  }

  function renderContent(content) {
    for (const element of document.querySelectorAll("[data-corp-content]")) {
      const value = getPath(content, element.dataset.corpContent);
      if (typeof value === "string") element.textContent = value;
    }
    renderSimpleList("about.objectives", content.about.objectives);
    renderValues(content.about.values);
    renderSubsidiaries(content.subsidiaries);
    renderSimpleList("tgfea.objectives", content.tgfea.objectives);
    renderSimpleList("tgfea.awardCategories", content.tgfea.awardCategories);
    renderSimpleList("tgfvp.courses", content.tgfvp.courses, "span");
    renderSimpleList("tgfvp.benefits", content.tgfvp.benefits);
    renderNews(content.newsroom.items);
    renderVacancies(content.careers.vacancies);
    renderSimpleList("community.points", content.community.points);
    renderContact(content.contact, content.tgfvp.admissionsPhone);
  }

  fetch(contentEndpoint, { credentials: "same-origin", cache: "no-store" })
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Corporate website content could not be loaded.");
      if (!result.content || typeof result.content !== "object") {
        throw new Error("The corporate website content response is invalid.");
      }
      renderContent(result.content);
    })
    .catch((error) => {
      console.error("Corporate website content could not be loaded.", error);
    });
})();

const publicForms = [
  {
    form: document.querySelector("#career-application-form"),
    endpoint: "/api/public-submissions/careers",
    status: document.querySelector("#career-application-status"),
  },
  {
    form: document.querySelector("#community-form"),
    endpoint: "/api/public-submissions/community",
    status: document.querySelector("#community-status"),
  },
  {
    form: document.querySelector("#contact-form"),
    endpoint: "/api/public-submissions/contact",
    status: document.querySelector("#contact-status"),
  },
];

for (const { form, endpoint, status } of publicForms) {
  if (!(form instanceof HTMLFormElement) || !(status instanceof HTMLElement)) continue;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('button[type="submit"]');
    if (!(submitButton instanceof HTMLButtonElement)) return;
    submitButton.disabled = true;
    status.classList.remove("is-error");
    status.textContent = "Sending your submission…";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        body: new FormData(form),
        credentials: "same-origin",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "Your submission could not be saved.");
      }
      if (typeof result.message !== "string") {
        throw new Error("The server returned an invalid submission response.");
      }
      form.reset();
      status.textContent = result.message;
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = error instanceof Error
        ? error.message
        : "Your submission could not be saved. Please try again.";
    } finally {
      submitButton.disabled = false;
    }
  });
}
