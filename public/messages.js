(() => {
  const allowedTypes = new Map([
    [".pdf", "application/pdf"],
    [".doc", "application/msword"],
    [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".png", "image/png"],
    [".webp", "image/webp"],
    [".mp4", "video/mp4"],
    [".mov", "video/quicktime"],
    [".webm", "video/webm"],
  ]);
  const adminCenter = document.querySelector('[data-message-center="admin"]');
  const userCenter = document.querySelector('[data-message-center="user"]');
  let userCenterAvailable = false;
  const adminState = {
    recipient: null,
    recipients: [],
    maxAttachmentBytes: 25 * 1024 * 1024,
    maxMessageBytes: 100 * 1024 * 1024,
    maxAttachments: 5,
    pendingFiles: [],
    sending: false,
    activation: null,
    searchTimer: 0,
  };
  const userState = {
    maxAttachmentBytes: 25 * 1024 * 1024,
    maxMessageBytes: 100 * 1024 * 1024,
    maxAttachments: 5,
    pendingFiles: [],
    sending: false,
  };

  function syncUserCenterVisibility() {
    if (!userCenter) return;
    const isStudentCenter = userCenter.id === "student-messages";
    const shouldShow = userCenterAvailable &&
      (!isStudentCenter || window.location.hash === "#student-messages");
    userCenter.hidden = !shouldShow;
    if (shouldShow && isStudentCenter) {
      window.requestAnimationFrame(() => userCenter.scrollIntoView({ block: "start" }));
    }
  }

  window.addEventListener("hashchange", syncUserCenterVisibility);
  window.addEventListener("tgf-support-message", () => {
    if (userCenter && userCenterAvailable) {
      void loadUserThread(userCenter, userState).catch((error) => setStatus(userCenter, error.message, true));
    }
    if (adminCenter && !document.querySelector("#dashboard-panel")?.hidden) void loadAdminInbox();
  });
  window.addEventListener("tgf-account-signed-out", () => {
    userCenterAvailable = false;
    syncUserCenterVisibility();
  });

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function setStatus(root, message, isError = false) {
    const status = root.querySelector("[data-message-status]");
    status.textContent = message;
    status.classList.toggle("is-error", isError);
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers: { ...(options.headers || {}) },
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The server returned an unreadable response. Please try again.");
    }
    if (!response.ok) throw new Error(result.error || "The request could not be completed.");
    return result;
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
  }

  function fileTypeLabel(file) {
    const type = file.contentType || file.type || "";
    if (type === "application/pdf") return "PDF document";
    if (type.includes("wordprocessingml")) return "Word document";
    if (type === "application/msword") return "Word document";
    if (type.startsWith("image/")) return "Image";
    if (type.startsWith("video/")) return "Video";
    return "File";
  }

  function extensionFor(filename) {
    const index = filename.lastIndexOf(".");
    return index < 0 ? "" : filename.slice(index).toLowerCase();
  }

  function iconForFile(file) {
    const type = file.contentType || file.type || "";
    if (type.startsWith("image/")) return "IMAGE";
    if (type.startsWith("video/")) return "VIDEO";
    if (type === "application/pdf") return "PDF";
    if (type === "application/msword" || type.includes("wordprocessingml")) return "WORD";
    return "FILE";
  }

  function renderAttachment(attachment) {
    const card = makeElement("article", "message-attachment-card");
    const details = makeElement("div", "message-attachment-details");
    details.append(
      makeElement("span", "message-file-icon", iconForFile(attachment)),
      makeElement("strong", "message-attachment-name", attachment.fileName),
      makeElement(
        "span",
        "message-attachment-meta",
        `${fileTypeLabel(attachment)} · ${formatBytes(attachment.fileSize)}`,
      ),
    );
    card.append(details);
    const link = (label, className = "") => {
      const anchor = makeElement("a", className, label);
      anchor.href = attachment.url;
      anchor.rel = "noopener noreferrer";
      anchor.target = "_blank";
      return anchor;
    };
    if ((attachment.contentType || "").startsWith("image/")) {
      const previewLink = link("Open full image", "message-attachment-action");
      const image = makeElement("img", "message-image-preview");
      image.src = attachment.url;
      image.alt = `Preview of ${attachment.fileName}`;
      image.loading = "lazy";
      image.addEventListener("error", () => {
        image.hidden = true;
        previewLink.textContent = "Image preview unavailable — open full image";
      }, { once: true });
      card.append(image, previewLink);
    } else if ((attachment.contentType || "").startsWith("video/")) {
      const video = makeElement("video", "message-video-preview");
      video.controls = true;
      video.preload = "metadata";
      const source = document.createElement("source");
      source.src = attachment.url;
      source.type = attachment.contentType;
      video.append(source);
      const download = link("Download video", "message-attachment-action");
      download.download = attachment.fileName;
      card.append(video, download);
    } else if (attachment.contentType === "application/pdf") {
      card.append(
        link("View PDF", "message-attachment-action"),
        link("Download PDF", "message-attachment-action"),
      );
      card.querySelectorAll("a").forEach((anchor, index) => {
        if (index === 1) anchor.download = attachment.fileName;
      });
    } else {
      const download = link("Download document", "message-attachment-action");
      download.download = attachment.fileName;
      card.append(download);
    }
    return card;
  }

  function renderMessages(root, messages) {
    const thread = root.querySelector("[data-message-thread]");
    thread.replaceChildren();
    if (messages.length === 0) {
      thread.append(makeElement("p", "message-thread-empty", "No messages yet. Send a message to start the conversation."));
      return;
    }
    for (const message of messages) {
      const article = makeElement("article", `message-bubble${message.isOwn ? " is-own" : ""}`);
      const heading = makeElement("div", "message-bubble-heading");
      heading.append(
        makeElement("strong", "", message.senderName),
        makeElement("time", "", formatDate(message.createdAt)),
      );
      if (message.readStatus) {
        heading.append(makeElement("span", "message-read-status", message.readStatus));
      }
      article.append(heading);
      if (message.body) article.append(makeElement("p", "message-bubble-body", message.body));
      if (message.attachments.length) {
        const attachments = makeElement("div", "message-attachment-list");
        for (const attachment of message.attachments) attachments.append(renderAttachment(attachment));
        article.append(attachments);
      }
      thread.append(article);
    }
    thread.scrollTop = thread.scrollHeight;
  }

  function filePreviewCard(file, index, state, root) {
    const card = makeElement("article", "message-preview-card");
    const extension = extensionFor(file.name);
    const label = makeElement("span", "message-file-icon", iconForFile(file));
    const content = makeElement("div", "message-preview-details");
    content.append(
      makeElement("strong", "", file.name),
      makeElement("span", "", `${fileTypeLabel(file)} · ${formatBytes(file.size)}`),
    );
    card.append(label, content);
    if (file.type.startsWith("image/")) {
      const preview = makeElement("img", "message-local-preview");
      preview.src = file.previewUrl;
      preview.alt = `Selected image preview: ${file.name}`;
      card.append(preview);
    } else if (file.type.startsWith("video/")) {
      const preview = makeElement("video", "message-local-preview");
      preview.src = file.previewUrl;
      preview.muted = true;
      preview.preload = "metadata";
      card.append(preview);
    } else {
      label.textContent = extension.slice(1).toUpperCase() || "FILE";
    }
    const remove = makeElement("button", "message-remove-file", "Remove");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${file.name}`);
    remove.disabled = state.sending;
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(file.previewUrl);
      state.pendingFiles.splice(index, 1);
      renderPreviews(root, state);
    });
    card.append(remove);
    return card;
  }

  function renderPreviews(root, state) {
    const previews = root.querySelector("[data-message-previews]");
    previews.replaceChildren();
    state.pendingFiles.forEach((file, index) => previews.append(filePreviewCard(file, index, state, root)));
    updateComposer(root, state);
  }

  function updateComposer(root, state) {
    const limits = root.querySelector("[data-message-limits]");
    if (limits) {
      limits.textContent =
        `PDF, Word, JPG, PNG, WebP, MP4, MOV or WebM · ${formatBytes(state.maxAttachmentBytes)} max per file · ${formatBytes(state.maxMessageBytes)} max per message · up to ${state.maxAttachments} files.`;
    }
    const recipientSelected = root === userCenter || Boolean(state.recipient);
    const body = root.querySelector("[data-message-body]").value.trim();
    root.querySelector("[data-message-send]").disabled =
      !recipientSelected || state.sending || (!body && state.pendingFiles.length === 0);
    root.querySelector("[data-message-files]").disabled = state.sending || !recipientSelected;
  }

  function clearDraft(root, state) {
    for (const file of state.pendingFiles) URL.revokeObjectURL(file.previewUrl);
    state.pendingFiles = [];
    root.querySelector("[data-message-body]").value = "";
    root.querySelector("[data-message-files]").value = "";
    root.querySelector("[data-message-progress]").hidden = true;
    root.querySelector("[data-message-progress]").value = 0;
    renderPreviews(root, state);
  }

  function attachComposer(root, state, getEndpoint) {
    const input = root.querySelector("[data-message-files]");
    const body = root.querySelector("[data-message-body]");
    input.addEventListener("change", () => {
      const selected = [...input.files];
      input.value = "";
      let totalBytes = state.pendingFiles.reduce((sum, file) => sum + file.size, 0);
      for (const file of selected) {
        const extension = extensionFor(file.name);
        const expectedType = allowedTypes.get(extension);
        if (!expectedType || file.type !== expectedType) {
          setStatus(root, `${file.name} is not a supported file type.`, true);
          continue;
        }
        if (file.size < 1 || file.size > state.maxAttachmentBytes) {
          setStatus(root, `${file.name} exceeds the ${formatBytes(state.maxAttachmentBytes)} per-file limit.`, true);
          continue;
        }
        if (state.pendingFiles.length >= state.maxAttachments) {
          setStatus(root, `Attach no more than ${state.maxAttachments} files per message.`, true);
          break;
        }
        if (totalBytes + file.size > state.maxMessageBytes) {
          setStatus(root, "The selected attachments exceed the total message size limit.", true);
          break;
        }
        file.previewUrl = URL.createObjectURL(file);
        state.pendingFiles.push(file);
        totalBytes += file.size;
      }
      renderPreviews(root, state);
    });
    body.addEventListener("input", () => updateComposer(root, state));
    root.querySelector("[data-message-refresh]").addEventListener("click", () => {
      if (root === adminCenter) void loadAdminInbox();
      else void loadUserThread(root, state);
    });
    root.querySelector("[data-message-form]").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (state.sending || (root === adminCenter && !state.recipient) ||
          (!body.value.trim() && state.pendingFiles.length === 0)) return;
      state.sending = true;
      updateComposer(root, state);
      const progress = root.querySelector("[data-message-progress]");
      progress.hidden = state.pendingFiles.length === 0;
      progress.value = 0;
      setStatus(root, state.pendingFiles.length ? "Uploading attachments…" : "Sending message…");
      try {
        await sendMessageForm(getEndpoint(), body.value.trim(), state.pendingFiles, (percent) => {
          progress.value = percent;
          setStatus(root, percent < 100
            ? `Uploading attachments… ${percent}%`
            : "Finishing secure upload and sending…");
        });
        clearDraft(root, state);
        setStatus(root, "Message sent.");
        if (root === adminCenter) {
          await Promise.all([loadAdminThread(state.recipient), loadAdminInbox()]);
        } else {
          await loadUserThread(root, state);
        }
      } catch (error) {
        setStatus(root, error.message, true);
      } finally {
        state.sending = false;
        progress.hidden = true;
        updateComposer(root, state);
        renderPreviews(root, state);
      }
    });
    renderPreviews(root, state);
  }

  function sendMessageForm(endpoint, message, files, onProgress) {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append("body", message);
      for (const file of files) form.append("attachments", file, file.name);
      const request = new XMLHttpRequest();
      request.open("POST", endpoint);
      request.withCredentials = true;
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener("load", () => {
        let result;
        try {
          result = JSON.parse(request.responseText);
        } catch {
          reject(new Error("The server returned an unreadable response. Please try again."));
          return;
        }
        if (request.status < 200 || request.status >= 300) {
          reject(new Error(result.error || "The message could not be sent."));
          return;
        }
        resolve(result);
      });
      request.addEventListener("error", () => reject(new Error("The upload failed. Check your connection and try again.")));
      request.addEventListener("abort", () => reject(new Error("The upload was cancelled.")));
      request.send(form);
    });
  }

  async function loadUserThread(root, state) {
    const thread = root.querySelector("[data-message-thread]");
    if (!thread.children.length) thread.append(makeElement("p", "message-thread-empty", "Loading messages…"));
    try {
      const result = await requestJson("/api/messages");
      state.maxAttachmentBytes = result.maxAttachmentBytes;
      state.maxMessageBytes = result.maxMessageBytes;
      state.maxAttachments = result.maxAttachments;
      renderMessages(root, result.messages);
      updateComposer(root, state);
      setStatus(root, "");
    } catch (error) {
      setStatus(root, error.message, true);
      throw error;
    }
  }

  async function activateUserCenter() {
    if (!userCenter || userState.activation) return userState.activation;
    userState.activation = (async () => {
      let account;
      try {
        account = await requestJson("/api/dashboard/session");
      } catch {
        userCenterAvailable = false;
        syncUserCenterVisibility();
        return;
      }
      if (account.role === "administrator" || account.accountStatus !== "active" || account.mustChangePassword) {
        userCenterAvailable = false;
        syncUserCenterVisibility();
        return;
      }
      userCenterAvailable = true;
      syncUserCenterVisibility();
      try {
        await loadUserThread(userCenter, userState);
      } catch {
        syncUserCenterVisibility();
      }
    })();
    try {
      await userState.activation;
    } finally {
      userState.activation = null;
    }
  }

  function renderAdminRecipients(recipients) {
    const list = adminCenter.querySelector("[data-message-recipients]");
    list.replaceChildren();
    if (!recipients.length) {
      list.append(makeElement("p", "message-thread-empty", "No active accounts match your search."));
      return;
    }
    for (const recipient of recipients) {
      const button = makeElement("button", "message-recipient");
      button.type = "button";
      button.dataset.userId = recipient.userId;
      button.classList.toggle("is-selected", recipient.userId === adminState.recipient?.userId);
      const details = makeElement("span", "message-recipient-details");
      details.append(
        makeElement("strong", "", recipient.fullName),
        makeElement("small", "", `${recipient.role.replace(/_/g, " ")} · ${recipient.email}`),
        makeElement("small", "message-recipient-last", recipient.lastMessage || "Start a conversation"),
      );
      button.append(details);
      if (recipient.unreadCount) {
        button.append(makeElement("span", "message-unread-count", String(recipient.unreadCount)));
      }
      button.addEventListener("click", () => void selectAdminRecipient(recipient));
      list.append(button);
    }
  }

  async function loadAdminInbox() {
    const list = adminCenter.querySelector("[data-message-recipients]");
    const query = adminCenter.querySelector("#admin-message-search").value.trim();
    list.setAttribute("aria-busy", "true");
    try {
      const result = await requestJson(`/api/admin/messages?search=${encodeURIComponent(query)}`);
      adminState.recipients = result.recipients;
      adminState.maxAttachmentBytes = result.maxAttachmentBytes;
      adminState.maxMessageBytes = result.maxMessageBytes;
      adminState.maxAttachments = result.maxAttachments;
      renderAdminRecipients(result.recipients);
      const count = document.querySelector("#admin-messages-nav-count");
      count.textContent = String(result.unreadCount);
      count.hidden = result.unreadCount === 0;
      if (adminState.recipient) {
        const updatedRecipient = result.recipients.find((row) => row.userId === adminState.recipient.userId);
        if (updatedRecipient) adminState.recipient = updatedRecipient;
      }
    } catch (error) {
      list.replaceChildren(makeElement("p", "admin-message is-error", error.message));
    } finally {
      list.removeAttribute("aria-busy");
    }
  }

  async function loadAdminThread(recipient = adminState.recipient) {
    if (!recipient) return;
    const title = adminCenter.querySelector("[data-message-recipient-title]");
    const subtitle = adminCenter.querySelector("[data-message-recipient-subtitle]");
    title.textContent = recipient.fullName;
    subtitle.textContent = `${recipient.role.replace(/_/g, " ")} · ${recipient.email}`;
    adminCenter.querySelector("[data-message-thread]").replaceChildren(
      makeElement("p", "message-thread-empty", "Loading conversation…"),
    );
    try {
      const result = await requestJson(`/api/admin/messages/${encodeURIComponent(recipient.userId)}`);
      adminState.maxAttachmentBytes = result.maxAttachmentBytes;
      adminState.maxMessageBytes = result.maxMessageBytes;
      adminState.maxAttachments = result.maxAttachments;
      renderMessages(adminCenter, result.messages);
      updateComposer(adminCenter, adminState);
      setStatus(adminCenter, "");
    } catch (error) {
      setStatus(adminCenter, error.message, true);
      adminCenter.querySelector("[data-message-thread]").replaceChildren(
        makeElement("p", "message-thread-empty", error.message),
      );
    }
  }

  async function selectAdminRecipient(recipient) {
    if (adminState.recipient?.userId !== recipient.userId &&
        (adminCenter.querySelector("[data-message-body]").value.trim() || adminState.pendingFiles.length)) {
      if (!window.confirm("Discard the unsent message and attachments before changing conversations?")) return;
      clearDraft(adminCenter, adminState);
    }
    adminState.recipient = recipient;
    adminCenter.querySelector("[data-message-send]").disabled = true;
    renderAdminRecipients(adminState.recipients);
    await loadAdminThread(recipient);
    await loadAdminInbox();
    updateComposer(adminCenter, adminState);
  }

  function initializeAdminCenter() {
    attachComposer(adminCenter, adminState, () =>
      adminState.recipient
        ? `/api/admin/messages/${encodeURIComponent(adminState.recipient.userId)}`
        : "",
    );
    adminCenter.querySelector("#admin-message-search").addEventListener("input", () => {
      window.clearTimeout(adminState.searchTimer);
      adminState.searchTimer = window.setTimeout(() => void loadAdminInbox(), 250);
    });
    window.addEventListener("tgf-admin-messages-open", () => void loadAdminInbox());
    if (!document.querySelector("#dashboard-panel")?.hidden &&
        !document.querySelector('[data-admin-view-panel="messages"]')?.hidden) {
      void loadAdminInbox();
    }
  }

  if (userCenter) {
    attachComposer(userCenter, userState, () => "/api/messages");
    window.addEventListener("tgf-account-authenticated", () => void activateUserCenter());
    void activateUserCenter();
  }
  if (adminCenter) initializeAdminCenter();
})();
