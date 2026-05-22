const themeToggleBtn = document.querySelector("#themeToggle");
const currentTheme = localStorage.getItem("theme");

const isLightTheme = currentTheme === "light" || (!currentTheme && window.matchMedia("(prefers-color-scheme: light)").matches);
if (isLightTheme) {
  document.body.classList.add("light-theme");
}

if (themeToggleBtn) {
  themeToggleBtn.setAttribute("aria-checked", isLightTheme ? "true" : "false");
  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.toggle("light-theme");
    themeToggleBtn.setAttribute("aria-checked", isLight ? "true" : "false");
    localStorage.setItem("theme", isLight ? "light" : "dark");
  });
}

const openCreateRoomButton = document.querySelector("#openCreateRoom");
const openJoinRoomButton = document.querySelector("#openJoinRoom");
const closeRoomModalButton = document.querySelector("#closeRoomModal");
const resetButton = document.querySelector("#resetConnection");
const clearTransferButton = document.querySelector("#clearTransfer");
const applySignalButton = document.querySelector("#applySignal");
const copySignalButton = document.querySelector("#copySignal");
const saveQrButton = document.querySelector("#saveQr");
const sendFileButton = document.querySelector("#sendFile");
const fileInput = document.querySelector("#fileInput");
const qrUpload = document.querySelector("#qrUpload");
const scanQrButton = document.querySelector("#scanQr");
const stopScanQrButton = document.querySelector("#stopScanQr");
const qrVideo = document.querySelector("#qrVideo");
const videoContainer = document.querySelector("#videoContainer");
const remoteSignal = document.querySelector("#remoteSignal");
const localSignal = document.querySelector("#localSignal");
const copyStatus = document.querySelector("#copyStatus");
const connectionDot = document.querySelector("#connectionDot");
const connectionStatus = document.querySelector("#connectionStatus");
const channelStatus = document.querySelector("#channelStatus");
const sendProgress = document.querySelector("#sendProgress");
const sendProgressBlock = document.querySelector("#sendProgressBlock");
const sendLabel = document.querySelector("#sendLabel");
const sendPercent = document.querySelector("#sendPercent");
const sendSpeed = document.querySelector("#sendSpeed");
const sendEta = document.querySelector("#sendEta");
const receiveProgress = document.querySelector("#receiveProgress");
const receiveProgressBlock = document.querySelector("#receiveProgressBlock");
const receiveLabel = document.querySelector("#receiveLabel");
const receivePercent = document.querySelector("#receivePercent");
const receiveSpeed = document.querySelector("#receiveSpeed");
const receiveEta = document.querySelector("#receiveEta");
const receiveName = document.querySelector("#receiveName");
const receiveMeta = document.querySelector("#receiveMeta");
const fileChoiceLabel = document.querySelector("#fileChoiceLabel");
const roomQr = document.querySelector("#roomQr");
const fileQueueList = document.querySelector("#fileQueueList");
const queueCount = document.querySelector("#queueCount");
const receivedList = document.querySelector("#receivedList");
const downloadAllButton = document.querySelector("#downloadAll");
const roomModal = document.querySelector("#roomModal");
const createRoomPanel = document.querySelector("#createRoomPanel");
const joinRoomPanel = document.querySelector("#joinRoomPanel");
const modalTitle = document.querySelector("#modalTitle");
const modalSubtitle = document.querySelector("#modalSubtitle");
const modalEyebrow = document.querySelector("#modalEyebrow");
const fileDropZone = document.querySelector(".file-drop");
const fileCard = document.querySelector(".file-card");

const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const chunkSize = 16 * 1024;
const roomAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
let peerConnection;
let dataChannel;
let receiveBuffer = [];
let receiveSize = 0;
let incomingFile = null;
let receiveStartTime = null;
let receiveLastUpdateTime = 0;
let pollTimer = null;
let roomId = null;
let receivedFiles = [];
let scanStream = null;
let scanTimer = null;
let sendQueue = [];
let isConnectionReady = false;
let sendTimeout = null;
let receiveTimeout = null;

function setStatus(status, detail, ready = false) {
  connectionStatus.textContent = status;
  channelStatus.textContent = detail;
  connectionDot.classList.toggle("ready", ready);
  isConnectionReady = ready;
  updateSendButtonState();
}

function updateSendButtonState() {
  sendFileButton.disabled = !isConnectionReady || sendQueue.length === 0;
}

