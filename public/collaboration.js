(() => {
  const DAYS = [
    ["Monday", 1],
    ["Tuesday", 2],
    ["Wednesday", 3],
    ["Thursday", 4],
    ["Friday", 5],
    ["Saturday", 6],
    ["Sunday", 7],
  ];
  const CHAT_API = "/api/collaboration/chat";
  const MAX_CHAT_FILES = 5;
  const MAX_CHAT_FILE_BYTES = 25 * 1024 * 1024;
  const MAX_CHAT_TOTAL_BYTES = 100 * 1024 * 1024;
  let notificationLoadRevision = 0;
  const state = {
    account: null,
    stream: null,
    selectedConversationId: "",
    selectedPeriod: "this-week",
    recording: null,
    refreshTimer: 0,
    scheduleRefreshTimer: 0,
    countdownTimer: 0,
    serverNow: 0,
    serverClockStarted: 0,
    liveGroups: [],
  };
  const dashboardThemeStorageKey = "tgf-dashboard-theme";

  function bootstrapDashboardTheme() {
    const page = document.querySelector(".classroom-page");
    if (!page) return;
    let savedTheme = "light";
    try {
      savedTheme = window.localStorage.getItem(dashboardThemeStorageKey) || "light";
    } catch {
      savedTheme = "light";
    }
    if (!["light", "dark"].includes(savedTheme)) savedTheme = "light";
    page.classList.toggle("is-dark", savedTheme === "dark");
    document.body.classList.toggle("is-dark", savedTheme === "dark");
    document.documentElement.style.colorScheme = savedTheme;
  }

  bootstrapDashboardTheme();

  function element(tag, className = "", text = "") {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text) item.textContent = text;
    return item;
  }

  function formatRecordingDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    const pad = (value) => String(value).padStart(2, "0");
    return hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(remainder)}`
      : `${pad(minutes)}:${pad(remainder)}`;
  }

  function updateLiveGroupControls(form) {
    const course = form.querySelector("[data-go-live-course]");
    const group = form.querySelector("[data-go-live-group]");
    const name = form.querySelector("[data-live-group-name]");
    const members = form.querySelector("[data-live-group-members]");
    const save = form.querySelector("[data-live-group-save]");
    const submit = form.querySelector("[data-go-live-submit]");
    if (!course || !group || !name || !members || !save || !submit) return;
    const selectedMembers = members.querySelectorAll("input[type=checkbox]:checked").length;
    const savedGroup = state.liveGroups.find((item) => item.id === group.value);
    const selectedIds = Array.from(
      members.querySelectorAll("input[type=checkbox]:checked"),
      (input) => input.value,
    ).sort();
    const savedIds = [...(savedGroup?.memberIds || [])].sort();
    const groupHasUnsavedChanges = !savedGroup ||
      name.value.trim() !== savedGroup.name ||
      selectedIds.length !== savedIds.length ||
      selectedIds.some((id, index) => id !== savedIds[index]);
    save.disabled = !course.value || name.value.trim().length < 2 || selectedMembers === 0;
    submit.disabled = !course.value || !savedGroup || groupHasUnsavedChanges;
  }

  function renderLiveGroupMembers(form, students, selectedIds = []) {
    const members = form.querySelector("[data-live-group-members]");
    if (!members) return;
    members.replaceChildren();
    if (!students.length) {
      members.append(element("p", "admin-empty", "No active, approved learners are enrolled in this course."));
      return;
    }
    const selected = new Set(selectedIds);
    for (const student of students) {
      const label = element("label", "live-group-member");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = student.id;
      checkbox.checked = selected.has(student.id);
      checkbox.addEventListener("change", () => updateLiveGroupControls(form));
      const copy = element("span", "live-group-member-copy");
      copy.append(
        element("strong", "", student.fullName),
        element("small", "", student.email),
      );
      label.append(checkbox, copy);
      members.append(label);
    }
  }

  async function loadLiveGroupEditor(form, selectedGroupId = "new") {
    const course = form.querySelector("[data-go-live-course]");
    const groupSelect = form.querySelector("[data-go-live-group]");
    const name = form.querySelector("[data-live-group-name]");
    const members = form.querySelector("[data-live-group-members]");
    const save = form.querySelector("[data-live-group-save]");
    const editor = form.querySelector("[data-live-group-editor]");
    const summary = form.querySelector("[data-go-live-group-summary]");
    const status = form.querySelector("[data-go-live-status]");
    if (!course || !groupSelect || !name || !members || !save) return false;
    groupSelect.replaceChildren();
    const placeholder = element("option", "", "Choose a group");
    placeholder.value = "";
    placeholder.disabled = true;
    placeholder.selected = true;
    groupSelect.append(placeholder);
    state.liveGroups = [];
    if (!course.value) {
      groupSelect.disabled = false;
      if (editor) editor.open = false;
      name.value = "";
      if (summary) summary.textContent = "Select a course and saved group to start.";
      renderLiveGroupMembers(form, []);
      members.replaceChildren(element("p", "admin-empty", "Choose a course to load eligible students."));
      setStatus(status, "");
      updateLiveGroupControls(form);
      return true;
    }
    try {
      groupSelect.disabled = false;
      const result = await request(`/api/collaboration/live-groups?programmeId=${encodeURIComponent(course.value)}`);
      state.liveGroups = result.groups || [];
      const createOption = element("option", "", "Create a new group");
      createOption.value = "new";
      groupSelect.append(createOption);
      for (const group of state.liveGroups) {
        const option = element("option", "", group.name);
        option.value = group.id;
        groupSelect.append(option);
      }
      const selectedGroup = state.liveGroups.find((group) => group.id === selectedGroupId);
      groupSelect.value = selectedGroup
        ? selectedGroup.id
        : state.liveGroups.length ? "" : "new";
      if (editor) editor.open = groupSelect.value === "new";
      name.value = selectedGroup ? selectedGroup.name : "";
      if (summary) {
        summary.textContent = selectedGroup
          ? `${selectedGroup.memberIds.length} saved learner${selectedGroup.memberIds.length === 1 ? "" : "s"}; only eligible learners will be invited.`
          : state.liveGroups.length
            ? "Choose a saved group to go live, or create one below."
            : "No groups saved for this course yet. Create one below to continue.";
      }
      renderLiveGroupMembers(form, result.students || [], selectedGroup?.memberIds || []);
      setStatus(status, "");
      updateLiveGroupControls(form);
      return true;
    } catch (error) {
      groupSelect.disabled = true;
      if (editor) editor.open = false;
      name.value = "";
      if (summary) summary.textContent = "Group information could not be loaded.";
      renderLiveGroupMembers(form, []);
      members.replaceChildren(element("p", "admin-empty", "Eligible students could not be loaded."));
      save.disabled = true;
      setStatus(status, error.message, true);
      return false;
    }
  }

  async function loadGoLiveCourses() {
    const form = document.querySelector("[data-collab-go-live]");
    const select = form?.querySelector("[data-go-live-course]");
    const submit = form?.querySelector("[data-go-live-submit]");
    if (!form || !select || !submit) return;
    try {
      const programmes = await request("/api/teacher/programmes");
      select.replaceChildren();
      const placeholder = element("option", "", programmes.length ? "Choose a course" : "No assigned courses");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      select.append(placeholder);
      for (const programme of programmes) {
        const option = element("option", "", programme.title);
        option.value = programme.id;
        select.append(option);
      }
      select.disabled = programmes.length === 0;
      submit.disabled = true;
      setStatus(form.querySelector("[data-go-live-status]"), "");
      await loadLiveGroupEditor(form);
    } catch (error) {
      submit.disabled = true;
      setStatus(form.querySelector("[data-go-live-status]"), error.message, true);
    }
  }

  function initializeGoLiveForm() {
    const form = document.querySelector("[data-collab-go-live]");
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = "true";
    const course = form.querySelector("[data-go-live-course]");
    const group = form.querySelector("[data-go-live-group]");
    const name = form.querySelector("[data-live-group-name]");
    const save = form.querySelector("[data-live-group-save]");
    const members = form.querySelector("[data-live-group-members]");
    const summary = form.querySelector("[data-go-live-group-summary]");
    course?.addEventListener("change", () => void loadLiveGroupEditor(form));
    group?.addEventListener("change", () => {
      const selected = state.liveGroups.find((item) => item.id === group.value);
      const groupEditor = form.querySelector("[data-live-group-editor]");
      if (groupEditor) groupEditor.open = group.value === "new";
      name.value = selected ? selected.name : "";
      if (summary) {
        summary.textContent = selected
          ? `${selected.memberIds.length} saved learner${selected.memberIds.length === 1 ? "" : "s"}; only eligible learners will be invited.`
          : group.value === "new" ? "Choose active, approved learners for this new group." : "Select a saved group to start.";
      }
      const membersEditor = form.querySelector("[data-live-group-members]");
      if (membersEditor) {
        const studentIds = Array.from(membersEditor.querySelectorAll("input[type=checkbox]"), (input) => input.value);
        const selectedIds = new Set(selected?.memberIds || []);
        membersEditor.querySelectorAll("input[type=checkbox]").forEach((input) => {
          input.checked = selectedIds.has(input.value);
        });
        if (!studentIds.length) renderLiveGroupMembers(form, []);
      }
      updateLiveGroupControls(form);
    });
    name?.addEventListener("input", () => updateLiveGroupControls(form));
    members?.addEventListener("change", () => updateLiveGroupControls(form));
    save?.addEventListener("click", async () => {
      const selectedMembers = Array.from(
        members.querySelectorAll("input[type=checkbox]:checked"),
        (input) => input.value,
      );
      const existingGroupId = group.value && group.value !== "new" ? group.value : "";
      save.disabled = true;
      setStatus(form.querySelector("[data-go-live-status]"), "Saving the student group…");
      try {
        const result = await request("/api/collaboration/live-groups", {
          method: "POST",
          body: JSON.stringify({
            programmeId: course.value,
            groupId: existingGroupId || null,
            name: name.value.trim(),
            memberIds: selectedMembers,
          }),
        });
        const loaded = await loadLiveGroupEditor(form, result.groupId);
        if (loaded) {
          setStatus(form.querySelector("[data-go-live-status]"), `Group saved with ${selectedMembers.length} student${selectedMembers.length === 1 ? "" : "s"}.`);
        }
      } catch (error) {
        setStatus(form.querySelector("[data-go-live-status]"), error.message, true);
      } finally {
        updateLiveGroupControls(form);
      }
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector("[data-go-live-submit]");
      submit.disabled = true;
      setStatus(form.querySelector("[data-go-live-status]"), "Opening your camera, starting the recording, and inviting the selected group…");
      try {
        const result = await request("/api/collaboration/live-sessions", {
          method: "POST",
          body: JSON.stringify({ groupId: group.value }),
        });
        setStatus(
          form.querySelector("[data-go-live-status]"),
          `${result.invitedCount} student${result.invitedCount === 1 ? "" : "s"} invited. Opening the live room…`,
        );
        window.location.assign(`/live-class?sessionId=${encodeURIComponent(result.sessionId)}`);
      } catch (error) {
        setStatus(form.querySelector("[data-go-live-status]"), error.message, true);
        updateLiveGroupControls(form);
      }
    });
  }

  function applyDashboardTheme(theme) {
    const toggle = document.querySelector("#dashboard-theme-toggle");
    const page = document.querySelector(".classroom-page");
    if (!toggle || !page || !["light", "dark"].includes(theme)) return;
    const isDark = theme === "dark";
    page.classList.toggle("is-dark", isDark);
    document.body.classList.toggle("is-dark", isDark);
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(dashboardThemeStorageKey, theme);
    } catch {
      // The server preference remains the fallback when storage is unavailable.
    }
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    toggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  }

  async function loadDashboardPreferences() {
    const toggle = document.querySelector("#dashboard-theme-toggle");
    if (!toggle || !document.querySelector(".classroom-page") || !state.account ||
        !/^[0-9a-f-]{36}$/i.test(state.account.id || "")) return;
    try {
      const result = await request("/api/collaboration/preferences");
      applyDashboardTheme(result.theme);
      setStatus(document.querySelector("[data-user-theme-status]"), "Theme preference loaded.");
    } catch (error) {
      setStatus(document.querySelector("[data-user-theme-status]"), error.message, true);
    } finally {
      toggle.hidden = false;
    }
  }

  function initializeDashboardPreferences() {
    const toggle = document.querySelector("#dashboard-theme-toggle");
    if (!toggle) return;
    if (!document.querySelector(".classroom-page")) {
      toggle.hidden = true;
      return;
    }
    if (toggle.dataset.directInitialized === "true") return;
    if (toggle.dataset.initialized) return;
    toggle.dataset.initialized = "true";
    toggle.addEventListener("click", async () => {
      if (!state.account) return;
      const page = document.querySelector(".classroom-page");
      if (!page) return;
      const currentTheme = page.classList.contains("is-dark") ? "dark" : "light";
      const nextTheme = currentTheme === "dark" ? "light" : "dark";
      const status = document.querySelector("[data-user-theme-status]");
      toggle.disabled = true;
      applyDashboardTheme(nextTheme);
      setStatus(status, "Saving theme preference.");
      try {
        const result = await request("/api/collaboration/preferences", {
          method: "PUT",
          body: JSON.stringify({ theme: nextTheme }),
        });
        applyDashboardTheme(result.theme);
        setStatus(status, "Theme preference saved.");
      } catch (error) {
        applyDashboardTheme(currentTheme);
        setStatus(status, error.message, true);
      } finally {
        toggle.disabled = false;
      }
    });
  }

  function setStatus(target, text, isError = false) {
    if (!target) return;
    target.textContent = text;
    target.classList.toggle("is-error", isError);
  }

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData)
          ? { "Content-Type": "application/json" }
          : {}),
        ...options.headers,
      },
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response.");
    }
    if (!response.ok) throw new Error(result.error || "The request could not be completed.");
    return result;
  }

  function formatDate(value, options = { dateStyle: "medium", timeStyle: "short" }) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "Date unavailable"
      : new Intl.DateTimeFormat("en-CM", options).format(date);
  }

  function setEmpty(target, message) {
    target.replaceChildren(element("p", "admin-empty", message));
  }

  function makeButton(text, callback, className = "small-action") {
    const button = element("button", className, text);
    button.type = "button";
    button.addEventListener("click", callback);
    return button;
  }

  function showAdminInbox() {
    const details = document.querySelector(".collaboration-support-details");
    if (details) details.open = true;
    const center = document.querySelector('[data-message-center="user"]');
    if (center && center.id === "student-messages") {
      window.location.hash = "#student-messages";
      details?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      const support = document.querySelector("#teacher-messages");
      window.location.hash = "#teacher-peer-messages";
      support?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function renderFilePreview(list, files) {
    list.replaceChildren();
    for (const file of files) {
      const item = element("span", "collaboration-file-chip", `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`);
      list.append(item);
    }

    function validateChatFiles(files) {
      if (files.length > MAX_CHAT_FILES) return `Attach no more than ${MAX_CHAT_FILES} files.`;
      if (files.some((file) => file.size > MAX_CHAT_FILE_BYTES)) return "Each file must be 25 MB or smaller.";
      if (files.reduce((total, file) => total + file.size, 0) > MAX_CHAT_TOTAL_BYTES) {
        return "The combined attachment size must be 100 MB or smaller.";
      }
      return "";
    }
  }

  function renderChatMessage(message) {
    const item = element("article", message.isOwn ? "collaboration-chat-message is-own" : "collaboration-chat-message");
    const meta = element("div", "collaboration-message-meta");
    meta.append(
      element("strong", "", message.senderName || "Participant"),
      element("time", "", formatDate(message.createdAt)),
    );
    item.append(meta);
    if (message.body) item.append(element("p", "collaboration-message-body", message.body));
    for (const file of message.attachments || []) {
      const link = element("a", "collaboration-attachment-link", `${file.fileName} · ${(file.fileSize / (1024 * 1024)).toFixed(1)} MB`);
      link.href = file.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      if (file.contentType.startsWith("image/")) {
        const image = element("img", "collaboration-image-preview");
        image.src = file.url;
        image.alt = file.fileName;
        image.loading = "lazy";
        item.append(image);
      } else if (file.contentType.startsWith("video/")) {
        const video = element("video", "collaboration-media-preview");
        video.src = file.url;
        video.controls = true;
        video.preload = "metadata";
        item.append(video);
      } else if (file.contentType.startsWith("audio/")) {
        const audio = element("audio", "collaboration-media-preview");
        audio.src = file.url;
        audio.controls = true;
        audio.preload = "metadata";
        item.append(audio);
      }
      item.append(link);
    }
    if (message.readStatus) item.append(element("span", "collaboration-read-status", message.readStatus));
    return item;
  }

  async function loadConversation(id, root) {
    const thread = root.querySelector("[data-collab-thread]");
    const heading = root.querySelector("[data-collab-chat-heading]");
    const form = root.querySelector("[data-collab-form]");
    state.selectedConversationId = id;
    try {
      const result = await request(`${CHAT_API}/conversations/${encodeURIComponent(id)}`);
      const conversation = result.conversation;
      heading.replaceChildren(element("strong", "", conversation.partnerName));
      heading.append(element("span", "", conversation.programmeTitle));
      thread.replaceChildren();
      if (!result.messages.length) setEmpty(thread, "No messages yet. Send a message to start the conversation.");
      else thread.append(...result.messages.map(renderChatMessage));
      thread.scrollTop = thread.scrollHeight;
      form.dataset.conversationId = id;
      form.querySelector("[data-collab-body]").disabled = false;
      form.querySelector("[data-collab-files]").disabled = false;
      form.querySelector("[data-collab-record]").disabled = false;
      form.querySelector("[data-collab-send]").disabled = false;
    } catch (error) {
      setStatus(root.querySelector("[data-collab-status]"), error.message, true);
    }
  }

  async function openConversation(contact, root) {
    try {
      const result = await request(`${CHAT_API}/conversations`, {
        method: "POST",
        body: JSON.stringify({
          kind: contact.kind,
          userId: contact.userId,
          programmeId: contact.programmeId,
        }),
      });
      await loadConversation(result.conversationId, root);
      await loadChatContacts(root);
    } catch (error) {
      setStatus(root.querySelector("[data-collab-status]"), error.message, true);
    }
  }

  async function loadChatContacts(root) {
    const list = root.querySelector("[data-collab-contacts]");
    if (!list) return;
    const search = root.querySelector("[data-collab-search]").value.trim();
    try {
      const [contactResult, conversationsResult] = await Promise.all([
        request(`${CHAT_API}/contacts?search=${encodeURIComponent(search)}`),
        request(`${CHAT_API}/conversations`),
      ]);
      list.replaceChildren();
      const admin = makeButton("Message Admin", showAdminInbox, "collaboration-contact");
      admin.setAttribute("aria-label", "Open private administrator support");
      list.append(admin);
      for (const conversation of conversationsResult.conversations) {
        const contact = makeButton(
          `${conversation.partnerName} · ${conversation.programmeTitle}${conversation.unreadCount ? ` · ${conversation.unreadCount} new` : ""}`,
          () => void loadConversation(conversation.id, root),
          "collaboration-contact",
        );
        if (conversation.id === state.selectedConversationId) contact.classList.add("is-selected");
        list.append(contact);
      }
      for (const person of contactResult.contacts) {
        const contact = makeButton(person.label, () => void openConversation(person, root), "collaboration-contact");
        contact.append(element("small", "", person.name));
        list.append(contact);
      }
      if (!contactResult.contacts.length && !conversationsResult.conversations.length) {
        list.append(element("p", "admin-empty", "No course contacts are available yet."));
      }
    } catch (error) {
      setEmpty(list, error.message);
    }
  }

  function setupVoiceRecorder(root) {
    const button = root.querySelector("[data-collab-record]");
    if (!button) return;
    button.addEventListener("click", async () => {
      const form = root.querySelector("[data-collab-form]");
      if (state.recording) {
        state.recording.stop();
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setStatus(root.querySelector("[data-collab-status]"), "Voice recording is not supported by this browser.", true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data.size) chunks.push(event.data);
        });
        recorder.addEventListener("stop", () => {
          stream.getTracks().forEach((track) => track.stop());
          state.recording = null;
          button.textContent = "Record voice note";
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          if (!blob.size) return;
          const extension = blob.type.includes("ogg") ? "ogg" : "webm";
          const file = new File([blob], `voice-note.${extension}`, { type: blob.type });
          const input = form.querySelector("[data-collab-files]");
          const transfer = new DataTransfer();
          for (const pending of input.files) transfer.items.add(pending);
          transfer.items.add(file);
          const validationError = validateChatFiles([...transfer.files]);
          if (validationError) {
            setStatus(root.querySelector("[data-collab-status]"), validationError, true);
            return;
          }
          input.files = transfer.files;
          renderFilePreview(form.querySelector("[data-collab-file-list]"), [...input.files]);
        });
        recorder.start();
        state.recording = recorder;
        button.textContent = "Stop recording";
        setStatus(root.querySelector("[data-collab-status]"), "Recording voice note…");
      } catch {
        setStatus(root.querySelector("[data-collab-status]"), "Allow microphone access to record a voice note.", true);
      }
    });
  }

  function initializeChat(root) {
    const search = root.querySelector("[data-collab-search]");
    const files = root.querySelector("[data-collab-files]");
    const form = root.querySelector("[data-collab-form]");
    const adminButton = root.querySelector("[data-collab-admin-contact]");
    if (!search || !files || !form) return;
    let searchTimer = 0;
    search.addEventListener("input", () => {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => void loadChatContacts(root), 200);
    });
    files.addEventListener("change", () => {
      const selected = [...files.files];
      const validationError = validateChatFiles(selected);
      if (validationError) {
        files.value = "";
        form.querySelector("[data-collab-file-list]").replaceChildren();
        setStatus(root.querySelector("[data-collab-status]"), validationError, true);
        return;
      }
      renderFilePreview(form.querySelector("[data-collab-file-list]"), selected);
    });
    adminButton?.addEventListener("click", showAdminInbox);
    setupVoiceRecorder(root);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const conversationId = form.dataset.conversationId;
      const body = form.querySelector("[data-collab-body]");
      const send = form.querySelector("[data-collab-send]");
      if (!conversationId) {
        setStatus(root.querySelector("[data-collab-status]"), "Choose a course contact first.", true);
        return;
      }
      const data = new FormData();
      data.append("body", body.value);
      for (const file of files.files) data.append("attachments", file);
      send.disabled = true;
      setStatus(root.querySelector("[data-collab-status]"), "Sending…");
      try {
        const result = await request(`${CHAT_API}/conversations/${encodeURIComponent(conversationId)}/messages`, {
          method: "POST",
          body: data,
        });
        body.value = "";
        files.value = "";
        form.querySelector("[data-collab-file-list]").replaceChildren();
        setStatus(root.querySelector("[data-collab-status]"), result.warning || "Message sent.");
        await loadConversation(conversationId, root);
        await loadChatContacts(root);
      } catch (error) {
        setStatus(root.querySelector("[data-collab-status]"), error.message, true);
      } finally {
        send.disabled = false;
      }
    });
    void loadChatContacts(root);
  }

  function addWeekdayRow(container, weekday) {
    const line = element("div", "collaboration-time-slot");
    const start = document.createElement("input");
    start.type = "time";
    start.setAttribute("aria-label", `${weekday} start time`);
    const end = document.createElement("input");
    end.type = "time";
    end.setAttribute("aria-label", `${weekday} end time`);
    const remove = makeButton("Remove", () => line.remove(), "small-action small-action-danger");
    line.append(start, element("span", "", "to"), end, remove);
    container.append(line);
  }

  function initializeWeekdayEditor(root) {
    const editor = root.querySelector("[data-collab-weekday-editor]");
    if (!editor || editor.dataset.initialized) return;
    editor.dataset.initialized = "true";
    for (const [label, weekday] of DAYS) {
      const day = element("fieldset", "collaboration-weekday");
      day.dataset.weekday = String(weekday);
      const legend = element("legend", "", label);
      const slots = element("div", "collaboration-day-slots");
      const add = makeButton("Add time", () => addWeekdayRow(slots, label), "small-action");
      day.append(legend, slots, add);
      editor.append(day);
    }
    editor.querySelectorAll("fieldset").forEach((day) => {
      addWeekdayRow(day.querySelector(".collaboration-day-slots"), DAYS.find((entry) => entry[1] === Number(day.dataset.weekday))[0]);
    });
  }

  function renderTimetableSlots(slots) {
    const grouped = new Map(DAYS.map(([day, number]) => [number, { day, intervals: [] }]));
    for (const slot of slots || []) {
      grouped.get(Number(slot.weekday))?.intervals.push(`${slot.startsAt}–${slot.endsAt}`);
    }
    const wrapper = element("div", "collaboration-weekday-summary");
    for (const day of grouped.values()) {
      if (!day.intervals.length) continue;
      wrapper.append(element("p", "", `${day.day}: ${day.intervals.join(", ")}`));
    }
    return wrapper;
  }

  function populateWeekdayEditor(root, slots) {
    for (const day of root.querySelectorAll("[data-weekday]")) {
      const weekday = Number(day.dataset.weekday);
      const label = DAYS.find((entry) => entry[1] === weekday)?.[0];
      const container = day.querySelector(".collaboration-day-slots");
      container.replaceChildren();
      const daySlots = slots.filter((slot) => Number(slot.weekday) === weekday);
      for (const slot of daySlots.length ? daySlots : [{ startsAt: "", endsAt: "" }]) {
        addWeekdayRow(container, label);
        const [start, end] = container.lastElementChild.querySelectorAll("input");
        start.value = slot.startsAt;
        end.value = slot.endsAt;
      }
    }
  }

  function initializeAdminTimetableEditor() {
    const dialog = document.querySelector("#admin-weekly-timetable-editor-dialog");
    const form = document.querySelector("#admin-weekly-timetable-editor-form");
    if (!dialog || !form || form.dataset.initialized) return;
    form.dataset.initialized = "true";
    initializeWeekdayEditor(dialog);
    document.querySelector("#cancel-admin-weekly-timetable-edit").addEventListener("click", () => dialog.close());
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const slots = [];
      for (const day of dialog.querySelectorAll("[data-weekday]")) {
        for (const row of day.querySelectorAll(".collaboration-time-slot")) {
          const [start, end] = row.querySelectorAll("input");
          if (!start.value && !end.value) continue;
          if (!start.value || !end.value) {
            setStatus(form.querySelector("#admin-weekly-timetable-editor-message"), "Complete both times for each interval.", true);
            return;
          }
          slots.push({
            weekday: Number(day.dataset.weekday),
            startsAt: start.value,
            endsAt: end.value,
          });
        }
      }
      const timetableId = form.querySelector("#admin-weekly-timetable-editor-id").value;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus(form.querySelector("#admin-weekly-timetable-editor-message"), "Saving timetable…");
      try {
        const result = await request(`/api/collaboration/timetable/${encodeURIComponent(timetableId)}`, {
          method: "PUT",
          body: JSON.stringify({
            timezone: form.querySelector("#admin-weekly-timetable-timezone").value,
            slots,
          }),
        });
        dialog.close();
        setStatus(
          document.querySelector("[data-collab-admin-timetable-status]"),
          result.warning || `Weekly timetable for ${result.programmeTitle} updated.`,
        );
        await loadTimetables();
      } catch (error) {
        setStatus(form.querySelector("#admin-weekly-timetable-editor-message"), error.message, true);
      } finally {
        submit.disabled = false;
      }
    });
  }

  function openAdminTimetableEditor(timetable) {
    const dialog = document.querySelector("#admin-weekly-timetable-editor-dialog");
    const form = document.querySelector("#admin-weekly-timetable-editor-form");
    initializeAdminTimetableEditor();
    form.querySelector("#admin-weekly-timetable-editor-id").value = timetable.id;
    form.querySelector("#admin-weekly-timetable-timezone").value = timetable.timezone;
    populateWeekdayEditor(dialog, timetable.slots || []);
    setStatus(form.querySelector("#admin-weekly-timetable-editor-message"), "");
    dialog.showModal();
  }

  async function loadTeacherProgrammes(root) {
    const select = root.querySelector("[data-collab-course]");
    if (!select) return;
    try {
      const programmes = await request("/api/teacher/programmes");
      select.replaceChildren();
      const placeholder = element("option", "", programmes.length ? "Choose a course" : "No assigned courses");
      placeholder.value = "";
      placeholder.disabled = true;
      placeholder.selected = true;
      select.append(placeholder);
      for (const programme of programmes) {
        const option = element("option", "", programme.title);
        option.value = programme.id;
        select.append(option);
      }
      if (!programmes.length) root.querySelector("[data-collab-timetable-form] button[type=submit]").disabled = true;
    } catch (error) {
      setStatus(root.querySelector("[data-collab-timetable-status]"), error.message, true);
    }
  }

  async function loadTimetables() {
    const teacherList = document.querySelector("[data-collab-tutor-timetable] [data-collab-timetable]");
    const adminList = document.querySelector("[data-collab-admin-timetables]");
    if (!teacherList && !adminList) return;
    try {
      const result = await request("/api/collaboration/timetable");
      if (teacherList) {
        teacherList.replaceChildren();
        const own = result.timetables.filter((entry) => entry.teacherId === state.account?.id);
        if (!own.length) setEmpty(teacherList, "You have not submitted a weekly timetable.");
        for (const timetable of own) {
          const card = element("article", "collaboration-schedule-card");
          card.append(
            element("span", `visibility-badge${timetable.status === "approved" ? "" : " is-hidden"}`, timetable.status),
            element("h3", "", timetable.programmeTitle),
            element("p", "admin-location-subtitle", `Time zone: ${timetable.timezone}`),
            renderTimetableSlots(timetable.slots),
          );
          if (timetable.rejectionReason) card.append(element("p", "admin-message is-error", `Reason: ${timetable.rejectionReason}`));
          teacherList.append(card);
        }
      }
      if (adminList) {
        adminList.replaceChildren();
        if (!result.timetables.length) setEmpty(adminList, "No weekly timetables have been submitted.");
        for (const timetable of result.timetables) {
          const card = element("article", "collaboration-schedule-card");
          card.append(
            element("div", "admin-panel-heading", ""),
            element("span", `visibility-badge${timetable.status === "approved" ? "" : " is-hidden"}`, timetable.status),
            element("h3", "", `${timetable.programmeTitle} · ${timetable.teacherName}`),
            element("p", "admin-location-subtitle", `Submitted ${formatDate(timetable.submittedAt)} · ${timetable.timezone}`),
            renderTimetableSlots(timetable.slots),
          );
          if (timetable.rejectionReason) card.append(element("p", "admin-message is-error", `Previous reason: ${timetable.rejectionReason}`));
          const actions = element("div", "course-actions");
          if (timetable.status === "pending" || timetable.status === "approved") {
            actions.append(makeButton("Edit schedule", () => openAdminTimetableEditor(timetable), "button button-quiet"));
          }
          if (timetable.status === "pending") {
            const approve = makeButton("Approve", () => void reviewTimetable(timetable, "approve"), "button button-orange");
            const reject = makeButton("Decline", () => void reviewTimetable(timetable, "reject"), "button button-quiet");
            actions.append(approve, reject);
          }
          const remove = makeButton(
            "Move to trash",
            () => void trashTimetable(timetable),
            "button button-quiet",
          );
          actions.append(remove);
          card.append(actions);
          adminList.append(card);
        }
      }
    } catch (error) {
      setStatus(document.querySelector("[data-collab-admin-timetable-status]"), error.message, true);
      if (teacherList) setEmpty(teacherList, error.message);
      if (adminList) setEmpty(adminList, error.message);
    }
  }

  async function reviewTimetable(timetable, action) {
    let reason = "";
    if (action === "reject") {
      const answer = window.prompt(`Why are you declining the ${timetable.programmeTitle} timetable? (Optional)`);
      if (answer === null) return;
      reason = answer.trim();
    }
    try {
      const result = await request(`/api/collaboration/timetable/${encodeURIComponent(timetable.id)}/review`, {
        method: "POST",
        body: JSON.stringify({ action, reason }),
      });
      setStatus(
        document.querySelector("[data-collab-admin-timetable-status]"),
        result.warning || `Timetable ${action === "approve" ? "approved" : "declined"}.`,
      );
      await loadTimetables();
    } catch (error) {
      setStatus(document.querySelector("[data-collab-admin-timetable-status]"), error.message, true);
    }
  }

  async function trashTimetable(timetable) {
    if (!window.confirm(
      `Move the weekly timetable for "${timetable.programmeTitle}" to recoverable trash?`,
    )) return;
    try {
      await request(`/api/collaboration/timetable/${encodeURIComponent(timetable.id)}`, {
        method: "DELETE",
      });
      setStatus(
        document.querySelector("[data-collab-admin-timetable-status]"),
        `${timetable.programmeTitle} timetable moved to trash.`,
      );
      await loadTimetables();
    } catch (error) {
      setStatus(document.querySelector("[data-collab-admin-timetable-status]"), error.message, true);
    }
  }

  function initializeTimetableForm(root) {
    const form = root.querySelector("[data-collab-timetable-form]");
    if (!form || form.dataset.initialized) return;
    form.dataset.initialized = "true";
    initializeWeekdayEditor(root);
    void loadTeacherProgrammes(root);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const slots = [];
      for (const day of root.querySelectorAll("[data-weekday]")) {
        for (const row of day.querySelectorAll(".collaboration-time-slot")) {
          const [start, end] = row.querySelectorAll("input");
          if (!start.value && !end.value) continue;
          if (!start.value || !end.value) {
            setStatus(form.querySelector("[data-collab-timetable-status]"), "Complete both times for each interval.", true);
            return;
          }
          slots.push({
            weekday: Number(day.dataset.weekday),
            startsAt: start.value,
            endsAt: end.value,
          });
        }
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      setStatus(form.querySelector("[data-collab-timetable-status]"), "Submitting timetable…");
      try {
        const result = await request("/api/collaboration/timetable", {
          method: "POST",
          body: JSON.stringify({ programmeId: form.querySelector("[data-collab-course]").value, slots, timezone: "Africa/Douala" }),
        });
        setStatus(
          form.querySelector("[data-collab-timetable-status]"),
          result.warning || "Submitted. Your timetable is pending administrator approval.",
        );
        await loadTimetables();
      } catch (error) {
        setStatus(form.querySelector("[data-collab-timetable-status]"), error.message, true);
      } finally {
        submit.disabled = false;
      }
    });
  }

  function occurrenceMatchesPeriod(item) {
    const date = new Date(`${item.classDate}T12:00:00`);
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = (startOfWeek.getDay() + 6) % 7;
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);
    const nextWeekEnd = new Date(endOfWeek);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const startMonthAfter = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const limits = {
      "this-week": [startOfWeek, endOfWeek],
      "next-week": [endOfWeek, nextWeekEnd],
      "this-month": [startOfMonth, startNextMonth],
      "next-month": [startNextMonth, startMonthAfter],
    };
    const [start, end] = limits[state.selectedPeriod];
    return date >= start && date < end;
  }

  function getServerNow() {
    if (!state.serverNow) return 0;
    return state.serverNow + (performance.now() - state.serverClockStarted);
  }

  function syncServerClock(serverNow) {
    const timestamp = Date.parse(serverNow);
    if (!Number.isFinite(timestamp)) return;
    state.serverNow = timestamp;
    state.serverClockStarted = performance.now();
    if (!state.countdownTimer) {
      state.countdownTimer = window.setInterval(updateLiveClassCountdowns, 1000);
    }
  }

  function formatCountdown(milliseconds) {
    const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const remainder = String(seconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${remainder}`;
  }

  function updateLiveClassCountdowns() {
    const now = getServerNow();
    if (!now) return;
    for (const countdown of document.querySelectorAll("[data-live-countdown]")) {
      const start = Date.parse(countdown.dataset.startsAt);
      const end = Date.parse(countdown.dataset.endsAt);
      const button = countdown.parentElement.querySelector("[data-live-join]");
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      const isEnded = countdown.dataset.sessionStatus === "ended" || now > end;
      const joinAvailable = state.account?.role !== "administrator" &&
        !isEnded && now >= start - 15 * 60 * 1000 && now <= end;
      if (button) {
        button.hidden = false;
        button.disabled = !joinAvailable;
        button.textContent = isEnded ? "Class ended"
          : joinAvailable ? "Join live class" : "Join opens 15 minutes before class";
      }
      if (isEnded) {
        countdown.textContent = "Class ended";
      } else if (now < start) {
        countdown.textContent = `Starts in ${formatCountdown(start - now)}`;
      } else if (countdown.dataset.sessionStatus === "live") {
        countdown.textContent = "Live now";
      } else {
        countdown.textContent = "Waiting for teacher to start";
      }
    }
  }

  function renderOccurrence(item, includeJoin = true) {
    const card = element("article", includeJoin
      ? "collaboration-schedule-card live-class-card"
      : "collaboration-schedule-card");
    const status = item.attendanceStatus === "present" ? "Present"
      : item.attendanceStatus === "absent" ? "Absent" : "Upcoming";
    if (!includeJoin) {
      card.append(
        element("h3", "", item.programmeTitle),
        element("p", "admin-location-subtitle", `${formatDate(item.startsAt)} · ${formatDate(item.endsAt, { timeStyle: "short" })}`),
        element("p", "admin-location-subtitle", `Tutor: ${item.teacherName} · ${status}`),
      );
    } else {
      const start = new Date(item.startsAt);
      const dateCard = element("div", "live-class-date-card");
      dateCard.append(
        element("span", "", new Intl.DateTimeFormat("en-CM", { weekday: "short" }).format(start)),
        element("strong", "", new Intl.DateTimeFormat("en-CM", { day: "2-digit" }).format(start)),
        element("small", "", new Intl.DateTimeFormat("en-CM", { month: "short" }).format(start)),
      );
      const details = element("div", "live-class-details");
      const heading = element("div", "live-class-card-heading");
      const classState = item.endedAt ? "Completed" : item.startedAt ? "Live now" : status;
      heading.append(
        element("span", `live-class-status${item.startedAt && !item.endedAt ? " is-live" : ""}`, classState),
        element("span", "live-class-timezone", item.timezone || ""),
      );
      details.append(
        heading,
        element("h3", "", item.programmeTitle),
        element("p", "live-class-time", `${formatDate(item.startsAt, { hour: "numeric", minute: "2-digit" })} – ${formatDate(item.endsAt, { hour: "numeric", minute: "2-digit" })}`),
        element("p", "live-class-tutor", `Tutor · ${item.teacherName}`),
      );
      const countdownPanel = element("div", "live-class-countdown-panel");
      countdownPanel.append(element("span", "live-class-countdown-label", "Class countdown"));
      const countdown = element("p", "live-class-countdown");
      countdown.dataset.liveCountdown = "";
      countdown.dataset.startsAt = item.startsAt;
      countdown.dataset.endsAt = item.endsAt;
      countdown.dataset.sessionStatus = item.sessionStatus || "scheduled";
      countdownPanel.append(countdown);
      if (state.account?.role !== "administrator") {
        const button = makeButton("Join live class", () => {
          window.location.href = `/live-class?slotId=${encodeURIComponent(item.slotId)}&date=${encodeURIComponent(item.classDate)}`;
        }, "button button-orange live-class-join");
        button.dataset.liveJoin = "";
        button.disabled = true;
        button.textContent = "Join opens 15 minutes before class";
        countdownPanel.append(button);
      }
      card.append(dateCard, details, countdownPanel);
    }
    if (item.attendanceSeconds > 0) {
      card.append(element("p", "admin-location-subtitle", `Time in class: ${Math.floor(item.attendanceSeconds / 60)} minutes`));
    }
    return card;
  }

  function renderLiveSession(item) {
    const card = element("article", "collaboration-schedule-card live-class-card live-session-card");
    const isEnded = Boolean(item.endedAt);
    const isLive = Boolean(item.startedAt);
    const heading = element("div", "live-class-card-heading");
    heading.append(
      element("span", `live-class-status${isLive && !isEnded ? " is-live" : ""}`,
        isEnded ? "Class ended" : isLive ? "Live now" : "Waiting for tutor"),
      element("span", "live-class-timezone", item.groupName || "Invited group"),
    );
    card.append(
      heading,
      element("h3", "", item.programmeTitle),
      element("p", "live-class-tutor", state.account?.role === "teacher"
        ? `${item.invitedCount} student${item.invitedCount === 1 ? "" : "s"} invited`
        : `Tutor · ${item.teacherName}`),
      element("p", "admin-location-subtitle", isEnded
        ? "Your tutor has ended this class."
        : isLive
          ? "Your tutor has started this class."
          : "The waiting room is open. Your class will begin when the tutor starts the lesson."),
    );
    if (!isEnded) {
      card.append(makeButton(
        state.account?.role === "teacher"
          ? (isLive ? "Rejoin live class" : "Open live class")
          : (isLive ? "Rejoin live class" : "Join live class"),
        () => {
          window.location.href = `/live-class?sessionId=${encodeURIComponent(item.sessionId)}`;
        },
        "button button-orange live-class-join",
      ));
    }
    return card;
  }

  async function loadLiveSessions() {
    const lists = document.querySelectorAll("[data-collab-live-sessions]");
    if (!lists.length) return;
    try {
      const result = await request("/api/collaboration/live-sessions");
      updateStudentLiveClassCount(
        "invitationLiveCount",
        result.sessions?.filter((session) => !session.endedAt).length || 0,
      );
      for (const list of lists) {
        list.classList.add("live-class-grid");
        list.replaceChildren();
        if (!result.sessions?.length) setEmpty(list, "No live class invitations are waiting.");
        else list.append(...result.sessions.map((session) => renderLiveSession(session)));
      }
    } catch (error) {
      lists.forEach((list) => setEmpty(list, error.message));
    }
  }

  function updateStudentLiveClassCount(source, count) {
    const counter = document.querySelector("#student-live-count");
    if (!counter) return;
    counter.dataset[source] = String(count);
    counter.textContent = String(
      Number(counter.dataset.courseLiveCount || 0) +
      Number(counter.dataset.timetableLiveCount || 0) +
      Number(counter.dataset.invitationLiveCount || 0),
    );
  }

  async function loadSchedule() {
    const timetable = document.querySelector("#student-timetable [data-collab-timetable]");
    const liveClassLists = document.querySelectorAll(
      "[data-collab-live-classes], [data-collab-live-overview], [data-collab-teacher-classes]",
    );
    const attendance = document.querySelector("[data-collab-attendance]");
    const summary = document.querySelector("[data-collab-attendance-summary]");
    if (!timetable && !attendance && !liveClassLists.length) return;
    try {
      const [result, weeklyResult] = await Promise.all([
        request("/api/collaboration/schedule"),
        timetable
          ? request("/api/collaboration/timetable")
          : Promise.resolve({ timetables: [] }),
      ]);
      syncServerClock(result.serverNow);
      const upcoming = result.occurrences.filter((item) => item.attendanceStatus === "upcoming");
      updateStudentLiveClassCount("timetableLiveCount", upcoming.length);
      for (const list of liveClassLists) {
        list.classList.add("live-class-grid");
        list.replaceChildren();
        const isOverview = list.hasAttribute("data-collab-live-overview");
        const occurrences = isOverview ? upcoming.slice(0, 3) : upcoming;
        if (!occurrences.length) {
          setEmpty(list, isOverview
            ? "No upcoming events are scheduled yet."
            : "No upcoming live classes are scheduled.");
        } else list.append(...occurrences.map((item) => renderOccurrence(item)));
      }
      updateLiveClassCountdowns();
      if (timetable) {
        timetable.replaceChildren(renderStudentWeek(weeklyResult.timetables));
      }
      if (attendance && summary) {
        const past = result.occurrences.filter((item) => item.attendanceStatus !== "upcoming");
        const present = past.filter((item) => item.attendanceStatus === "present").length;
        const percentage = past.length ? Math.round((present / past.length) * 100) : 0;
        summary.replaceChildren(
          element("strong", "", `${percentage}%`),
          element("span", "", `${present} of ${past.length} past classes attended`),
        );
        attendance.replaceChildren();
        const filtered = result.occurrences.filter(occurrenceMatchesPeriod);
        if (!filtered.length) setEmpty(attendance, "No classes fall within this period.");
        else attendance.append(...filtered.map((item) => renderOccurrence(item, false)));
      }
    } catch (error) {
      if (timetable) setEmpty(timetable, error.message);
      liveClassLists.forEach((list) => setEmpty(list, error.message));
      if (attendance) setEmpty(attendance, error.message);
    }
  }

  function renderStudentWeek(timetables) {
    const grid = element("div", "collaboration-weekday-grid");
    grid.setAttribute("role", "region");
    grid.setAttribute("aria-label", "Weekly timetable from Monday to Sunday");
    for (const [dayName, weekday] of DAYS) {
      const column = element("section", "collaboration-weekday-column");
      column.append(element("h3", "", dayName));
      const daySlots = timetables.flatMap((schedule) =>
        (schedule.slots || [])
          .filter((slot) => Number(slot.weekday) === weekday)
          .map((slot) => ({ schedule, slot })),
      ).sort((left, right) => left.slot.startsAt.localeCompare(right.slot.startsAt));
      if (!daySlots.length) {
        column.append(element("p", "admin-location-subtitle", "No scheduled classes."));
      } else {
        for (const { schedule, slot } of daySlots) {
          const card = element("article", "collaboration-weekday-entry");
          card.append(
            element("h4", "", schedule.programmeTitle),
            element("p", "", `${slot.startsAt}–${slot.endsAt} · ${schedule.timezone}`),
            element("p", "admin-location-subtitle", `Tutor: ${schedule.teacherName}`),
          );
          column.append(card);
        }
      }
      grid.append(column);
    }
    return grid;
  }

  function renderRecording(item, canDismiss = false) {
    const card = element("article", "collaboration-recording-card");
    card.append(
      element("h3", "", `${item.programmeTitle} · ${item.classDate}`),
      element("p", "admin-location-subtitle", `Tutor: ${item.teacherName}`),
    );
    if (item.durationSeconds > 0) {
      card.append(element("p", "admin-location-subtitle", `Recording duration: ${formatRecordingDuration(item.durationSeconds)}`));
    }
    if (item.recordingStatus === "ready") {
      if (item.recordingParts?.length) {
        for (const part of item.recordingParts) {
          if (item.recordingParts.length > 1) {
            card.append(element("p", "admin-location-subtitle", part.title || `Part ${part.partNumber}`));
          }
          const video = element("video", "collaboration-recording-video");
          video.src = part.playbackUrl;
          video.controls = true;
          video.preload = "none";
          video.setAttribute("aria-label", `${item.programmeTitle} class recording from ${item.classDate}, part ${part.partNumber}`);
          card.append(video);
        }
      } else {
        const video = element("video", "collaboration-recording-video");
        video.src = item.playbackUrl;
        video.controls = true;
        video.preload = "none";
        video.setAttribute("aria-label", `${item.programmeTitle} class recording from ${item.classDate}`);
        card.append(video);
      }
      if (canDismiss && state.account?.role === "administrator") {
        const deleteButton = element("button", "small-action small-action-danger", "Move video to trash");
        deleteButton.type = "button";
        deleteButton.addEventListener("click", async () => {
          if (!window.confirm(
            "Move this class recording to Trash? It will be permanently deleted after 30 days unless restored.",
          )) return;
          deleteButton.disabled = true;
          try {
            await request(`/api/collaboration/recordings/${encodeURIComponent(item.sessionId)}`, {
              method: "DELETE",
              body: JSON.stringify({}),
            });
            await loadRecordings();
          } catch (error) {
            card.append(element("p", "admin-message is-error", error.message));
            deleteButton.disabled = false;
          }
        });
        card.append(deleteButton);
      }
    } else {
      card.append(element("span", `visibility-badge${item.recordingStatus === "failed" ? " is-hidden" : ""}`, item.recordingStatus));
      if (item.recordingError) card.append(element("p", "admin-message is-error", item.recordingError));
      if (item.recordingStatus === "failed") {
        card.append(element("p", "admin-location-subtitle", "The tutor can retry the upload from the live-class page while that page remains open."));
        if (canDismiss) {
          const deleteButton = element("button", "small-action small-action-danger", "Delete failed entry");
          deleteButton.type = "button";
          deleteButton.addEventListener("click", async () => {
            if (!window.confirm(
              state.account?.role === "teacher"
                ? "Remove this failed entry from My Live Classes? Class history and attendance will be kept."
                : "Hide this failed recording from General Classes? The tutor will still see it.",
            )) return;
            deleteButton.disabled = true;
            try {
              await request(`/api/collaboration/recordings/${encodeURIComponent(item.sessionId)}`, {
                method: "DELETE",
                body: JSON.stringify({}),
              });
              await loadRecordings();
            } catch (error) {
              card.append(element("p", "admin-message is-error", error.message));
              deleteButton.disabled = false;
            }
          });
          card.append(deleteButton);
        }
      }
    }
    return card;
  }

  async function loadRecordings() {
    const lists = [
      ...document.querySelectorAll("[data-collab-recordings], [data-collab-admin-recordings]"),
    ];
    if (!lists.length) return;
    try {
      const result = await request("/api/collaboration/recordings");
      for (const list of lists) {
        list.replaceChildren();
        let recordings = result.recordings;
        if (list.hasAttribute("data-collab-admin-recordings")) {
          const courses = new Map();
          for (const item of recordings) {
            if (!courses.has(item.programmeId)) courses.set(item.programmeId, []);
            courses.get(item.programmeId).push(item);
          }
          if (!courses.size) {
            setEmpty(list, "No class recordings are available yet.");
            continue;
          }
          for (const [courseId, items] of courses) {
            const group = element("details", "collaboration-recording-group");
            const heading = element("summary", "", `${items[0].programmeTitle} · ${items.length} classes`);
            group.append(heading);
            for (const item of items) group.append(renderRecording(item, true));
            list.append(group);
          }
          continue;
        }
        if (!recordings.length) setEmpty(list, "No class recordings are available yet.");
        else list.append(...recordings.map((item) =>
          renderRecording(item, state.account?.role === "teacher"),
        ));
      }
    } catch (error) {
      lists.forEach((list) => setEmpty(list, error.message));
    }
  }

  function notificationContainer() {
    let container = document.querySelector("[data-collab-notification-center]");
    if (container) return container;
    const sidebar = document.querySelector(
      "#student-dashboard .student-sidebar, #teacher-dashboard .student-sidebar, #dashboard-panel .admin-sidebar",
    );
    if (!sidebar) return null;
    container = element("section", "collaboration-notification-center");
    container.dataset.collabNotificationCenter = "";
    const count = element("span", "collaboration-notification-count", "0");
    count.dataset.collabNotificationCount = "";
    count.hidden = true;
    const trigger = element("button", "collaboration-notification-trigger");
    trigger.type = "button";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "collaboration-notification-panel");
    trigger.setAttribute("aria-label", "Notifications");
    trigger.dataset.collabNotificationTrigger = "";
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    const bell = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bell.setAttribute("d", "M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0");
    icon.append(bell);
    trigger.append(icon, element("span", "", "Notifications"), count);
    const panel = element("div", "collaboration-notification-panel");
    panel.id = "collaboration-notification-panel";
    panel.hidden = true;
    const header = element("div", "collaboration-notification-heading");
    header.append(
      element("h2", "", "Notifications"),
      makeButton("Close", () => {
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      }, "small-action"),
    );
    const liveStatus = element("p", "admin-field-hint");
    liveStatus.dataset.collabLiveStatus = "";
    const list = element("div", "collaboration-notification-list");
    list.dataset.collabNotificationList = "";
    panel.append(header, liveStatus, list);
    trigger.addEventListener("click", () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      trigger.setAttribute("aria-expanded", String(opening));
      if (opening) void loadNotifications();
    });
    container.append(trigger, panel);
    sidebar.prepend(container);
    return container;
  }

  async function loadNotifications() {
    const container = notificationContainer();
    if (!container) return;
    const list = container.querySelector("[data-collab-notification-list]");
    const requestRevision = ++notificationLoadRevision;
    try {
      const result = await request("/api/collaboration/notifications");
      if (requestRevision !== notificationLoadRevision) return;
      const count = container.querySelector("[data-collab-notification-count]");
      const unreadCount = Number(result.unreadCount) || 0;
      count.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      count.hidden = unreadCount === 0;
      container.querySelector("[data-collab-notification-trigger]").setAttribute(
        "aria-label",
        unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications",
      );
      list.replaceChildren();
      if (!result.notifications.length) setEmpty(list, "You are up to date.");
      for (const notification of result.notifications) {
        const card = element("article", "collaboration-notification is-unread");
        card.append(
          element("strong", "", notification.title),
          element("p", "", notification.body),
          element("time", "", formatDate(notification.createdAt)),
        );
        const liveSessionId = typeof notification.data?.liveSessionId === "string"
          ? notification.data.liveSessionId
          : "";
        if (liveSessionId) {
          const join = element("a", "small-action", "Join live class");
          join.href = `/live-class?sessionId=${encodeURIComponent(liveSessionId)}`;
          card.append(join);
        }
        card.append(makeButton("Mark read", async () => {
          try {
            await request(`/api/collaboration/notifications/${encodeURIComponent(notification.id)}/read`, {
              method: "POST",
              body: JSON.stringify({}),
            });
            notificationLoadRevision += 1;
            card.remove();
            await loadNotifications();
          } catch (error) {
            card.append(element("p", "admin-message is-error", error.message));
          }
        }, "small-action"));
        list.append(card);
      }
    } catch (error) {
      setEmpty(list, error.message);
    }
  }

  function refreshAll() {
    void loadTimetables();
    void loadSchedule();
    void loadLiveSessions();
    void loadRecordings();
    void loadNotifications();
    document.querySelectorAll("[data-collaboration-root]").forEach((root) => void loadChatContacts(root));
  }

  function connectEvents() {
    state.stream?.close();
    state.stream = new EventSource("/api/collaboration/events", { withCredentials: true });
    state.stream.onopen = () => {
      const status = document.querySelector("[data-collab-live-status]");
      if (status) status.textContent = "";
    };
    state.stream.onmessage = (message) => {
      let event;
      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }
      if (event.type === "chat-message" || event.type === "support-message") {
        document.querySelectorAll("[data-collaboration-root]").forEach((root) => {
          void loadChatContacts(root);
          if (state.selectedConversationId) void loadConversation(state.selectedConversationId, root);
        });
        if (event.type === "support-message") {
          window.dispatchEvent(new Event("tgf-support-message"));
          if (state.account?.role === "administrator") {
            window.dispatchEvent(new Event("tgf-admin-messages-open"));
          }
        }
      }
      if (event.type?.startsWith("timetable-") || event.type === "timetable-updated") {
        void loadTimetables();
        void loadSchedule();
      }
      if (event.type?.startsWith("recording-")) void loadRecordings();
      if (event.type === "notification") {
        void loadNotifications();
        void loadTimetables();
        void loadSchedule();
        void loadLiveSessions();
      }
      if (event.type === "recording-ready") void loadNotifications();
    };
    state.stream.onerror = () => {
      const status = document.querySelector("[data-collab-live-status]");
      if (status) status.textContent = "Live updates are reconnecting. You can refresh this page if needed.";
      state.stream?.close();
      window.setTimeout(() => {
        if (state.account) connectEvents();
      }, 5000);
    };
  }

  async function activate(account) {
    if (!account || !account.id && account.role !== "administrator") return;
    state.account = account;
    initializeDashboardPreferences();
    void loadDashboardPreferences();
    document.querySelectorAll("[data-collaboration-root]").forEach((root) => initializeChat(root));
    const teacherRoot = document.querySelector("[data-collab-tutor-timetable]");
    if (teacherRoot) initializeTimetableForm(teacherRoot);
    if (account.role === "teacher") {
      initializeGoLiveForm();
      void loadGoLiveCourses();
    }
    connectEvents();
    refreshAll();
    window.clearInterval(state.refreshTimer);
    state.refreshTimer = window.setInterval(refreshAll, 60000);
    window.clearInterval(state.scheduleRefreshTimer);
    state.scheduleRefreshTimer = window.setInterval(() => {
      void loadSchedule();
      void loadLiveSessions();
    }, 15000);
  }

  function initialize() {
    document.querySelectorAll("[data-collab-refresh]").forEach((button) => {
      button.addEventListener("click", () => {
        const type = button.dataset.collabRefresh;
        if (type === "timetable") {
          void loadTimetables();
          void loadSchedule();
        } else if (type === "recordings") {
          void loadRecordings();
        } else {
          document.querySelectorAll("[data-collaboration-root]").forEach((root) => void loadChatContacts(root));
        }
      });
    });
    document.querySelectorAll("[data-attendance-period]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedPeriod = button.dataset.attendancePeriod;
        document.querySelectorAll("[data-attendance-period]").forEach((item) => item.classList.toggle("is-selected", item === button));
        void loadSchedule();
      });
    });
    document.querySelectorAll("#admin-sidebar-nav [data-admin-view]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.adminView === "weekly-timetables") void loadTimetables();
        if (button.dataset.adminView === "general-classes") void loadRecordings();
      });
    });
    window.addEventListener("tgf-account-authenticated", () => {
      if (document.querySelector("#dashboard-panel") && !document.querySelector("#dashboard-panel").hidden) {
        void request("/api/admin/session").then((result) => {
          if (result.authenticated) return activate({ role: "administrator" });
        }).catch((error) => {
          setStatus(document.querySelector("[data-collab-admin-timetable-status]"), error.message, true);
        });
        return;
      }
      void request("/api/dashboard/session").then((result) => {
        if (result?.id && ["learner", "teacher"].includes(result.role)) return activate(result);
      }).catch((error) => {
        document.querySelectorAll("[data-collab-status]").forEach((target) => setStatus(target, error.message, true));
      });
    });
    window.addEventListener("tgf-account-signed-out", () => {
      state.account = null;
      state.stream?.close();
      setStatus(document.querySelector("[data-user-theme-status]"), "");
      window.clearInterval(state.refreshTimer);
      window.clearInterval(state.scheduleRefreshTimer);
      window.clearInterval(state.countdownTimer);
      state.countdownTimer = 0;
      state.serverNow = 0;
    });
    if (document.querySelector("#dashboard-panel") && !document.querySelector("#dashboard-panel").hidden) {
      void request("/api/admin/session").then((result) => {
        if (result.authenticated) return activate({ role: "administrator" });
      }).catch((error) => {
        setStatus(document.querySelector("[data-collab-admin-timetable-status]"), error.message, true);
      });
    } else if (
      (document.querySelector("#student-dashboard") && !document.querySelector("#student-dashboard").hidden) ||
      (document.querySelector("#teacher-dashboard") && !document.querySelector("#teacher-dashboard").hidden)
    ) {
      void request("/api/dashboard/session").then((result) => {
        if (result?.id && ["learner", "teacher"].includes(result.role)) return activate(result);
      }).catch((error) => {
        document.querySelectorAll("[data-collab-status]").forEach((target) => setStatus(target, error.message, true));
      });
    }
  }

  initialize();
})();
