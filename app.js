// ============ CONFIG ============
const API_BASE = "https://agentupgragebg.onrender.com";

// ============ STATE ============
let attachedFile = null;
const pollers = {};
const sseConnections = {};
const dismissedWarnings = {};
const jobMeta = {};

const PLATFORMS = [
  { id: "github", name: "GitHub", icon: "🐙", type: "oauth" },
  { id: "render", name: "Render", icon: "⚡", type: "apikey", docsUrl: "https://render.com/docs/api" },
  { id: "railway", name: "Railway", icon: "🚂", type: "apikey", docsUrl: "https://docs.railway.app/reference/public-api" },
  { id: "vercel", name: "Vercel", icon: "▲", type: "apikey", docsUrl: "https://vercel.com/guides/how-do-i-use-a-vercel-api-access-token" },
  { id: "netlify", name: "Netlify", icon: "🌐", type: "apikey", docsUrl: "https://docs.netlify.com/api/get-started/" },
  { id: "codemagic", name: "CodeMagic", icon: "🔮", type: "apikey", docsUrl: "https://docs.codemagic.io/rest-api/codemagic-rest-api/" }
];

function getPlatform(id) {
  return PLATFORMS.find((p) => p.id === id) || { id, name: id || "Platform", icon: "🚀" };
}

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
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    const message = data.error || data.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

async function safeFetch(url, options = {}) {
  try {
    return await fetchJson(url, options);
  } catch (err) {
    console.warn("[safeFetch]", url, err.message);
    return null;
  }
}

// ============ THEME ============
function applyTheme(theme) {
  const btn = document.getElementById("themeToggle");
  if (theme === "light") {
    document.body.classList.add("theme-light");
    if (btn) { btn.textContent = "☀️"; btn.setAttribute("aria-label", "Switch to dark theme"); }
  } else {
    document.body.classList.remove("theme-light");
    if (btn) { btn.textContent = "🌙"; btn.setAttribute("aria-label", "Switch to light theme"); }
  }
}

function toggleTheme() {
  const current = localStorage.getItem("deploybot-theme") === "light" ? "light" : "dark";
  const next = current === "light" ? "dark" : "light";
  localStorage.setItem("deploybot-theme", next);
  applyTheme(next);
}

function loadTheme() {
  const saved = localStorage.getItem("deploybot-theme") || "dark";
  applyTheme(saved);
}

// ============ CHAT HISTORY ============
async function loadChatHistory() {
  try {
    const data = await fetchJson(`${API_BASE}/api/chat/history`, { headers: getHeaders(false) });
    const messages = normalizeHistory(data);
    if (!messages.length) return;
    document.getElementById("emptyState").classList.add("hidden");
    messages.forEach(renderHistoryMessage);
    scrollToBottom();
  } catch (err) {
    console.error("Failed to load history:", err);
  }
}

function normalizeHistory(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.messages)) return payload.messages;
  if (payload && Array.isArray(payload.history)) return payload.history;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function renderHistoryMessage(item) {
  const role = String(item.role || item.sender || item.type || "bot").toLowerCase();
  const text = item.text || item.message || item.content || item.reply || "";
  const fileMeta = item.file || item.attachment || null;
  const fileName = typeof fileMeta === "string" ? fileMeta : fileMeta && fileMeta.name;
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
      headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
      body: formData
    });

    removeTyping(typingId);

    if (data.jobId) {
      addBotMessageWithJob(data.reply || "Deployment started.", data.jobId, data.platform);
      startPolling(data.jobId);
      openLogStream(data.jobId);
      schedSecretsCheck(data.jobId);
    } else {
      addBotMessage(data.reply || data.message || "Done.");
    }
  } catch (err) {
    removeTyping(typingId);
    addBotMessage(`❌ ${err.message || "Error connecting to server. Please try again."}`);
  }
}

// ============ POLLING ============
function startPolling(jobId) {
  stopPolling(jobId);
  const pollOnce = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/deploy/status/${jobId}`, { headers: getHeaders(false) });
      updateDeployCard(jobId, data);
      if (data.status === "success" || data.status === "failed") {
        stopPolling(jobId);
        closeLogStream(jobId, data.status);
        if (data.status === "failed") showFixButton(jobId);
      }
    } catch (err) {
      console.error("Polling error:", err);
    }
  };
  pollOnce();
  pollers[jobId] = setInterval(pollOnce, 2000);
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
    ${file && file.name ? `<div class="file-info">📎 ${escapeHtml(file.name)}</div>` : ""}
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
    <button class="copy-message-btn" type="button" aria-label="Copy message">📋 Copy</button>
  `;
  bindCopyButton(div, text);
  chatWindow.appendChild(div);
  if (shouldScroll) scrollToBottom();
}

function bindCopyButton(messageEl, text) {
  const btn = messageEl.querySelector(".copy-message-btn");
  if (!btn) return;
  btn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const raw = typeof text === "string" ? text : (messageEl.querySelector(".message-text") || {}).innerText || "";
    try {
      await navigator.clipboard.writeText(raw);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = raw;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (_) {}
      document.body.removeChild(ta);
    }
    btn.classList.add("copied");
    btn.textContent = "✓ Copied!";
    setTimeout(() => { btn.classList.remove("copied"); btn.textContent = "📋 Copy"; }, 2000);
  });
}