function drawFinder(ctx, x, y, size) {
  ctx.fillStyle = "#151a20";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
  ctx.fillStyle = "#151a20";
  ctx.fillRect(x + 14, y + 14, size - 28, size - 28);
}

function openRoomModal(mode) {
  const isCreate = mode === "create";
  roomModal.classList.remove("hidden");
  roomModal.setAttribute("aria-hidden", "false");
  createRoomPanel.classList.toggle("hidden", !isCreate);
  joinRoomPanel.classList.toggle("hidden", isCreate);
  modalEyebrow.textContent = isCreate ? "Share room" : "Join room";
  modalTitle.textContent = isCreate ? "Room ready" : "Join with code";
  modalSubtitle.textContent = isCreate
    ? "Copy the code or save the QR visual for the other PC."
    : "Upload a saved QR visual or enter the room code manually.";

  if (!isCreate) {
    remoteSignal.focus();
  }
}

function closeRoomModal() {
  stopQrScan();
  roomModal.classList.add("hidden");
  roomModal.setAttribute("aria-hidden", "true");
}

function renderRoomVisual(code = "") {
  if (!roomQr) {
    return;
  }

  const ctx = roomQr.getContext("2d");
  const size = roomQr.width;
  const cell = 8;
  const cells = size / cell;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  drawFinder(ctx, 12, 12, 44);
  drawFinder(ctx, size - 56, 12, 44);
  drawFinder(ctx, 12, size - 56, 44);

  let seed = 0;
  const value = code || "DIRECT";

  for (const char of value) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const inFinder =
        (x < 8 && y < 8) ||
        (x > cells - 9 && y < 8) ||
        (x < 8 && y > cells - 9);

      if (inFinder || x < 1 || y < 1 || x > cells - 2 || y > cells - 2) {
        continue;
      }

      seed = (seed * 1664525 + 1013904223) >>> 0;

      if ((seed + x * 13 + y * 7) % 5 < 2) {
        ctx.fillStyle = code ? "#151a20" : "#e4e7eb";
        ctx.fillRect(x * cell, y * cell, cell - 2, cell - 2);
      }
    }
  }

  if (code && code.length === 6) {
    encodeRoomCode(ctx, code, cell);
  }
}

function encodeRoomCode(ctx, code, cell) {
  const startX = 8;
  const startY = 8;
  const bits = [];

  for (const char of code) {
    const value = roomAlphabet.indexOf(char);

    for (let bit = 5; bit >= 0; bit -= 1) {
      bits.push((value >> bit) & 1);
    }
  }

  bits.forEach((bit, index) => {
    const x = startX + (index % 6);
    const y = startY + Math.floor(index / 6);
    ctx.fillStyle = bit ? "#ff6a2a" : "#ffffff";
    ctx.fillRect(x * cell, y * cell, cell - 2, cell - 2);
  });
}

function resetProgress() {
  if (sendTimeout) {
    window.clearTimeout(sendTimeout);
    sendTimeout = null;
  }
  if (receiveTimeout) {
    window.clearTimeout(receiveTimeout);
    receiveTimeout = null;
  }
  if (sendProgressBlock) {
    sendProgressBlock.classList.remove("active");
  }
  if (receiveProgressBlock) {
    receiveProgressBlock.classList.remove("active");
  }

  sendProgress.value = 0;
  receiveProgress.value = 0;
  sendPercent.textContent = "0%";
  receivePercent.textContent = "0%";
  sendLabel.textContent = "";
  receiveLabel.textContent = "";
  sendSpeed.textContent = "";
  sendEta.textContent = "";
  receiveSpeed.textContent = "";
  receiveEta.textContent = "";
}

function destroyConnection() {
  stopPolling();

  receivedFiles.forEach((file) => URL.revokeObjectURL(file.url));

  if (dataChannel) {
    dataChannel.close();
  }

  if (peerConnection) {
    peerConnection.close();
  }

  peerConnection = null;
  dataChannel = null;
  receiveBuffer = [];
  receiveSize = 0;
  incomingFile = null;
  receivedFiles = [];
  sendQueue = [];
  roomId = null;
  receiveBox.classList.remove("has-received", "is-receiving");
  localSignal.value = "";
  remoteSignal.value = "";
  renderRoomVisual();
  copyStatus.textContent = "";
  renderReceivedList();
  renderFileQueue();
  receiveName.textContent = "Waiting for file";
  receiveMeta.textContent = "Keep this page open.";
  resetProgress();
  setStatus("Not connected", "Create or join a room to establish peer connection");
}

