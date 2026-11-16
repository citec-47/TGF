(() => {
  const panel = document.querySelector("#admin-corporate-content");
  const form = document.querySelector("#corporate-content-form");
  const status = document.querySelector("#corporate-content-status");
  const loadButton = document.querySelector("#load-corporate-content");
  const saveButton = document.querySelector("#save-corporate-content");
  const updatedLabel = document.querySelector("#corporate-content-updated");
  if (!(panel instanceof HTMLElement) || !(form instanceof HTMLFormElement) ||
      !(status instanceof HTMLElement)) return;

  let content = null;
  let loading = false;

  function setStatus(message, isError = false) {
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The request could not be completed.");
    return result;
  }

  function getPath(value, path) {
    return path.split(".").reduce((current, key) => current?.[key], value);
  }

  function setPath(value, path, next) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((current, key) => current[key], value);
    target[last] = next;
  }

  function setEditorValue(element, value) {
    if (element instanceof HTMLInputElement && element.type === "checkbox") {
      element.checked = Boolean(value);
    } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = typeof value === "string" ? value : "";
    }
  }

  const listFields = {
    "about.values": [
      { key: "name", label: "Value", tag: "input", required: true },
      { key: "description", label: "Description", tag: "textarea" },
    ],
    subsidiaries: [
      { key: "name", label: "Name", tag: "input", required: true },
      { key: "description", label: "Description", tag: "textarea" },
      { key: "website", label: "Official website", tag: "input", type: "url" },
    ],
    "newsroom.items": [
      { key: "type", label: "Type", tag: "select", options: ["article", "announcement", "event", "publication", "photo", "video"] },
      { key: "title", label: "Title", tag: "input", required: true },
      { key: "date", label: "Date", tag: "input" },
      { key: "summary", label: "Description", tag: "textarea", required: true },
      { key: "link", label: "Link", tag: "input", type: "url" },
      { key: "imageUrl", label: "Image URL or site path", tag: "input", type: "text" },
    ],
    "careers.vacancies": [
      { key: "title", label: "Job title", tag: "input", required: true },
      { key: "location", label: "Location", tag: "input" },
      { key: "type", label: "Employment type", tag: "input" },
      { key: "deadline", label: "Application deadline", tag: "input" },
      { key: "description", label: "Description", tag: "textarea", required: true },
      { key: "requirements", label: "Requirements", tag: "textarea" },
      { key: "active", label: "Publish this vacancy", tag: "checkbox" },
    ],
    "contact.branches": [
      { key: "name", label: "Location name", tag: "input", required: true },
      { key: "address", label: "Address", tag: "textarea" },
      { key: "phone", label: "Phone", tag: "input", type: "tel" },
    ],
    "contact.socials": [
      { key: "name", label: "Platform / profile", tag: "input", required: true },
      { key: "url", label: "Profile URL", tag: "input", type: "url", required: true },
    ],
  };

  function makeInput(field, value) {
    const wrapper = document.createElement("div");
    wrapper.className = "corporate-content-item-field";
    const label = document.createElement("label");
    label.textContent = field.label;
    const input = field.tag === "textarea"
      ? document.createElement("textarea")
      : field.tag === "select"
        ? document.createElement("select")
        : document.createElement("input");
    input.dataset.cmsKey = field.key;
    if (field.tag === "select") {
      for (const optionValue of field.options) {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue[0].toUpperCase() + optionValue.slice(1);
        input.append(option);
      }
    } else if (input instanceof HTMLInputElement) {
      input.type = field.tag === "checkbox" ? "checkbox" : field.type || "text";
      if (field.tag === "checkbox") {
        input.checked = value === true;
      } else {
        input.value = typeof value === "string" ? value : "";
      }
    } else {
      input.value = typeof value === "string" ? value : "";
      input.rows = 3;
    }
    if (field.required) input.required = true;
    label.append(input);
    wrapper.append(label);
    return wrapper;
  }

  function renderList(path, items) {
    const container = form.querySelector(`[data-cms-list="${path}"]`);
    if (!(container instanceof HTMLElement)) return;
    container.replaceChildren();
    for (const [index, item] of items.entries()) {
      const card = document.createElement("fieldset");
      card.className = "corporate-content-item";
      card.dataset.cmsItem = String(index);
      const legend = document.createElement("legend");
      legend.textContent = `${path.split(".").pop()} ${index + 1}`;
      card.append(legend);
      const fields = document.createElement("div");
      fields.className = "corporate-content-item-grid";
      for (const field of listFields[path]) {
        fields.append(makeInput(field, item[field.key]));
      }
      card.append(fields);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-action small-action-danger";
      remove.dataset.cmsRemove = path;
      remove.textContent = "Remove";
      card.append(remove);
      container.append(card);
    }
  }

  function fillEditor(nextContent, updatedAt) {
    content = nextContent;
    for (const field of form.querySelectorAll("[data-cms-field]")) {
      setEditorValue(field, getPath(content, field.dataset.cmsField));
    }
    for (const field of form.querySelectorAll("[data-cms-text-list]")) {
      const values = getPath(content, field.dataset.cmsTextList);
      field.value = Array.isArray(values) ? values.join("\n") : "";
    }
    for (const [path, fields] of Object.entries(listFields)) {
      const items = getPath(content, path);
      renderList(path, Array.isArray(items) ? items : []);
    }
    if (updatedLabel instanceof HTMLElement) {
      updatedLabel.textContent = updatedAt
        ? `Last published ${new Date(updatedAt).toLocaleString()}.`
        : "Showing the verified starter content. Publish to save your first version.";
    }
  }

  async function load() {
    if (loading) return;
    loading = true;
    if (loadButton instanceof HTMLButtonElement) loadButton.disabled = true;
    setStatus("Loading corporate website content…");
    try {
      const result = await request("/api/admin/site-content");
      if (!result.content || typeof result.content !== "object") {
        throw new Error("The corporate content response is invalid.");
      }
      fillEditor(result.content, result.updatedAt);
      setStatus("Corporate website content loaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Corporate website content could not be loaded.", true);
    } finally {
      loading = false;
      if (loadButton instanceof HTMLButtonElement) loadButton.disabled = false;
    }
  }

  function collect() {
    if (!content) throw new Error("Load the published content before saving.");
    const next = structuredClone(content);
    for (const field of form.querySelectorAll("[data-cms-field]")) {
      const path = field.dataset.cmsField;
      const value = field instanceof HTMLInputElement && field.type === "checkbox"
        ? field.checked
        : field.value.trim();
      setPath(next, path, value);
    }
    for (const field of form.querySelectorAll("[data-cms-text-list]")) {
      const lines = field.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      setPath(next, field.dataset.cmsTextList, lines);
    }
    for (const [path, fields] of Object.entries(listFields)) {
      const container = form.querySelector(`[data-cms-list="${path}"]`);
      const items = [...(container?.querySelectorAll("[data-cms-item]") || [])].map((card) => {
        const item = {};
        for (const field of fields) {
          const input = card.querySelector(`[data-cms-key="${field.key}"]`);
          item[field.key] = input instanceof HTMLInputElement && input.type === "checkbox"
            ? input.checked
            : input?.value.trim() || "";
        }
        return item;
      });
      setPath(next, path, items);
    }
    return next;
  }

  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const path = target.dataset.cmsAdd || target.dataset.cmsRemove;
    if (!path || !listFields[path]) return;
    event.preventDefault();
    try {
      const items = collect();
      if (target.dataset.cmsAdd) {
        const item = {};
        for (const field of listFields[path]) {
          item[field.key] = field.key === "type" ? field.options[0] : field.key === "active" ? true : "";
        }
        getPath(items, path).push(item);
      } else {
        const card = target.closest("[data-cms-item]");
        const index = Number(card?.dataset.cmsItem);
        if (Number.isInteger(index)) getPath(items, path).splice(index, 1);
      }
      content = items;
      renderList(path, getPath(content, path));
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The list could not be updated.", true);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (saveButton instanceof HTMLButtonElement) saveButton.disabled = true;
    setStatus("Publishing corporate website content…");
    try {
      const next = collect();
      const result = await request("/api/admin/site-content", {
        method: "PUT",
        body: JSON.stringify({ content: next }),
      });
      fillEditor(result.content, new Date().toISOString());
      setStatus(result.message || "Corporate website content published.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Corporate website content could not be published.", true);
    } finally {
      if (saveButton instanceof HTMLButtonElement) saveButton.disabled = false;
    }
  });

  if (loadButton instanceof HTMLButtonElement) loadButton.addEventListener("click", () => void load());
  document.querySelectorAll('[data-admin-view="corporate-content"]').forEach((button) => {
    button.addEventListener("click", () => {
      if (!content) void load();
    });
  });
  document.addEventListener("tgf-account-authenticated", () => {
    if (!panel.hidden && !content) void load();
  });
})();