function addBotMessageWithJob(text, jobId, platform, timeValue = null, shouldScroll = true) {
  const chatWindow = document.getElementById("chatWindow");
  document.getElementById("emptyState").classList.add("hidden");
  jobMeta[jobId] = { platform: platform || "platform" };

  const safeJob = escapeHtml(String(jobId));

  const div = document.createElement("div");
  div.className = "message-bot";
  div.dataset.jobId = jobId;
  div.innerHTML = `
    <div class="bot-avatar">🤖</div>
    <div class="message-content">
      <div class="message-text">${renderRichText(text)}</div>
      <div class="deploy-card" id="job-${safeJob}">
        <div class="deploy-title">
          <span>🚀 Deploying to ${escapeHtml(platform || "platform")}</span>
          <span class="status-badge running" id="badge-${safeJob}">🔄 Running</span>
        </div>
        <div class="progress-track"><div class="progress-bar" id="prog-${safeJob}"></div></div>
        <div class="deploy-status-line"><span id="stepcount-${safeJob}">Step 0 / 7</span></div>
        <div class="deploy-steps" id="steps-${safeJob}">
          <div class="deploy-step pending">⏳ Initializing...</div>
        </div>
        <div class="live-url-area" id="url-${safeJob}" style="display:none"></div>
        <div class="warning-area" id="warn-${safeJob}"></div>
        <button class="log-toggle" type="button" data-job="${safeJob}" aria-expanded="false">
          <span class="log-toggle-left"><span>📟 Live Logs</span></span>
          <span class="log-state" id="logstate-${safeJob}"><span class="live-dot blink"></span> LIVE</span>
        </button>
        <div class="log-panel hidden" id="log-${safeJob}">
          <div class="log-empty">// Waiting for logs...</div>
        </div>
        <div class="fix-action" id="fix-${safeJob}"></div>
      </div>
      ${createMessageTime(timeValue)}
    </div>
    <button class="copy-message-btn" type="button" aria-label="Copy message">📋 Copy</button>
  `;
  bindCopyButton(div, text);
  chatWindow.appendChild(div);

  const toggle = div.querySelector(".log-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => toggleLogPanel(jobId));
  }
  if (shouldScroll) scrollToBottom();
}

function toggleLogPanel(jobId) {
  const panel = document.getElementById(`log-${jobId}`);
  const toggle = document.querySelector(`.log-toggle[data-job="${cssEscape(jobId)}"]`);
  if (!panel) return;
  const isHidden = panel.classList.contains("hidden");
  panel.classList.toggle("hidden");
  if (toggle) toggle.setAttribute("aria-expanded", isHidden ? "true" : "false");
}

function updateDeployCard(jobId, data) {
  const stepsContainer = document.getElementById(`steps-${jobId}`);
  const urlArea = document.getElementById(`url-${jobId}`);
  const badge = document.getElementById(`badge-${jobId}`);
  const progress = document.getElementById(`prog-${jobId}`);
  const stepCount = document.getElementById(`stepcount-${jobId}`);
  if (!stepsContainer) return;

  if (jobMeta[jobId] && data.platform) jobMeta[jobId].platform = data.platform;

  let stepsArr = Array.isArray(data.steps) ? data.steps : [];
  if (stepsArr.length) {
    stepsContainer.innerHTML = stepsArr.map((step) => {
      const status = step.status || "pending";
      const icon = status === "done" || status === "success" ? "✅"
        : status === "running" ? "🔄"
        : status === "failed" || status === "error" ? "❌"
        : "⏳";
      return `<div class="deploy-step ${escapeHtml(status)}">${icon} ${escapeHtml(step.label || step.name || "Step")}</div>`;
    }).join("");
  } else if (data.status) {
    const ic = data.status === "success" ? "✅" : data.status === "failed" ? "❌" : "🔄";
    stepsContainer.innerHTML = `<div class="deploy-step ${escapeHtml(data.status)}">${ic} ${escapeHtml(data.message || data.status)}</div>`;
  }

  // Progress
  const total = Number(data.totalSteps) || 7;
  const completed = stepsArr.filter((s) => s.status === "done" || s.status === "success").length;
  const pct = Math.max(0, Math.min(100, (completed / total) * 100));
  if (progress) {
    progress.style.width = `${pct || (data.status === "running" ? 8 : 0)}%`;
    progress.classList.remove("success", "failed");
    if (data.status === "success") { progress.style.width = "100%"; progress.classList.add("success"); }
    if (data.status === "failed") progress.classList.add("failed");
  }
  if (stepCount) stepCount.textContent = `Step ${completed} / ${total}`;

  if (badge) {
    badge.classList.remove("running", "success", "failed");
    if (data.status === "success") { badge.classList.add("success"); badge.textContent = "✅ Success"; }
    else if (data.status === "failed") { badge.classList.add("failed"); badge.textContent = "❌ Failed"; }
    else { badge.classList.add("running"); badge.textContent = "🔄 Running"; }
  }

  const liveUrl = data.liveUrl || data.liveURL || data.url;
  if (liveUrl && urlArea) {
    urlArea.style.display = "block";
    urlArea.innerHTML = `<div class="live-url">🌐 Live: <a href="${escapeAttribute(liveUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(liveUrl)}</a></div>`;
  }
}