function createPeerConnection() {
  destroyConnection();
  peerConnection = new RTCPeerConnection(rtcConfig);

  peerConnection.onicecandidate = () => {
    if (!roomId && peerConnection.localDescription) {
      localSignal.value = "Preparing...";
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState;

    if (state === "connected") {
      setStatus("Connected", "Opening file transfer channel...", false);
    } else if (state === "failed" || state === "disconnected") {
      setStatus("Connection issue", `Peer state: ${state}.`);
    } else {
      setStatus("Connecting", `Peer state: ${state}.`);
    }
  };

  peerConnection.ondatachannel = (event) => {
    wireDataChannel(event.channel);
  };

  return peerConnection;
}

function wireDataChannel(channel) {
  dataChannel = channel;
  dataChannel.binaryType = "arraybuffer";

  dataChannel.onopen = () => {
    setStatus("Ready", "Data channel is open. Pick a file to send.", true);
  };

  dataChannel.onclose = () => {
    setStatus("Closed", "Data channel closed.");
  };

  dataChannel.onerror = () => {
    setStatus("Channel error", "The data channel reported an error.");
  };

  dataChannel.onmessage = handleIncomingMessage;
}

async function waitForIceGatheringComplete(pc) {
  if (pc.iceGatheringState === "complete") {
    return;
  }

  await new Promise((resolve) => {
    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }
    };

    pc.addEventListener("icegatheringstatechange", checkState);
  });
}

async function createOffer() {
  const pc = createPeerConnection();
  wireDataChannel(pc.createDataChannel("file"));
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGatheringComplete(pc);
  const room = await api("/api/rooms", {
    body: JSON.stringify({ offer: pc.localDescription }),
    method: "POST",
  });

  roomId = room.roomId;
  localSignal.value = roomId;
  renderRoomVisual(roomId);
  setStatus("Room created", "Share this room code with the other PC.");
  startAnswerPolling();
  openRoomModal("create");
}

async function joinRoom() {
  const requestedRoomId = remoteSignal.value.trim().toUpperCase();

  if (!/^[A-Z0-9]{6}$/.test(requestedRoomId)) {
    alert("Enter a valid 6-character room code.");
    return;
  }

  const room = await api(`/api/rooms/${requestedRoomId}`);

  if (!room.offer) {
    alert("Room is not ready yet.");
    return;
  }

  roomId = requestedRoomId;
  const pc = createPeerConnection();
  roomId = requestedRoomId;
  await pc.setRemoteDescription(room.offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGatheringComplete(pc);
  await api(`/api/rooms/${roomId}`, {
    body: JSON.stringify({ answer: pc.localDescription }),
    method: "POST",
  });
  localSignal.value = roomId;
  renderRoomVisual(roomId);
  setStatus("Joined room", "Waiting for the file transfer channel to open.");
  closeRoomModal();
}

async function startAnswerPolling() {
  stopPolling();

  pollTimer = window.setInterval(async () => {
    if (!peerConnection || !roomId || peerConnection.remoteDescription) {
      stopPolling();
      return;
    }

    try {
      const room = await api(`/api/rooms/${roomId}`);

      if (room.answer) {
        await peerConnection.setRemoteDescription(room.answer);
        stopPolling();
        setStatus("Peer joined", "Waiting for the file transfer channel to open.");
      }
    } catch {
      setStatus("Room waiting", "Still waiting for the other PC to join.");
    }
  }, 1200);
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function startQrScan() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert("Camera scan is not available here. Upload the QR image or paste the code.");
    return;
  }

  scanStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
    audio: false,
  });
  qrVideo.srcObject = scanStream;
  videoContainer.classList.remove("hidden");
  stopScanQrButton.classList.remove("hidden");
  scanQrButton.textContent = "Scanning...";
  scanQrButton.disabled = true;
  await qrVideo.play();

  const canvas = document.createElement("canvas");
  canvas.width = 164;
  canvas.height = 164;
  const ctx = canvas.getContext("2d");

  scanTimer = window.setInterval(() => {
    if (!qrVideo.videoWidth || !qrVideo.videoHeight) {
      return;
    }

    ctx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
    const code = decodeRoomCode(ctx, 8);

    if (code) {
      remoteSignal.value = code;
      stopQrScan();
    }
  }, 350);
}

