// ============ CONFIG ============
const API_BASE = "https://agentbg.onrender.com";

// ============ STATE ============
let attachedFile = null;
const pollers = {};

// ============ PLATFORM CONFIG ============
const PLATFORMS = [
  { id: "github", name: "GitHub", icon: "🐙", type: "oauth" },
  { id: "render", name: "Render", icon: "⚡", type: "apikey", docsUrl: "https://render.com/docs/api" },
  { id: "railway", name: "Railway", icon: "🚂", type: "apikey", docsUrl: "https://docs.railway.app/reference/public-api" },
  { id: "vercel", name: "Vercel", icon: "▲", type: "apikey", docsUrl: "https://vercel.com/guides/how-do-i-use-a-vercel-api-access-token" },
  { id: "netlify", name: "Netlify", icon: "🌐", type: "apikey", docsUrl: "https://docs.netlify.com/api/get-started/" },
  { id: "codemagic", name: "CodeMagic", icon: "🔮", type: "apikey", docsUrl: "https://docs.codemagic.io/rest-api/codemagic-rest-api/" }
];

// ============ AUTH ============
function getToken() {
  return localStorage.getItem("deploybot_token");
}

function getHeaders(isJson = true) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (isJson) headers["Content-Type"] = "application/json";
  return headers;
}

function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const status = params.get("status");

  if (token && status === "success") {
    localStorage.setItem("deploybot_token", token);
    window.history.replaceState({}, document.title, window.location.pathname || "/");
    addBotMessage("✅ GitHub connected successfully! You can now deploy to GitHub.");
    loadConnectors();
  }
}

// ============ FETCH HELPERS ============
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.error || data.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

// ============ CHAT HISTORY ============
async function loadChatHistory() {
  try {
    const data = await fetchJson(`${API_BASE}/api/chat/history`, {
      headers: getHeaders(false)
    });

    const messages = normalizeHistory(data);
    if (!messages.length) return;

    document.getElementById("emptyState").classList.add("hidden");
    messages.forEach(renderHistoryMessage);
    scrollToBottom();
  } catch (error) {
    console.error("Failed to load history:", error);
  }
}

function normalizeHistory(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.messages)) return payload.messages;
  if (Array.isArray(payload.history)) return payload.history;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

function renderHistoryMessage(item) {
  const role = String(item.role || item.sender || item.type || "bot").toLowerCase();
  const text = item.text || item.message || item.content || item.reply || "";
  const fileMeta = item.file || item.attachment || null;
  const fileName = typeof fileMeta === "string" ? fileMeta : fileMeta?.name;
  const timestamp = item.createdAt || item.timestamp || item.time || null;

  if (role.includes("user")) {
    addUserMessage(text, fileName ? { name: fileName } : null, timestamp, false);
    return;
  }

  const jobId = item.jobId || item.job_id;
  if (jobId) {
    addBotMessageWithJob(text, jobId, item.platform, timestamp, false);
    if (item.deployStatus && typeof item.deployStatus === "object") {
      updateDeployCard(jobId, item.deployStatus);
    }
    return;
  }

  addBotMessage(text, timestamp, false);
}

// ============ MESSAGE SEND ============
async function sendMessage() {
  const input = document.getElementById("messageInput");
  const message = input.value.trim();
  const fileToSend = attachedFile;

  if (!message && !fileToSend) return;

  addUserMessage(message, fileToSend);

  input.value = "";
  input.style.height = "auto";
  clearAttachedFile();
  disableSend();

  const typingId = showTyping();

  try {
    const formData = new FormData();
    formData.append("message", message);
    if (fileToSend) formData.append("file", fileToSend);

    const data = await fetchJson(`${API_BASE}/api/chat/message`, {
      method: "POST",
      headers: {
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
      },
      body: formData
    });

    removeTyping(typingId);

    if (data.jobId) {
      addBotMessageWithJob(data.reply || "Deployment started.", data.jobId, data.platform);
      startPolling(data.jobId);
    } else {
      addBotMessage(data.reply || data.message || "Done.");
    }
  } catch (error) {
    removeTyping(typingId);
    addBotMessage(`❌ ${escapeHtml(error.message || "Error connecting to server. Please try again.")}`);
  }
}