function showTyping() {
  const chatWindow = document.getElementById("chatWindow");
  const id = `typing-${Date.now()}`;
  const div = document.createElement("div");
  div.className = "message-bot typing-wrapper";
  div.id = id;
  div.innerHTML = `
    <div class="bot-avatar">🤖</div>
    <div class="typing-bubble" aria-label="DeployBot is typing">
      <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
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

// ============ SSE LIVE LOGS ============
function openLogStream(jobId) {
  if (sseConnections[jobId]) return;
  if (typeof EventSource === "undefined") return;
  let es;
  try {
    es = new EventSource(`${API_BASE}/api/deploy/logs/${jobId}`);
  } catch (err) {
    console.warn("SSE failed:", err);
    return;
  }
  sseConnections[jobId] = es;

  const panel = document.getElementById(`log-${jobId}`);
  if (panel) panel.innerHTML = "";

  es.onmessage = (e) => appendLog(jobId, e.data);
  es.addEventListener("log", (e) => appendLog(jobId, e.data));
  es.addEventListener("done", () => closeLogStream(jobId, "success"));
  es.addEventListener("error", () => closeLogStream(jobId, "failed"));
  es.onerror = () => { /* keep open silently; pollers may close it */ };
}

function appendLog(jobId, raw) {
  const panel = document.getElementById(`log-${jobId}`);
  if (!panel) return;
  let line = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") line = parsed.message || parsed.line || parsed.log || raw;
  } catch (_) {}
  const div = document.createElement("div");
  div.textContent = String(line);
  panel.appendChild(div);
  panel.scrollTop = panel.scrollHeight;
}

function closeLogStream(jobId, status) {
  const es = sseConnections[jobId];
  if (es) { try { es.close(); } catch (_) {} delete sseConnections[jobId]; }
  const state = document.getElementById(`logstate-${jobId}`);
  if (state) {
    state.classList.remove("blink");
    state.classList.add("done");
    state.innerHTML = `✓ Done`;
  }
}

// ============ SECRETS WARNINGS ============
function schedSecretsCheck(jobId) {
  setTimeout(async () => {
    if (dismissedWarnings[jobId]) return;
    const data = await safeFetch(`${API_BASE}/api/deploy/warnings/${jobId}`, { headers: getHeaders(false) });
    if (!data) return;
    const warnings = data.warnings || data.secrets || data.items || [];
    if (!Array.isArray(warnings) || !warnings.length) return;
    renderWarningBanner(jobId, warnings);
  }, 5000);
}

function renderWarningBanner(jobId, warnings) {
  const area = document.getElementById(`warn-${jobId}`);
  if (!area) return;
  const items = warnings.map((w) => {
    if (typeof w === "string") return w;
    const k = w.key || w.name || "secret";
    const f = w.file || w.path || "?";
    return `${k} in ${f}`;
  });
  area.innerHTML = `
    <div class="warning-banner" role="alert">
      <div>
        ⚠️ Secrets detected in your code: <span>${escapeHtml(items.join(", "))}</span>
        <small>Deployment continued but fix these before going public.</small>
      </div>
      <button class="banner-close" type="button" aria-label="Dismiss warning">✕</button>
    </div>
  `;
  const btn = area.querySelector(".banner-close");
  if (btn) btn.addEventListener("click", () => { dismissedWarnings[jobId] = true; area.innerHTML = ""; });
}

// ============ AI FIX BUTTON ============
function showFixButton(jobId) {
  const area = document.getElementById(`fix-${jobId}`);
  if (!area || area.querySelector(".inline-btn")) return;
  area.innerHTML = `<button class="inline-btn" type="button">🔧 Ask AI to fix this</button>`;
  area.querySelector("button").addEventListener("click", () => requestFix(jobId));
}

async function requestFix(jobId) {
  const area = document.getElementById(`fix-${jobId}`);
  if (!area) return;
  area.innerHTML = `<button class="inline-btn" type="button" disabled><span class="spinner"></span> &nbsp;Analyzing failure...</button>`;
  try {
    const data = await fetchJson(`${API_BASE}/api/deploy/fix/${jobId}`, { method: "POST", headers: getHeaders() });
    const suggestion = data.suggestion || data.fix || data.message || "No suggestion returned.";
    renderFixCard(jobId, suggestion);
  } catch (err) {
    area.innerHTML = `<button class="inline-btn" type="button">🔧 Ask AI to fix this</button>`;
    area.querySelector("button").addEventListener("click", () => requestFix(jobId));
    addBotMessage(`❌ Could not fetch AI fix: ${err.message}`);
  }
}

function renderFixCard(jobId, suggestion) {
  const area = document.getElementById(`fix-${jobId}`);
  if (!area) return;
  area.innerHTML = `
    <div class="fix-card">
      <div class="fix-card-title">🔧 AI Suggested Fix</div>
      <div class="fix-card-body">${formatFixText(suggestion)}</div>
      <div class="fix-card-actions">
        <button class="secondary-btn" type="button">📋 Copy suggestion</button>
      </div>
    </div>
  `;
  const copyBtn = area.querySelector(".secondary-btn");
  copyBtn.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(suggestion); } catch (_) {}
    copyBtn.textContent = "✓ Copied!";
    setTimeout(() => { copyBtn.textContent = "📋 Copy suggestion"; }, 2000);
  });
}

function formatFixText(text) {
  const safe = escapeHtml(String(text || ""));
  // Replace ``` blocks
  const withCode = safe.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code}</code></pre>`);
  return withCode.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\n/g, "<br>");
}

// ============ CONNECTORS ============
async function loadConnectors() {
  try {
    const data = await fetchJson(`${API_BASE}/api/connectors`, { headers: getHeaders(false) });
    renderConnectors(data.connectors || data || {});
  } catch (err) {
    console.error("Failed to load connectors:", err);
    renderConnectors({});
  }
  renderNotificationsSection();
  loadSchedules();
  loadNotificationsStatus();
}

function renderConnectors(connectors) {
  const list = document.getElementById("connectorsList");
  const connected = PLATFORMS.filter((p) => connectors[p.id] && connectors[p.id].connected);
  const disconnected = PLATFORMS.filter((p) => !(connectors[p.id] && connectors[p.id].connected));

  let html = `
    <div class="section-block">
      <div class="section-head"><span class="section-title">CONNECTED PLATFORMS</span></div>
      <div class="section-panel" id="connectedPanel">
        ${connected.length ? connected.map(connectorCardHtml).join("") : `<div class="empty-mini">No platforms connected yet.</div>`}
      </div>
    </div>

    <div class="section-block">
      <div class="section-head"><span class="section-title">AVAILABLE</span></div>
      <div class="section-panel">
        ${disconnected.map(availableCardHtml).join("") || `<div class="empty-mini">All platforms connected 🎉</div>`}
      </div>
    </div>

    <div class="section-block">
      <div class="section-head">
        <span class="section-title">⏰ SCHEDULES</span>
        <button class="small-btn" type="button" id="addScheduleBtn">＋ Add Schedule</button>
      </div>
      <div class="section-panel">
        <div id="scheduleList"><div class="schedule-list-empty">Loading schedules...</div></div>
      </div>
    </div>

    <div class="section-block">
      <div class="section-head"><span class="section-title">🔔 NOTIFICATIONS</span></div>
      <div class="section-panel">
        <div id="notificationsPanel"></div>
      </div>
    </div>
  `;
  list.innerHTML = html;

  // bind connected cards
  connected.forEach((p) => {
    const card = document.querySelector(`[data-conn-card="${p.id}"]`);
    if (!card) return;
    card.querySelector('[data-action="env"]').addEventListener("click", () => openEnvVarsModal(p.id));
    card.querySelector('[data-action="disconnect"]').addEventListener("click", () => disconnectConnector(p.id));
  });
  disconnected.forEach((p) => {
    const card = document.querySelector(`[data-conn-avail="${p.id}"]`);
    if (!card) return;
    card.querySelector('[data-action="connect"]').addEventListener("click", () => openConnectorModal(p.id));
  });

  const addSchedBtn = document.getElementById("addScheduleBtn");
  if (addSchedBtn) addSchedBtn.addEventListener("click", openScheduleModal);

  renderNotificationsSection();
}

function connectorCardHtml(p) {
  return `
    <div class="connector-card" data-conn-card="${escapeAttribute(p.id)}">
      <div class="connector-top">
        <div class="connector-info">
          <div class="connector-icon">${p.icon}</div>
          <div>
            <div class="connector-name">${escapeHtml(p.name)}</div>
            <div class="tag-line connected">● Connected</div>
          </div>
        </div>
      </div>
      <div class="connector-actions">
        <button class="secondary-btn" type="button" data-action="env">⚙ Env Vars</button>
        <button class="disconnect-btn" type="button" data-action="disconnect">Disconnect</button>
      </div>
    </div>
  `;
}

function availableCardHtml(p) {
  return `
    <div class="connector-card" data-conn-avail="${escapeAttribute(p.id)}">
      <div class="connector-top">
        <div class="connector-info">
          <div class="connector-icon">${p.icon}</div>
          <div>
            <div class="connector-name">${escapeHtml(p.name)}</div>
            <div class="tag-line disconnected">● Not Connected</div>
          </div>
        </div>
        <button class="connect-btn" type="button" data-action="connect">Connect</button>
      </div>
    </div>
  `;
}

function openConnectorModal(platformId) {
  const platform = getPlatform(platformId);
  const modal = document.getElementById("connectorModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const box = modal.querySelector(".modal-box");
  if (box) box.classList.remove("wide");

  title.textContent = `Connect ${platform.name}`;
  if (platform.type === "oauth") {
    body.innerHTML = `
      <p class="modal-copy">Click below to authorize DeployBot with your GitHub account. We only request repo and workflow permissions.</p>
      <button class="full-btn" type="button" id="oauthBtn">🐙 Authorize with GitHub</button>
      <div class="inline-note">You will be redirected to GitHub and returned here after approval.</div>
    `;
    body.querySelector("#oauthBtn").addEventListener("click", connectGitHub);
  } else {
    body.innerHTML = `
      <p class="modal-copy">Enter your ${escapeHtml(platform.name)} API key below.</p>
      <input type="password" id="apiKeyInput" class="api-key-input" placeholder="${escapeAttribute(platform.name)} API Key" autocomplete="off">
      <a href="${escapeAttribute(platform.docsUrl || "#")}" target="_blank" rel="noopener noreferrer" class="docs-link">📎 Where to find your API key?</a>
      <div class="modal-actions">
        <button class="cancel-btn" type="button" id="cancelModalBtn">Cancel</button>
        <button class="save-btn" type="button" id="saveConnBtn">Save & Connect</button>
      </div>
    `;
    body.querySelector("#cancelModalBtn").addEventListener("click", closeModal);
    body.querySelector("#saveConnBtn").addEventListener("click", () => saveConnector(platformId));
  }
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function connectGitHub() {
  window.location.href = `${API_BASE}/auth/github`;
}

async function saveConnector(platformId) {
  const apiKey = (document.getElementById("apiKeyInput") || {}).value;
  if (!apiKey || !apiKey.trim()) { alert("Please enter API key"); return; }
  try {
    const data = await fetchJson(`${API_BASE}/api/connectors/save`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify({ platform: platformId, apiKey: apiKey.trim() })
    });
    closeModal();
    loadConnectors();
    addBotMessage(`✅ ${data.message || `${platformId} connected successfully.`}`);
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

async function disconnectConnector(platformId) {
  if (!confirm(`Disconnect ${platformId}?`)) return;
  try {
    await fetchJson(`${API_BASE}/api/connectors/${platformId}`, { method: "DELETE", headers: getHeaders(false) });
    loadConnectors();
    addBotMessage(`🔌 ${platformId} disconnected.`);
  } catch (err) {
    alert(`Failed to disconnect: ${err.message}`);
  }
}

// ============ ENV VARS MODAL ============
async function openEnvVarsModal(platformId) {
  const platform = getPlatform(platformId);
  const modal = document.getElementById("connectorModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const box = modal.querySelector(".modal-box");
  if (box) box.classList.add("wide");

  title.textContent = `⚙ ${platform.name} — Environment Variables`;
  body.innerHTML = `
    <p class="modal-copy">Manage environment variables sent during deployment for <strong>${escapeHtml(platform.name)}</strong>.</p>
    <div class="env-list" id="envList"><div class="muted-text">Loading…</div></div>
    <button class="secondary-btn add-row-btn" type="button" id="addEnvRowBtn">＋ Add variable</button>
    <div class="modal-actions">
      <button class="cancel-btn" type="button" id="cancelEnvBtn">Close</button>
      <button class="save-btn" type="button" id="saveEnvBtn">Save All</button>
    </div>
  `;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  document.getElementById("cancelEnvBtn").addEventListener("click", closeModal);
  document.getElementById("addEnvRowBtn").addEventListener("click", () => addEnvRow("", ""));
  document.getElementById("saveEnvBtn").addEventListener("click", () => saveEnvVars(platformId));

  const data = await safeFetch(`${API_BASE}/api/envvars/${platformId}`, { headers: getHeaders(false) });
  const vars = (data && (data.vars || data.envvars || data.variables || data.items)) || [];
  const list = document.getElementById("envList");
  list.innerHTML = "";
  if (Array.isArray(vars) && vars.length) {
    vars.forEach((v) => addEnvRow(v.key || v.name || "", v.value || ""));
  } else if (vars && typeof vars === "object" && !Array.isArray(vars)) {
    Object.entries(vars).forEach(([k, v]) => addEnvRow(k, v));
  } else {
    addEnvRow("", "");
  }
}

function addEnvRow(key, value) {
  const list = document.getElementById("envList");
  if (!list) return;
  if (list.querySelector(".muted-text")) list.innerHTML = "";
  const row = document.createElement("div");
  row.className = "env-row";
  row.innerHTML = `
    <input type="text" class="env-key-input" placeholder="KEY" value="${escapeAttribute(key)}">
    <span class="equals-sign">=</span>
    <input type="text" class="env-value-input" placeholder="value" value="${escapeAttribute(value)}">
    <button class="delete-btn" type="button" aria-label="Delete row">🗑</button>
  `;
  row.querySelector(".delete-btn").addEventListener("click", () => row.remove());
  list.appendChild(row);
}

async function saveEnvVars(platformId) {
  const rows = document.querySelectorAll("#envList .env-row");
  const vars = [];
  rows.forEach((r) => {
    const k = (r.querySelector(".env-key-input") || {}).value || "";
    const v = (r.querySelector(".env-value-input") || {}).value || "";
    if (k.trim()) vars.push({ key: k.trim(), value: v });
  });
  try {
    await fetchJson(`${API_BASE}/api/envvars/save`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify({ platform: platformId, vars })
    });
    closeModal();
    addBotMessage(`✅ Saved ${vars.length} env var(s) for ${platformId}.`);
  } catch (err) {
    alert(`Failed to save: ${err.message}`);
  }
}

// ============ SCHEDULES ============
async function loadSchedules() {
  const list = document.getElementById("scheduleList");
  if (!list) return;
  const data = await safeFetch(`${API_BASE}/api/schedule/list`, { headers: getHeaders(false) });
  const schedules = (data && (data.schedules || data.items || data)) || [];
  const arr = Array.isArray(schedules) ? schedules : [];
  if (!arr.length) {
    list.innerHTML = `<div class="schedule-list-empty">No schedules yet. Create one to deploy automatically.</div>`;
    return;
  }
  list.innerHTML = arr.map((s) => {
    const platform = getPlatform(s.platform);
    return `
      <div class="schedule-item">
        <div class="schedule-top">
          <div class="schedule-info">
            <div class="schedule-icon">${platform.icon}</div>
            <div>
              <div class="schedule-name">${escapeHtml(s.project || s.repo || s.name || "Project")}</div>
              <div class="schedule-meta">${escapeHtml(platform.name)} • ${escapeHtml(s.cron || s.preset || "")}</div>
              <div class="schedule-meta">Next run: ${escapeHtml(formatRelative(s.nextRun || s.next_run || s.nextRunAt))}</div>
            </div>
          </div>
          <button class="delete-btn" type="button" data-sch-del="${escapeAttribute(s.id || s._id || "")}">🗑</button>
        </div>
      </div>
    `;
  }).join("");

  list.querySelectorAll("[data-sch-del]").forEach((btn) => {
    btn.addEventListener("click", () => deleteSchedule(btn.getAttribute("data-sch-del")));
  });
}

async function deleteSchedule(id) {
  if (!id) return;
  if (!confirm("Delete this schedule?")) return;
  try {
    await fetchJson(`${API_BASE}/api/schedule/${id}`, { method: "DELETE", headers: getHeaders(false) });
    loadSchedules();
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

async function openScheduleModal() {
  const connectors = await safeFetch(`${API_BASE}/api/connectors`, { headers: getHeaders(false) });
  const map = (connectors && (connectors.connectors || connectors)) || {};
  const connected = PLATFORMS.filter((p) => map[p.id] && map[p.id].connected);
  const platformOptions = (connected.length ? connected : PLATFORMS).map((p) =>
    `<option value="${escapeAttribute(p.id)}">${p.icon}  ${escapeHtml(p.name)}</option>`
  ).join("");

  const modal = document.getElementById("connectorModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const box = modal.querySelector(".modal-box");
  if (box) box.classList.add("wide");

  title.textContent = "⏰ New Schedule";
  body.innerHTML = `
    <div class="form-grid">
      <label class="field-label">Platform
        <select id="schedPlatform" class="select-input" style="padding:10px 12px;">${platformOptions}</select>
      </label>
      <label class="field-label">Project / Repo
        <input type="text" id="schedProject" class="text-input" style="padding:10px 12px;" placeholder="e.g. my-react-app">
      </label>

      <div class="field-label">Frequency
        <div class="preset-grid" id="presetGrid">
          <button class="preset-btn" type="button" data-cron="0 0 * * *">Every day (00:00)</button>
          <button class="preset-btn" type="button" data-cron="0 * * * *">Every hour</button>
          <button class="preset-btn" type="button" data-cron="0 9 * * 1">Every Monday 09:00</button>
          <button class="preset-btn" type="button" data-cron="custom">Custom cron</button>
        </div>
      </div>

      <div id="cronCustomArea" class="hidden field-label">Cron expression
        <input type="text" id="cronInput" class="cron-input" placeholder="*/5 * * * *">
        <div class="preview-box" id="cronPreview">Enter a cron expression…</div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="cancel-btn" type="button" id="cancelSchedBtn">Cancel</button>
      <button class="save-btn" type="button" id="saveSchedBtn">Save Schedule</button>
    </div>
  `;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  let selectedCron = "0 0 * * *";
  const presetGrid = document.getElementById("presetGrid");
  presetGrid.querySelectorAll(".preset-btn").forEach((btn, idx) => {
    if (idx === 0) btn.classList.add("active");
    btn.addEventListener("click", () => {
      presetGrid.querySelectorAll(".preset-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const cron = btn.getAttribute("data-cron");
      const customArea = document.getElementById("cronCustomArea");
      if (cron === "custom") {
        customArea.classList.remove("hidden");
        selectedCron = (document.getElementById("cronInput").value || "").trim();
        updateCronPreview();
      } else {
        customArea.classList.add("hidden");
        selectedCron = cron;
      }
    });
  });

  document.getElementById("cronInput").addEventListener("input", updateCronPreview);

  function updateCronPreview() {
    const val = (document.getElementById("cronInput").value || "").trim();
    selectedCron = val;
    document.getElementById("cronPreview").textContent = val ? `Runs ${cronToHuman(val)}` : "Enter a cron expression…";
  }

  document.getElementById("cancelSchedBtn").addEventListener("click", closeModal);
  document.getElementById("saveSchedBtn").addEventListener("click", async () => {
    const platform = (document.getElementById("schedPlatform") || {}).value;
    const project = ((document.getElementById("schedProject") || {}).value || "").trim();
    if (!platform || !project) { alert("Platform and project are required."); return; }
    if (!selectedCron) { alert("Please pick or enter a cron expression."); return; }
    try {
      await fetchJson(`${API_BASE}/api/schedule/create`, {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify({ platform, project, cron: selectedCron })
      });
      closeModal();
      loadSchedules();
      addBotMessage(`⏰ Schedule created for ${project} on ${platform}.`);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    }
  });
}

function cronToHuman(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5) return `on schedule "${expr}"`;
  const [m, h, dom, mon, dow] = parts;
  if (m === "0" && h === "0" && dom === "*" && mon === "*" && dow === "*") return "every day at 12:00 AM";
  if (m === "0" && h !== "*" && dom === "*" && mon === "*" && dow === "*") return `every day at ${formatHour(h)}`;
  if (m === "0" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "every hour";
  if (m !== "*" && h === "*" && dom === "*" && mon === "*" && dow === "*") return `every hour at :${pad2(m)}`;
  if (dow !== "*" && dom === "*" && mon === "*") {
    return `every ${dowName(dow)} at ${formatHour(h)}:${pad2(m === "*" ? "0" : m)}`;
  }
  if (/^\*\/\d+$/.test(m)) {
    return `every ${m.split("/")[1]} minutes`;
  }
  return `on schedule "${expr}"`;
}

function pad2(n) { return String(n).padStart(2, "0"); }
function formatHour(h) {
  const n = Number(h);
  if (isNaN(n)) return `${h}:00`;
  const period = n >= 12 ? "PM" : "AM";
  const hh = n % 12 === 0 ? 12 : n % 12;
  return `${hh}:00 ${period}`;
}
function dowName(d) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const n = Number(d);
  return isNaN(n) ? d : names[n] || d;
}

// ============ NOTIFICATIONS ============
function renderNotificationsSection() {
  const panel = document.getElementById("notificationsPanel");
  if (!panel) return;
  panel.innerHTML = `
    <div class="connector-card">
      <div class="notify-form">
        <div id="notifyBadgeArea"></div>
        <label class="notify-label">Telegram Bot Token
          <input type="password" id="tgToken" class="notify-input" style="padding:10px 12px;" placeholder="123456:ABC...">
        </label>
        <label class="notify-label">Chat ID
          <input type="text" id="tgChat" class="notify-input" style="padding:10px 12px;" placeholder="e.g. 987654321">
        </label>
        <div class="helper-text">Get your Chat ID from <strong>@userinfobot</strong> on Telegram.</div>
        <div class="connector-actions">
          <button class="save-btn" type="button" id="saveNotifyBtn">Save</button>
          <button class="secondary-btn" type="button" id="testNotifyBtn">Send test</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById("saveNotifyBtn").addEventListener("click", saveNotifications);
  document.getElementById("testNotifyBtn").addEventListener("click", testNotification);
}