function stopQrScan() {
  if (scanTimer) {
    window.clearInterval(scanTimer);
    scanTimer = null;
  }

  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
  }

  if (qrVideo) {
    qrVideo.pause();
    qrVideo.srcObject = null;
    videoContainer.classList.add("hidden");
  }

  if (scanQrButton) {
    scanQrButton.textContent = "Open camera";
    scanQrButton.disabled = false;
  }

  if (stopScanQrButton) {
    stopScanQrButton.classList.add("hidden");
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON from ${path}, but received a non-JSON response.`);
    }
  }

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

async function copySignal() {
  if (!localSignal.value) {
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(localSignal.value);
    } else {
      localSignal.focus();
      localSignal.select();
      const copied = document.execCommand("copy");

      if (!copied) {
        throw new Error("Copy command was blocked.");
      }
    }

    copyStatus.textContent = "Copied";
  } catch {
    localSignal.focus();
    localSignal.select();
    copyStatus.textContent = "Copy blocked. Press Ctrl+C.";
  }

  window.setTimeout(() => {
    copyStatus.textContent = "";
  }, 2600);
}

async function sendFile() {
  if (!sendQueue.length || !dataChannel || dataChannel.readyState !== "open") {
    return;
  }

  sendFileButton.disabled = true;

  // Disable remove buttons during transfer
  const removeButtons = document.querySelectorAll(".remove-queue-item");
  removeButtons.forEach((btn) => (btn.disabled = true));

  while (sendQueue.length > 0) {
    const file = sendQueue[0];
    await sendOneFile(file);
    sendQueue.shift();
    renderFileQueue();
    // Re-disable remove buttons for any remaining items
    const btns = document.querySelectorAll(".remove-queue-item");
    btns.forEach((btn) => (btn.disabled = true));
  }

  updateSendButtonState();

  if (sendTimeout) {
    window.clearTimeout(sendTimeout);
  }
  sendTimeout = window.setTimeout(() => {
    if (sendProgressBlock) {
      sendProgressBlock.classList.remove("active");
    }
  }, 4000);
}

async function sendOneFile(file) {
  if (sendTimeout) {
    window.clearTimeout(sendTimeout);
    sendTimeout = null;
  }
  if (sendProgressBlock) {
    sendProgressBlock.classList.add("active");
  }

  dataChannel.send(
    JSON.stringify({
      kind: "meta",
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
    }),
  );

  let offset = 0;
  sendLabel.textContent = file.name;
  const startTime = performance.now();

  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunkSize);
    const buffer = await slice.arrayBuffer();
    await waitForBufferedAmount();
    dataChannel.send(buffer);
    offset += buffer.byteLength;
    updateSendProgress(offset, file.size, startTime);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  dataChannel.send(JSON.stringify({ kind: "done" }));
}

function waitForBufferedAmount() {
  if (dataChannel.bufferedAmount < chunkSize * 64) {
    return;
  }

  return new Promise((resolve) => {
    dataChannel.bufferedAmountLowThreshold = chunkSize * 32;
    dataChannel.onbufferedamountlow = () => {
      dataChannel.onbufferedamountlow = null;
      resolve();
    };
  });
}

function updateSendProgress(sent, total, startTime) {
  const percent = total ? Math.round((sent / total) * 100) : 100;
  sendProgress.value = percent;
  sendPercent.textContent = `${percent}%`;

  const now = performance.now();
  const elapsedMs = now - startTime;
  if (elapsedMs > 500 && sent > 0) {
    const bytesPerSec = (sent / elapsedMs) * 1000;
    sendSpeed.textContent = `${formatBytes(bytesPerSec)}/s`;

    const remainingBytes = total - sent;
    const etaSeconds = remainingBytes / bytesPerSec;
    sendEta.textContent = `ETA: ${formatTime(etaSeconds)}`;
  } else {
    sendSpeed.textContent = "-- B/s";
    sendEta.textContent = "ETA: --";
  }
}

function formatTime(seconds) {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) {
    return "0s";
  }
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function handleIncomingMessage(event) {
  if (typeof event.data === "string") {
    const message = JSON.parse(event.data);

    if (message.kind === "meta") {
      incomingFile = message;
      receiveBuffer = [];
      receiveSize = 0;
      receiveStartTime = performance.now();
      receiveBox.classList.add("is-receiving");
      receiveName.textContent = message.name;
      receiveMeta.textContent = `${formatBytes(message.size)} incoming`;
      receiveLabel.textContent = message.name;
      receiveProgress.value = 0;
      receivePercent.textContent = "0%";
      receiveSpeed.textContent = "-- B/s";
      receiveEta.textContent = "ETA: --";

      if (receiveTimeout) {
        window.clearTimeout(receiveTimeout);
        receiveTimeout = null;
      }
      if (receiveProgressBlock) {
        receiveProgressBlock.classList.add("active");
      }
      return;
    }

    if (message.kind === "done") {
      finishReceivingFile();
    }

    return;
  }

  receiveBuffer.push(event.data);
  receiveSize += event.data.byteLength;

  if (incomingFile) {
    const percent = Math.round((receiveSize / incomingFile.size) * 100);
    receiveProgress.value = percent;
    receivePercent.textContent = `${percent}%`;

    const now = performance.now();
    const elapsedMs = now - receiveStartTime;
    if (elapsedMs > 500 && receiveSize > 0) {
      const bytesPerSec = (receiveSize / elapsedMs) * 1000;
      receiveSpeed.textContent = `${formatBytes(bytesPerSec)}/s`;

      const remainingBytes = incomingFile.size - receiveSize;
      const etaSeconds = remainingBytes / bytesPerSec;
      receiveEta.textContent = `ETA: ${formatTime(etaSeconds)}`;
    } else {
      receiveSpeed.textContent = "-- B/s";
      receiveEta.textContent = "ETA: --";
    }

    receiveMeta.textContent = `${formatBytes(receiveSize)} of ${formatBytes(
      incomingFile.size,
    )}`;
  }
}

function finishReceivingFile() {
  if (!incomingFile) {
    return;
  }

  const blob = new Blob(receiveBuffer, { type: incomingFile.type });
  const url = URL.createObjectURL(blob);
  receivedFiles.push({ ...incomingFile, blob, url });
  receiveBox.classList.remove("is-receiving");
  renderReceivedList();
  receiveMeta.textContent = `${formatBytes(incomingFile.size)} ready`;
  receiveProgress.value = 100;
  receivePercent.textContent = "100%";
  receiveSpeed.textContent = "Finished";
  receiveEta.textContent = "";

  if (receiveTimeout) {
    window.clearTimeout(receiveTimeout);
  }
  receiveTimeout = window.setTimeout(() => {
    if (receiveProgressBlock) {
      receiveProgressBlock.classList.remove("active");
    }
  }, 4000);
}

function renderReceivedList() {
  receiveBox.classList.toggle("has-received", receivedFiles.length > 0);
  downloadAllButton.disabled = receivedFiles.length === 0;

  if (!receivedFiles.length) {
    receivedList.innerHTML = `
      <li class="empty">
        <span class="inbox-mark" aria-hidden="true"></span>
        <strong>Waiting for incoming files</strong>
        <small>Received files will appear here with download buttons.</small>
      </li>
    `;
    return;
  }

  receivedList.innerHTML = "";

  receivedFiles.forEach((file, index) => {
    const item = document.createElement("li");
    const info = document.createElement("span");
    const name = document.createElement("span");
    const size = document.createElement("span");
    const action = document.createElement("a");

    info.className = "file-info";
    name.className = "file-name";
    size.className = "file-size";
    action.className = "download-one";
    name.textContent = file.name;
    size.textContent = formatBytes(file.size);
    action.href = file.url;
    action.download = file.name;
    action.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `;
    action.setAttribute("aria-label", `Download ${file.name}`);
    info.append(name, size);
    item.dataset.index = String(index);
    item.append(info, action);
    receivedList.append(item);
  });
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