// ============ DEPLOY POLLING ============
function startPolling(jobId) {
  stopPolling(jobId);

  const pollOnce = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/deploy/status/${jobId}`, {
        headers: getHeaders(false)
      });

      updateDeployCard(jobId, data);

      if (data.status === "success" || data.status === "failed") {
        stopPolling(jobId);
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  };

  pollOnce();
  pollers[jobId] = setInterval(pollOnce, 3000);
}

function stopPolling(jobId) {
  if (pollers[jobId]) {
    clearInterval(pollers[jobId]);
    delete pollers[jobId];
  }
}

// ============ DOM RENDERERS ============
function createMessageTime(timeValue) {
  return `<div class="message-time">${formatTime(timeValue)}</div>`;
}

function addUserMessage(text, file, timeValue = null, shouldScroll = true) {
  const chatWindow = document.getElementById("chatWindow");
  document.getElementById("emptyState").classList.add("hidden");

  const div = document.createElement("div");
  div.className = "message-user";
  div.innerHTML = `
    <div class="message-text">${renderRichText(text)}</div>
    ${file?.name ? `<div class="file-info">📎 ${escapeHtml(file.name)}</div>` : ""}
    ${createMessageTime(timeValue)}
  `;
  chatWindow.appendChild(div);

  if (shouldScroll) scrollToBottom();
}

function addBotMessage(text, timeValue = null, shouldScroll = true) {
  const chatWindow = document.getElementById("chatWindow");
  document.getElementById("emptyState").classList.add("hidden");

  const div = document.createElement("div");
  div.className = "message-bot";
  div.innerHTML = `
    <div class="bot-avatar">🤖</div>
    <div class="message-content">
      <div class="message-text">${renderRichText(text)}</div>
      ${createMessageTime(timeValue)}
    </div>
  `;
  chatWindow.appendChild(div);

  if (shouldScroll) scrollToBottom();
}

function addBotMessageWithJob(text, jobId, platform, timeValue = null, shouldScroll = true) {
  const chatWindow = document.getElementById("chatWindow");
  document.getElementById("emptyState").classList.add("hidden");

  const div = document.createElement("div");
  div.className = "message-bot";
  div.innerHTML = `
    <div class="bot-avatar">🤖</div>
    <div class="message-content">
      <div class="message-text">${renderRichText(text)}</div>
      <div class="deploy-card" id="job-${escapeHtml(String(jobId))}">
        <div class="deploy-title">🚀 Deploying to ${escapeHtml(platform || "platform")}...</div>
        <div class="deploy-steps" id="steps-${escapeHtml(String(jobId))}">
          <div class="deploy-step pending">⏳ Initializing...</div>
        </div>
        <div class="live-url-area" id="url-${escapeHtml(String(jobId))}" style="display:none"></div>
      </div>
      ${createMessageTime(timeValue)}
    </div>
  `;
  chatWindow.appendChild(div);

  if (shouldScroll) scrollToBottom();
}

function updateDeployCard(jobId, data) {
  const stepsContainer = document.getElementById(`steps-${jobId}`);
  const urlArea = document.getElementById(`url-${jobId}`);
  const title = document.querySelector(`#job-${cssEscape(String(jobId))} .deploy-title`);

  if (!stepsContainer) return;

  if (title && data.platform) {
    title.textContent = `🚀 Deploying to ${data.platform}...`;
  }

  if (Array.isArray(data.steps) && data.steps.length) {
    stepsContainer.innerHTML = data.steps
      .map((step) => {
        const stepStatus = step.status || "pending";
        const icon = stepStatus === "done"
          ? "✅"
          : stepStatus === "running"
            ? "🔄"
            : stepStatus === "failed"
              ? "❌"
              : "⏳";

        return `<div class="deploy-step ${escapeHtml(stepStatus)}">${icon} ${escapeHtml(step.label || "Step")}</div>`;
      })
      .join("");
  } else if (data.status) {
    const fallbackIcon = data.status === "success" ? "✅" : data.status === "failed" ? "❌" : "🔄";
    stepsContainer.innerHTML = `<div class="deploy-step ${escapeHtml(data.status)}">${fallbackIcon} ${escapeHtml(data.message || data.status)}</div>`;
  }

  const liveUrl = data.liveUrl || data.liveURL || data.url;
  if (liveUrl && urlArea) {
    urlArea.style.display = "block";
    urlArea.innerHTML = `
      <div class="live-url">
        🌐 Live: <a href="${escapeAttribute(liveUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(liveUrl)}</a>
      </div>
    `;
  }

  scrollToBottom();
}