async function loadNotificationsStatus() {
  const data = await safeFetch(`${API_BASE}/api/notifications/status`, { headers: getHeaders(false) });
  const enabled = data && (data.enabled || data.active);
  const badgeArea = document.getElementById("notifyBadgeArea");
  if (badgeArea) {
    badgeArea.innerHTML = enabled ? `<span class="notification-badge">✅ Notifications Active</span>` : "";
  }
  if (data) {
    const t = document.getElementById("tgToken");
    const c = document.getElementById("tgChat");
    if (t && data.token) t.value = data.token;
    if (c && data.chatId) c.value = data.chatId;
  }
}

async function saveNotifications() {
  const token = ((document.getElementById("tgToken") || {}).value || "").trim();
  const chatId = ((document.getElementById("tgChat") || {}).value || "").trim();
  if (!token || !chatId) { alert("Bot token and chat ID required."); return; }
  try {
    await fetchJson(`${API_BASE}/api/notifications/setup`, {
      method: "POST", headers: getHeaders(), body: JSON.stringify({ token, chatId })
    });
    const badgeArea = document.getElementById("notifyBadgeArea");
    if (badgeArea) badgeArea.innerHTML = `<span class="notification-badge">✅ Notifications Active</span>`;
    addBotMessage("🔔 Telegram notifications saved.");
  } catch (err) {
    alert(`Failed: ${err.message}`);
  }
}