openCreateRoomButton.addEventListener("click", () => {
  createOffer().catch((error) => alert(error.message));
});
openJoinRoomButton.addEventListener("click", () => {
  openRoomModal("join");
});
closeRoomModalButton.addEventListener("click", closeRoomModal);
roomModal.addEventListener("click", (event) => {
  if (event.target === roomModal) {
    closeRoomModal();
  }
});
applySignalButton.addEventListener("click", () => {
  joinRoom().catch((error) => alert(error.message));
});
copySignalButton.addEventListener("click", () => {
  copySignal().catch((error) => alert(error.message));
});
saveQrButton.addEventListener("click", saveRoomQr);
scanQrButton.addEventListener("click", () => {
  startQrScan().catch(() => {
    stopQrScan();
    alert("Camera could not be opened. Upload the QR image or paste the code.");
  });
});
stopScanQrButton.addEventListener("click", stopQrScan);
sendFileButton.addEventListener("click", () => {
  sendFile().catch((error) => alert(error.message));
});
downloadAllButton.addEventListener("click", () => {
  downloadAllAsZip().catch((error) => alert(error.message));
});
resetButton.addEventListener("click", destroyConnection);
if (clearTransferButton) {
  clearTransferButton.addEventListener("click", () => {
    receivedFiles.forEach((file) => URL.revokeObjectURL(file.url));
    receivedFiles = [];
    sendQueue = [];
    receiveBuffer = [];
    receiveSize = 0;
    incomingFile = null;
    if (fileInput) fileInput.value = "";
    renderReceivedList();
    renderFileQueue();
    resetProgress();
    receiveName.textContent = "Waiting for incoming file";
    receiveMeta.textContent = "Keep this page open.";
    updateSendButtonState();
  });
}
fileInput.addEventListener("change", () => {
  const newFiles = Array.from(fileInput.files);
  sendQueue = [...sendQueue, ...newFiles];
  fileInput.value = ""; // Clear fileInput.value so same file can be selected again
  renderFileQueue();
});

