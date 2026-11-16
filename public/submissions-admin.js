(() => {
  const panel = document.querySelector("#admin-public-submissions");
  const list = document.querySelector("#public-submission-list");
  const message = document.querySelector("#public-submissions-message");
  const count = document.querySelector("#public-submissions-count");
  const navCount = document.querySelector("#public-submissions-nav-count");
  const filter = document.querySelector("#public-submissions-filter");
  const refreshButton = document.querySelector("#refresh-public-submissions");
  const previousButton = document.querySelector("#public-submissions-previous");
  const nextButton = document.querySelector("#public-submissions-next");
  const pageLabel = document.querySelector("#public-submissions-page");
  if (!(panel instanceof HTMLElement) || !(list instanceof HTMLElement) ||
      !(message instanceof HTMLElement) || !(filter instanceof HTMLSelectElement)) return;

  const state = { submissions: [], totalCount: 0, newCount: 0, offset: 0, limit: 100, loading: false };
  const labels = {
    career: "Career application",
    community: "Community registration",
    contact: "Contact enquiry",
  };

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
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

  function addText(parent, tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.append(element);
    return element;
  }

  function render() {
    const query = filter.value;
    const submissions = state.submissions.filter((item) => query === "all" || item.kind === query);
    list.replaceChildren();
    if (!submissions.length) {
      addText(list, "p", "admin-empty", state.submissions.length
        ? "There are no submissions of this type on this page."
        : "No website submissions have been received yet.");
    }

    for (const item of submissions) {
      const card = document.createElement("article");
      card.className = "admin-user public-submission-card";
      const details = document.createElement("div");
      details.className = "admin-user-details";
      const heading = document.createElement("h3");
      heading.textContent = item.full_name;
      details.append(heading);
      addText(details, "p", "", `${labels[item.kind] || "Website submission"} · ${new Date(item.created_at).toLocaleString()}`);
      const email = document.createElement("a");
      email.href = `mailto:${item.email}`;
      email.textContent = item.email;
      details.append(email);
      if (item.phone) addText(details, "p", "", `Phone: ${item.phone}`);
      if (item.location) addText(details, "p", "", `Location: ${item.location}`);
      if (item.subject) addText(details, "p", "", `Subject: ${item.subject}`);
      if (item.message) addText(details, "p", "public-submission-message", item.message);
      if (item.kind === "community" && item.newsletter_opt_in) {
        addText(details, "p", "public-submission-newsletter", "Newsletter subscription requested");
      }

      const controls = document.createElement("div");
      controls.className = "admin-user-controls public-submission-controls";
      const status = document.createElement("select");
      status.setAttribute("aria-label", `Status for ${item.full_name}'s ${labels[item.kind]?.toLowerCase() || "submission"}`);
      for (const [value, label] of [["new", "New"], ["reviewed", "Reviewed"], ["closed", "Closed"]]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        status.append(option);
      }
      status.value = item.status;
      status.addEventListener("change", async () => {
        status.disabled = true;
        try {
          await request(`/api/admin/public-submissions/${encodeURIComponent(item.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: status.value }),
          });
          item.status = status.value;
          setMessage("Submission status updated.");
          await load();
        } catch (error) {
          status.value = item.status;
          setMessage(error instanceof Error ? error.message : "The status could not be updated.", true);
        } finally {
          status.disabled = false;
        }
      });
      controls.append(status);

      if (item.cv_original_filename) {
        const cv = document.createElement("a");
        cv.className = "small-action";
        cv.href = `/api/admin/public-submissions/${encodeURIComponent(item.id)}/cv`;
        cv.textContent = "Download CV";
        controls.append(cv);
      }

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small-action small-action-danger";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Delete this submission and any securely stored CV? This cannot be undone.")) return;
        remove.disabled = true;
        try {
          await request(`/api/admin/public-submissions/${encodeURIComponent(item.id)}`, { method: "DELETE" });
          setMessage("Submission deleted.");
          await load();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "The submission could not be deleted.", true);
          remove.disabled = false;
        }
      });
      controls.append(remove);
      card.append(details, controls);
      list.append(card);
    }

    const first = state.totalCount ? state.offset + 1 : 0;
    const last = Math.min(state.offset + state.submissions.length, state.totalCount);
    if (pageLabel) pageLabel.textContent = `${first}–${last} of ${state.totalCount}`;
    if (previousButton instanceof HTMLButtonElement) previousButton.disabled = state.offset <= 0;
    if (nextButton instanceof HTMLButtonElement) nextButton.disabled = state.offset + state.limit >= state.totalCount;
    if (count) count.textContent = `${state.newCount} new · ${state.totalCount} total`;
    if (navCount instanceof HTMLElement) {
      navCount.textContent = state.newCount ? String(state.newCount) : "";
      navCount.hidden = state.newCount === 0;
    }
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    if (refreshButton instanceof HTMLButtonElement) refreshButton.disabled = true;
    setMessage("Loading website submissions…");
    try {
      const result = await request(`/api/admin/public-submissions?offset=${state.offset}`);
      if (!Array.isArray(result.submissions)) throw new Error("The inbox response is invalid.");
      state.submissions = result.submissions;
      state.totalCount = Number(result.totalCount) || 0;
      state.newCount = Number(result.newCount) || 0;
      state.limit = Number(result.limit) || 100;
      render();
      setMessage(state.totalCount ? "Review applications, registrations and enquiries here." : "No website submissions have been received yet.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The website submissions inbox could not be loaded.", true);
    } finally {
      state.loading = false;
      if (refreshButton instanceof HTMLButtonElement) refreshButton.disabled = false;
    }
  }

  if (refreshButton instanceof HTMLButtonElement) {
    refreshButton.addEventListener("click", () => {
      state.offset = 0;
      load();
    });
  }
  filter.addEventListener("change", render);
  if (previousButton instanceof HTMLButtonElement) {
    previousButton.addEventListener("click", () => {
      state.offset = Math.max(0, state.offset - state.limit);
      load();
    });
  }
  if (nextButton instanceof HTMLButtonElement) {
    nextButton.addEventListener("click", () => {
      if (state.offset + state.limit < state.totalCount) {
        state.offset += state.limit;
        load();
      }
    });
  }
  document.querySelectorAll('[data-admin-view="public-submissions"]').forEach((button) => {
    button.addEventListener("click", () => {
      state.offset = 0;
      load();
    });
  });
  document.addEventListener("tgf-account-authenticated", () => {
    if (!panel.hidden) load();
  });
})();