async function testNotification() {
  try {
    await fetchJson(`${API_BASE}/api/notifications/test`, { method: "POST", headers: getHeaders(), body: JSON.stringify({}) });
    addBotMessage("✅ Test notification sent.");
  } catch (err) {
    alert(`Test failed: ${err.message}`);
  }
}

// ============ HISTORY PANEL ============
async function openHistoryPanel() {
  const panel = document.getElementById("historyPanel");
  const overlay = document.getElementById("sidebarOverlay");
  panel.classList.remove("hidden");
  overlay.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => panel.classList.add("open"));
  document.getElementById("historyContent").innerHTML = `<div class="empty-mini">Loading history…</div>`;

  const [history, analytics] = await Promise.all([
    safeFetch(`${API_BASE}/api/deploy/history`, { headers: getHeaders(false) }),
    safeFetch(`${API_BASE}/api/analytics`, { headers: getHeaders(false) })
  ]);
  renderHistoryPanel(history, analytics);
}

function closeHistoryPanel() {
  const panel = document.getElementById("historyPanel");
  const overlay = document.getElementById("sidebarOverlay");
  panel.classList.remove("open");
  panel.setAttribute("aria-hidden", "true");
  overlay.classList.add("hidden");
  setTimeout(() => { if (!panel.classList.contains("open")) panel.classList.add("hidden"); }, 300);
}