// Drag & Drop event handlers
if (fileDropZone) {
  ["dragenter", "dragover"].forEach((eventName) => {
    fileDropZone.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDropZone.classList.add("drag-over");
      },
      false,
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    fileDropZone.addEventListener(
      eventName,
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileDropZone.classList.remove("drag-over");
      },
      false,
    );
  });

  fileDropZone.addEventListener(
    "drop",
    (e) => {
      const dt = e.dataTransfer;
      const files = Array.from(dt.files);
      if (files.length > 0) {
        sendQueue = [...sendQueue, ...files];
        renderFileQueue();
      }
    },
    false,
  );
}
remoteSignal.addEventListener("input", () => {
  remoteSignal.value = remoteSignal.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});
qrUpload.addEventListener("change", () => {
  readRoomCodeFromUpload().catch((error) => alert(error.message));
});
renderRoomVisual();

function saveRoomQr() {
  if (!roomId) {
    return;
  }

  const link = document.createElement("a");
  link.href = roomQr.toDataURL("image/png");
  link.download = `directdrop-room-${roomId}.png`;
  document.body.append(link);
  link.click();
  link.remove();
}

async function readRoomCodeFromUpload() {
  const file = qrUpload.files[0];

  if (!file) {
    return;
  }

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = 164;
  canvas.height = 164;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const code = decodeRoomCode(ctx, 8);

  if (!code) {
    alert("Could not read this QR visual. Paste the room code manually.");
    return;
  }

  remoteSignal.value = code;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image."));
    };

    image.src = url;
  });
}

function decodeRoomCode(ctx, cell) {
  const startX = 8;
  const startY = 8;
  let code = "";

  for (let charIndex = 0; charIndex < 6; charIndex += 1) {
    let value = 0;

    for (let bit = 0; bit < 6; bit += 1) {
      const index = charIndex * 6 + bit;
      const x = (startX + (index % 6)) * cell + Math.floor(cell / 2);
      const y = (startY + Math.floor(index / 6)) * cell + Math.floor(cell / 2);
      const [red, green, blue] = ctx.getImageData(x, y, 1, 1).data;
      const isOrange = red > 180 && green > 60 && green < 150 && blue < 90;
      value = (value << 1) | (isOrange ? 1 : 0);
    }

    if (value >= roomAlphabet.length) {
      return "";
    }

    code += roomAlphabet[value];
  }

  return /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

function renderFileQueue() {
  if (fileCard) {
    fileCard.classList.toggle("has-files", sendQueue.length > 0);
  }

  fileChoiceLabel.textContent =
    sendQueue.length === 0
      ? "Choose file"
      : `${sendQueue.length} file${sendQueue.length === 1 ? "" : "s"} selected`;

  const totalSize = sendQueue.reduce((sum, file) => sum + file.size, 0);
  queueCount.textContent = `${sendQueue.length} (${formatBytes(totalSize)})`;

  if (!sendQueue.length) {
    fileQueueList.innerHTML = '<li class="empty">No files selected</li>';
    updateSendButtonState();
    return;
  }

  fileQueueList.innerHTML = "";
  sendQueue.forEach((file, index) => {
    const item = document.createElement("li");

    const nameSpan = document.createElement("span");
    nameSpan.className = "file-name";
    nameSpan.title = file.name;
    nameSpan.textContent = file.name;

    const metaSpan = document.createElement("span");
    metaSpan.className = "file-size";
    metaSpan.textContent = formatBytes(file.size);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-queue-item";
    removeBtn.dataset.index = index;
    removeBtn.textContent = "✕";
    removeBtn.setAttribute("aria-label", `Remove ${file.name}`);
    removeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      sendQueue.splice(index, 1);
      renderFileQueue();
    };

    item.append(nameSpan, metaSpan, removeBtn);
    fileQueueList.append(item);
  });

  updateSendButtonState();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return map[char];
  });
}