function showTyping() {
  const chatWindow = document.getElementById("chatWindow");
  const id = `typing-${Date.now()}`;
  const div = document.createElement("div");
  div.className = "message-bot typing-wrapper";
  div.id = id;
  div.innerHTML = `
    <div class="bot-avatar">🤖</div>
    <div class="typing-indicator" aria-label="DeployBot is typing">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  chatWindow.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ============ CONNECTORS ============
async function loadConnectors() {
  try {
    const data = await fetchJson(`${API_BASE}/api/connectors`, {
      headers: getHeaders(false)
    });
    renderConnectors(data.connectors || data || {});
  } catch (error) {
    console.error("Failed to load connectors:", error);
    renderConnectors({});
  }
}

function renderConnectors(connectors) {
  const list = document.getElementById("connectorsList");
  const connected = PLATFORMS.filter((platform) => connectors[platform.id]?.connected);
  const disconnected = PLATFORMS.filter((platform) => !connectors[platform.id]?.connected);

  let html = "";

  if (connected.length > 0) {
    html += `<div class="connector-section-title">CONNECTED</div>`;
    connected.forEach((platform) => {
      html += `
        <div class="connector-item">
          <div class="connector-info">
            <span class="connector-icon">${platform.icon}</span>
            <div>
              <div class="connector-name">${platform.name}</div>
              <div class="status-dot connected">● Connected</div>
            </div>
          </div>
          <button class="disconnect-btn" type="button" onclick="disconnectConnector('${platform.id}')">Disconnect</button>
        </div>
      `;
    });
  }

  html += `<div class="connector-section-title">AVAILABLE</div>`;
  disconnected.forEach((platform) => {
    html += `
      <div class="connector-item">
        <div class="connector-info">
          <span class="connector-icon">${platform.icon}</span>
          <div>
            <div class="connector-name">${platform.name}</div>
            <div class="status-dot disconnected">● Not Connected</div>
          </div>
        </div>
        <button class="connect-btn" type="button" onclick="openConnectorModal('${platform.id}')">Connect</button>
      </div>
    `;
  });

  list.innerHTML = html;
}

function openConnectorModal(platformId) {
  const platform = PLATFORMS.find((item) => item.id === platformId);
  if (!platform) return;

  const modal = document.getElementById("connectorModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");

  title.textContent = `Connect ${platform.name}`;

  if (platform.type === "oauth") {
    body.innerHTML = `
      <p class="modal-copy">
        Click below to authorize DeployBot with your GitHub account. We only request repo and workflow permissions.
      </p>
      <button class="full-btn" type="button" onclick="connectGitHub()">🐙 Authorize with GitHub</button>
      <div class="inline-note">You will be redirected to GitHub and returned here after approval.</div>
    `;
  } else {
    body.innerHTML = `
      <p class="modal-copy">Enter your ${platform.name} API key below.</p>
      <input type="password" id="apiKeyInput" class="api-key-input" placeholder="${platform.name} API Key" autocomplete="off">
      <a href="${platform.docsUrl}" target="_blank" rel="noopener noreferrer" class="docs-link">📎 Where to find your API key?</a>
      <div class="modal-actions">
        <button class="cancel-btn" type="button" onclick="closeModal()">Cancel</button>
        <button class="save-btn" type="button" onclick="saveConnector('${platformId}')">Save & Connect</button>
      </div>
    `;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function connectGitHub() {
  window.location.href = `${API_BASE}/auth/github`;
}

async function saveConnector(platformId) {
  const apiKeyInput = document.getElementById("apiKeyInput");
  const apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";

  if (!apiKey) {
    alert("Please enter API key");
    return;
  }

  try {
    const data = await fetchJson(`${API_BASE}/api/connectors/save`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ platform: platformId, apiKey })
    });

    closeModal();
    loadConnectors();
    addBotMessage(`✅ ${data.message || `${platformId} connected successfully.`}`);
  } catch (error) {
    alert(`Failed: ${error.message}`);
  }
}

async function disconnectConnector(platformId) {
  if (!confirm(`Disconnect ${platformId}?`)) return;

  try {
    await fetchJson(`${API_BASE}/api/connectors/${platformId}`, {
      method: "DELETE",
      headers: getHeaders(false)
    });
    loadConnectors();
    addBotMessage(`🔌 ${platformId} disconnected.`);
  } catch (error) {
    alert(`Failed to disconnect: ${error.message}`);
  }
}

// ============ FILE ATTACHMENT ============
function bindFileInput() {
  document.getElementById("attachBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });

  document.getElementById("fileInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
      alert("File too large! Max 100MB.");
      event.target.value = "";
      return;
    }

    attachedFile = file;
    renderFileChip(file);
    checkSendEnabled();
  });
}

function renderFileChip(file) {
  const chip = document.getElementById("fileChip");
  chip.classList.remove("hidden");
  chip.innerHTML = `
    <span class="file-chip-text">📦 ${escapeHtml(file.name)} (${formatFileSize(file.size)})</span>
    <button class="file-chip-clear" type="button" onclick="clearAttachedFile()" aria-label="Remove attached file">❌</button>
  `;
}

function clearAttachedFile() {
  attachedFile = null;
  document.getElementById("fileInput").value = "";
  document.getElementById("fileChip").classList.add("hidden");
  document.getElementById("fileChip").innerHTML = "";
  checkSendEnabled();
}

// ============ SIDEBAR & MODAL ============
function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  sidebar.classList.remove("hidden");
  overlay.classList.remove("hidden");
  sidebar.setAttribute("aria-hidden", "false");

  requestAnimationFrame(() => {
    sidebar.classList.add("open");
  });

  loadConnectors();
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  sidebar.classList.remove("open");
  sidebar.setAttribute("aria-hidden", "true");
  overlay.classList.add("hidden");

  setTimeout(() => {
    if (!sidebar.classList.contains("open")) {
      sidebar.classList.add("hidden");
    }
  }, 300);
}

function closeModal() {
  const modal = document.getElementById("connectorModal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
}

// ============ UTILITIES ============
function scrollToBottom() {
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTime(value) {
  if (!value) return getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}

function escapeAttribute(value) {
  return String(value == null ? "" : value).replace(/"/g, "&quot;");
}

function renderRichText(text) {
  const safe = escapeHtml(text == null ? "" : String(text));
  return safe
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, "<br>");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function checkSendEnabled() {
  const input = document.getElementById("messageInput");
  const btn = document.getElementById("sendBtn");
  btn.disabled = !input.value.trim() && !attachedFile;
}

function disableSend() {
  document.getElementById("sendBtn").disabled = true;
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

// ============ EVENT BINDINGS ============
function bindEvents() {
  document.getElementById("sendBtn").addEventListener("click", sendMessage);

  document.getElementById("messageInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  document.getElementById("messageInput").addEventListener("input", (event) => {
    checkSendEnabled();
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
  });

  document.getElementById("menuBtn").addEventListener("click", openSidebar);
  document.getElementById("closeSidebar").addEventListener("click", closeSidebar);
  document.getElementById("sidebarOverlay").addEventListener("click", closeSidebar);
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("connectorModal").addEventListener("click", (event) => {
    if (event.target.id === "connectorModal") closeModal();
  });

  window.addEventListener("beforeunload", () => {
    Object.keys(pollers).forEach(stopPolling);
  });

  bindFileInput();
}

// ============ INIT ============
document.addEventListener("DOMContentLoaded", async () => {
  handleOAuthCallback();
  bindEvents();
  await Promise.allSettled([loadChatHistory(), loadConnectors()]);
  checkSendEnabled();
});