function renderHistoryPanel(history, analytics) {
  const content = document.getElementById("historyContent");
  const list = (history && (history.history || history.items || history.deployments || history)) || [];
  const arr = Array.isArray(list) ? list : [];

  content.innerHTML = `
    <div class="section-block">
      <div class="section-head"><span class="section-title">📊 STATS</span></div>
      ${renderStats(analytics)}
      ${renderChart(analytics)}
    </div>
    <div class="section-block">
      <div class="section-head"><span class="section-title">RECENT DEPLOYMENTS</span></div>
      <div class="section-panel" id="historyList">
        ${arr.length ? arr.map(historyItemHtml).join("") : `<div class="history-empty">No deployments yet. Deploy something! 🚀</div>`}
      </div>
    </div>
  `;

  document.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click", () => {
      el.classList.toggle("expanded");
      const exp = el.querySelector(".history-expand");
      if (exp) exp.classList.toggle("hidden");
    });
  });
}

function renderStats(analytics) {
  const a = analytics || {};
  const total = a.totalDeploys || a.total || 0;
  const rate = Number(a.successRate || a.success_rate || 0);
  const rateClass = rate > 80 ? "success" : rate > 50 ? "warning" : "error";
  const avgSec = Math.round(Number(a.avgDeployTime || a.avg_time || 0));
  const mostId = a.mostUsedPlatform || a.most_used_platform || "";
  const mostPlatform = mostId ? getPlatform(mostId) : null;
  return `
    <div class="stats-grid">
      <div class="stats-card"><div class="stats-label">TOTAL DEPLOYS</div><div class="stats-value">${escapeHtml(total)}</div></div>
      <div class="stats-card"><div class="stats-label">SUCCESS RATE</div><div class="stats-value ${rateClass}">${rate ? rate.toFixed(0) + "%" : "—"}</div></div>
      <div class="stats-card"><div class="stats-label">AVG DEPLOY TIME</div><div class="stats-value">${avgSec ? avgSec + "s" : "—"}</div></div>
      <div class="stats-card"><div class="stats-label">MOST USED</div><div class="stats-value">${mostPlatform ? `${mostPlatform.icon} ${escapeHtml(mostPlatform.name)}` : "—"}</div></div>
    </div>
  `;
}