async function downloadAllAsZip() {
  if (!receivedFiles.length) {
    return;
  }

  downloadAllButton.disabled = true;
  const btnSpan = downloadAllButton.querySelector("span");
  if (btnSpan) {
    btnSpan.textContent = "Zipping...";
  } else {
    downloadAllButton.textContent = "Zipping...";
  }

  try {
    const zipBlob = await createZipBlob(receivedFiles);
    const url = URL.createObjectURL(zipBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `directdrop-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    const btnSpan = downloadAllButton.querySelector("span");
    if (btnSpan) {
      btnSpan.textContent = "Download all";
    } else {
      downloadAllButton.textContent = "Download all";
    }
    downloadAllButton.disabled = receivedFiles.length === 0;
  }
}

async function createZipBlob(files) {
  const chunks = [];
  const centralDirectory = [];
  let offset = 0;
  const usedNames = new Map();

  for (const file of files) {
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const name = uniqueZipName(file.name, usedNames);
    const nameBytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    const timeDate = dosTimeDate(new Date());
    const localHeader = concatBytes(
      uint32(0x04034b50),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(timeDate.time),
      uint16(timeDate.date),
      uint32(crc),
      uint32(data.length),
      uint32(data.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    );

    chunks.push(localHeader, data);
    centralDirectory.push({
      crc,
      compressedSize: data.length,
      date: timeDate.date,
      nameBytes,
      offset,
      time: timeDate.time,
      uncompressedSize: data.length,
    });
    offset += localHeader.length + data.length;
  }

  const centralStart = offset;

  for (const entry of centralDirectory) {
    const centralHeader = concatBytes(
      uint32(0x02014b50),
      uint16(20),
      uint16(20),
      uint16(0x0800),
      uint16(0),
      uint16(entry.time),
      uint16(entry.date),
      uint32(entry.crc),
      uint32(entry.compressedSize),
      uint32(entry.uncompressedSize),
      uint16(entry.nameBytes.length),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(0),
      uint32(entry.offset),
      entry.nameBytes,
    );
    chunks.push(centralHeader);
    offset += centralHeader.length;
  }

  const centralSize = offset - centralStart;
  chunks.push(
    concatBytes(
      uint32(0x06054b50),
      uint16(0),
      uint16(0),
      uint16(centralDirectory.length),
      uint16(centralDirectory.length),
      uint32(centralSize),
      uint32(centralStart),
      uint16(0),
    ),
  );

  return new Blob(chunks, { type: "application/zip" });
}

function uniqueZipName(name, usedNames) {
  const safeName = (name || "file").replace(/[\\/:*?"<>|]+/g, "_");
  const seen = usedNames.get(safeName) || 0;
  usedNames.set(safeName, seen + 1);

  if (seen === 0) {
    return safeName;
  }

  const dot = safeName.lastIndexOf(".");

  if (dot <= 0) {
    return `${safeName}-${seen + 1}`;
  }

  return `${safeName.slice(0, dot)}-${seen + 1}${safeName.slice(dot)}`;
}

function dosTimeDate(date) {
  const year = Math.max(1980, date.getFullYear());

  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function uint16(value) {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  return bytes;
}

function concatBytes(...arrays) {
  const total = arrays.reduce((sum, array) => sum + array.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;

  arrays.forEach((array) => {
    result.set(array, offset);
    offset += array.length;
  });

  return result;
}

function crc32(data) {
  let crc = 0xffffffff;

  for (let index = 0; index < data.length; index += 1) {
    crc ^= data[index];

    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}