function renderChart(analytics) {
  const days = (analytics && (analytics.daily || analytics.last7Days || analytics.history)) || [];
  let entries = Array.isArray(days) ? days.slice(-7) : [];
  // Normalize to 7 days
  if (entries.length < 7) {
    const today = new Date();
    const map = {};
    entries.forEach((d) => {
      const key = String(d.date || d.day || "").slice(0, 10);
      map[key] = Number(d.count || d.deploys || 0);
    });
    entries = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(today.getTime() - i * 86400000);
      const key = dt.toISOString().slice(0, 10);
      entries.push({ date: key, count: map[key] || 0 });
    }
  }
  const max = Math.max(1, ...entries.map((e) => Number(e.count || 0)));
  return `
    <div class="chart-card">
      <div class="chart-title">Last 7 Days</div>
      <div class="chart-grid">
        ${entries.map((e) => {
          const count = Number(e.count || 0);
          const pct = Math.max(8, (count / max) * 100);
          const label = formatChartLabel(e.date || e.day || "");
          return `
            <div class="chart-day">
              <div class="chart-count">${count}</div>
              <div class="chart-bar-wrap"><div class="chart-bar" style="height:${pct}%"></div></div>
              <div class="chart-label">${escapeHtml(label)}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function formatChartLabel(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(5);
  return dt.toLocaleDateString([], { month: "short", day: "numeric" });
}

function historyItemHtml(item) {
  const platform = getPlatform(item.platform);
  const status = (item.status || "running").toLowerCase();
  const statusIcon = status === "success" ? "✅" : status === "failed" ? "❌" : "🔄";
  const liveUrl = item.liveUrl || item.url;
  const steps = Array.isArray(item.steps) ? item.steps : [];
  return `
    <div class="history-item">
      <div class="history-top">
        <div class="history-info">
          <div class="history-icon">${platform.icon}</div>
          <div>
            <div class="history-name">${escapeHtml(item.project || item.repo || item.name || "Project")}</div>
            <div class="history-meta">${escapeHtml(platform.name)} • ${escapeHtml(formatRelative(item.createdAt || item.startedAt || item.time))}</div>
            ${liveUrl ? `<div class="history-meta">🌐 <a href="${escapeAttribute(liveUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(liveUrl)}</a></div>` : ""}
          </div>
        </div>
        <span class="history-status ${escapeHtml(status)}">${statusIcon} ${escapeHtml(status)}</span>
      </div>
      <div class="history-expand hidden">
        ${steps.length ? steps.map((s) => `<div class="history-step ${escapeHtml(s.status || "pending")}">${stepIcon(s.status)} ${escapeHtml(s.label || s.name || "Step")}</div>`).join("") : `<div class="muted-text">No step details available.</div>`}
      </div>
    </div>
  `;
}

function stepIcon(status) {
  if (status === "done" || status === "success") return "✅";
  if (status === "running") return "🔄";
  if (status === "failed" || status === "error") return "❌";
  return "⏳";
}

function formatRelative(value) {
  if (!value) return "—";
  const dt = new Date(value);
  if (isNaN(dt.getTime())) return String(value);
  const diff = Math.max(0, Date.now() - dt.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return dt.toLocaleDateString();
}

// ============ FILE ATTACH ============
function bindFileInput() {
  document.getElementById("attachBtn").addEventListener("click", () => {
    document.getElementById("fileInput").click();
  });
  document.getElementById("fileInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      alert("File too large! Max 100MB.");
      e.target.value = "";
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
    <button class="file-chip-clear" type="button" aria-label="Remove attached file">❌</button>
  `;
  chip.querySelector(".file-chip-clear").addEventListener("click", clearAttachedFile);
}

function clearAttachedFile() {
  attachedFile = null;
  document.getElementById("fileInput").value = "";
  const chip = document.getElementById("fileChip");
  chip.classList.add("hidden");
  chip.innerHTML = "";
  checkSendEnabled();
}

// ============ SIDEBAR / MODAL ============
function openSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  sidebar.classList.remove("hidden");
  overlay.classList.remove("hidden");
  sidebar.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => sidebar.classList.add("open"));
  loadConnectors();
}

function closeSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  sidebar.classList.remove("open");
  sidebar.setAttribute("aria-hidden", "true");
  // hide overlay only if history panel also closed
  if (!document.getElementById("historyPanel").classList.contains("open")) {
    overlay.classList.add("hidden");
  }
  setTimeout(() => { if (!sidebar.classList.contains("open")) sidebar.classList.add("hidden"); }, 300);
}

function closeModal() {
  const modal = document.getElementById("connectorModal");
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  const box = modal.querySelector(".modal-box");
  if (box) box.classList.remove("wide");
}

// ============ UTILITIES ============
function scrollToBottom() {
  const chatWindow = document.getElementById("chatWindow");
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
function getTime() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function formatTime(value) {
  if (!value) return getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : String(text);
  return div.innerHTML;
}
function escapeAttribute(value) { return String(value == null ? "" : value).replace(/"/g, "&quot;"); }
function renderRichText(text) {
  const safe = escapeHtml(text == null ? "" : String(text));
  return safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>').replace(/\n/g, "<br>");
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
function disableSend() { document.getElementById("sendBtn").disabled = true; }
function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

// ============ EVENTS / INIT ============
function bindEvents() {
  document.getElementById("sendBtn").addEventListener("click", sendMessage);
  document.getElementById("messageInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("messageInput").addEventListener("input", (e) => {
    checkSendEnabled();
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  });

  document.getElementById("menuBtn").addEventListener("click", openSidebar);
  document.getElementById("closeSidebar").addEventListener("click", closeSidebar);
  document.getElementById("closeHistory").addEventListener("click", closeHistoryPanel);
  document.getElementById("historyBtn").addEventListener("click", openHistoryPanel);
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);

  document.getElementById("sidebarOverlay").addEventListener("click", () => {
    closeSidebar();
    closeHistoryPanel();
  });
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("connectorModal").addEventListener("click", (e) => {
    if (e.target.id === "connectorModal") closeModal();
  });

  window.addEventListener("beforeunload", () => {
    Object.keys(pollers).forEach(stopPolling);
    Object.keys(sseConnections).forEach((id) => closeLogStream(id, "closed"));
  });

  bindFileInput();
}

document.addEventListener("DOMContentLoaded", async () => {
  loadTheme();
  handleOAuthCallback();
  bindEvents();
  await Promise.allSettled([loadChatHistory(), loadConnectors()]);
  checkSendEnabled();
});
