const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const switchCameraButton = document.getElementById("switchCamera");
const toggleMicButton = document.getElementById("toggleMic");
const toggleVideoButton = document.getElementById("toggleVideo");
const broadcasterVideo = document.getElementById("broadcaster");
const viewerVideo = document.getElementById("viewer");
const broadcastStatus = document.getElementById("broadcastStatus");
const viewerStatus = document.getElementById("viewerStatus");
const toastTemplate = document.getElementById("toastTemplate");

const bytedanceTokenInput = document.getElementById("bytedanceToken");
const bytedanceSyncButton = document.getElementById("bytedanceSync");
const refreshLivesButton = document.getElementById("refreshLives");
const ingestUrlLabel = document.getElementById("ingestUrl");
const streamKeyLabel = document.getElementById("streamKey");
const roomIdLabel = document.getElementById("roomId");
const ingestStatusChip = document.getElementById("ingestStatus");
const liveListStatusChip = document.getElementById("liveListStatus");
const liveList = document.getElementById("liveList");

let localStream = null;
let broadcasterPeer = null;
let viewerPeer = null;
let facingMode = "environment";

const BYTEDANCE_LIVE_LIST_ENDPOINT = "https://open.douyin.com/api/live/v1/stream/list/";
const BYTEDANCE_CREATE_STREAM_ENDPOINT = "https://open.douyin.com/api/live/v1/stream/create/";

const toastContainer = document.createElement("div");
toastContainer.className = "toast-container";
document.body.appendChild(toastContainer);

function showToast(message) {
  const node = toastTemplate.content.firstElementChild.cloneNode(true);
  node.textContent = message;
  toastContainer.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

function updateControls(active) {
  startButton.disabled = active;
  stopButton.disabled = !active;
  switchCameraButton.disabled = !active;
  toggleMicButton.disabled = !active;
  toggleVideoButton.disabled = !active;
}

function setStatus(isLive) {
  broadcastStatus.textContent = isLive ? "Live" : "Offline";
  broadcastStatus.classList.toggle("status--ghost", !isLive);
  viewerStatus.textContent = isLive ? "Verbonden" : "Wacht op stream";
  viewerStatus.classList.toggle("status--ghost", !isLive);
}

function createPeerPair() {
  const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  broadcasterPeer = new RTCPeerConnection(config);
  viewerPeer = new RTCPeerConnection(config);

  broadcasterPeer.onicecandidate = ({ candidate }) => {
    if (candidate) viewerPeer.addIceCandidate(candidate).catch(console.error);
  };
  viewerPeer.onicecandidate = ({ candidate }) => {
    if (candidate) broadcasterPeer.addIceCandidate(candidate).catch(console.error);
  };

  viewerPeer.ontrack = (event) => {
    viewerVideo.srcObject = event.streams[0];
    viewerVideo.play().catch(() => {});
  };
}

async function startBroadcast() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast("Camera of microfoon niet beschikbaar op dit apparaat.");
    return;
  }

  try {
    await prepareBytedanceIngest();

    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode },
      audio: true,
    });

    broadcasterVideo.srcObject = localStream;
    await broadcasterVideo.play();

    createPeerPair();
    localStream.getTracks().forEach((track) => broadcasterPeer.addTrack(track, localStream));

    const offer = await broadcasterPeer.createOffer();
    await broadcasterPeer.setLocalDescription(offer);
    await viewerPeer.setRemoteDescription(offer);

    const answer = await viewerPeer.createAnswer();
    await viewerPeer.setLocalDescription(answer);
    await broadcasterPeer.setRemoteDescription(answer);

    setStatus(true);
    updateControls(true);
    showToast("Livestream gestart. Deel je scherm met kijkers!");
  } catch (error) {
    console.error(error);
    showToast("Starten mislukt. Controleer permissies en probeer opnieuw.");
  }
}

async function stopBroadcast() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
  }

  [broadcasterPeer, viewerPeer].forEach((peer) => peer?.close());
  broadcasterPeer = null;
  viewerPeer = null;
  localStream = null;

  broadcasterVideo.srcObject = null;
  viewerVideo.srcObject = null;
  setStatus(false);
  updateControls(false);
  showToast("Livestream gestopt.");
}

async function switchCamera() {
  facingMode = facingMode === "user" ? "environment" : "user";
  if (!localStream) return startBroadcast();

  const wasVideoEnabled = localStream.getVideoTracks().some((t) => t.enabled);
  await stopBroadcast();
  await startBroadcast();
  if (!wasVideoEnabled) {
    toggleVideo();
  }
}

function toggleMic() {
  if (!localStream) return;
  const [track] = localStream.getAudioTracks();
  if (track) {
    track.enabled = !track.enabled;
    toggleMicButton.textContent = track.enabled ? "Microfoon uit" : "Microfoon aan";
    showToast(track.enabled ? "Microfoon ingeschakeld" : "Microfoon gedempt");
  }
}

function toggleVideo() {
  if (!localStream) return;
  const [track] = localStream.getVideoTracks();
  if (track) {
    track.enabled = !track.enabled;
    toggleVideoButton.textContent = track.enabled ? "Camera uit" : "Camera aan";
    showToast(track.enabled ? "Camera zichtbaar" : "Camera verborgen");
  }
}

function setIngestState({ url, key, roomId, status }) {
  ingestUrlLabel.textContent = url || "-";
  streamKeyLabel.textContent = key || "-";
  roomIdLabel.textContent = roomId || "-";
  if (status) {
    ingestStatusChip.textContent = status.text;
    ingestStatusChip.classList.toggle("chip--success", status.type === "success");
    ingestStatusChip.classList.toggle("chip--warn", status.type === "warn");
  }
}

function mockIngest() {
  return {
    url: "rtmps://push.bytedance.fake/live/",
    key: "demo-stream-key-12345",
    roomId: "demo-room",
  };
}

function normalizeIngestResponse(payload) {
  const data = payload?.data || {};
  const rtmp = data.rtmp_addr || data.rtmp || {};

  return {
    url: data.push_url || data.pushUrl || rtmp.push_url || rtmp.url,
    key: data.stream_key || data.streamKey || rtmp.stream_key,
    roomId: data.room_id || data.roomId,
  };
}

async function prepareBytedanceIngest() {
  if (!bytedanceTokenInput.value.trim()) {
    setIngestState({ status: { text: "Token nodig", type: "warn" } });
    return null;
  }

  ingestStatusChip.textContent = "Aan het ophalen...";
  ingestStatusChip.classList.remove("chip--success", "chip--warn");

  try {
    const url = `${BYTEDANCE_CREATE_STREAM_ENDPOINT}?access_token=${encodeURIComponent(bytedanceTokenInput.value.trim())}`;
    const response = await fetch(url, { method: "POST" });

    if (!response.ok) {
      throw new Error(`ByteDance ingest request mislukt: ${response.status}`);
    }

    const payload = await response.json();
    const ingest = normalizeIngestResponse(payload);
    if (!ingest.url || !ingest.key) {
      throw new Error("Incomplete ingest gegevens");
    }

    setIngestState({
      url: ingest.url,
      key: ingest.key,
      roomId: ingest.roomId || "-",
      status: { text: "Ingest klaar", type: "success" },
    });
    showToast("ByteDance ingest opgehaald. Gebruik de push URL en key voor je encoder.");
    return ingest;
  } catch (error) {
    console.warn("ByteDance ingest fallback", error);
    const ingest = mockIngest();
    setIngestState({ ...ingest, status: { text: "Mock ingest actief", type: "warn" } });
    showToast("Live API niet bereikbaar; mock ingest geladen.");
    return ingest;
  }
}

function renderLiveList(items) {
  liveList.innerHTML = "";
  if (!items.length) {
    liveList.innerHTML = '<li class="live-list__empty">Geen livestreams gevonden.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "live-list__item";
    li.innerHTML = `
      <div class="live-list__title">${item.title}</div>
      <div class="live-list__meta">${item.anchor} · ${item.viewers} kijkers</div>
      <div class="live-list__id">Room: ${item.id}</div>
    `;
    fragment.appendChild(li);
  });
  liveList.appendChild(fragment);
}

function normalizeLives(payload) {
  const list = payload?.data?.list || payload?.data?.lives || [];
  return list.map((item, idx) => ({
    id: item.room_id || item.roomId || item.id || `live-${idx}`,
    title: item.title || item.share_title || "Ongetitelde live",
    anchor: item.anchor?.nickname || item.owner?.nickname || item.user?.nickname || "Onbekende host",
    viewers: item.user_count || item.viewers || item.audience_count || 0,
  }));
}

function mockLiveList() {
  return [
    { id: "demo-1001", title: "ByteDance keynote", anchor: "Studio Douyin", viewers: 12400 },
    { id: "demo-1002", title: "Creator Q&A", anchor: "TikTok Live NL", viewers: 8300 },
    { id: "demo-1003", title: "Product launch", anchor: "Bytedance DevRel", viewers: 4200 },
  ];
}

async function fetchByteDanceLives() {
  liveListStatusChip.textContent = "Aan het ophalen...";
  liveListStatusChip.classList.remove("chip--success", "chip--warn", "chip--ghost");

  if (!bytedanceTokenInput.value.trim()) {
    renderLiveList(mockLiveList());
    liveListStatusChip.textContent = "Mock data";
    liveListStatusChip.classList.add("chip--warn");
    showToast("Geen token opgegeven. Mock ByteDance-lives getoond.");
    return;
  }

  try {
    const url = `${BYTEDANCE_LIVE_LIST_ENDPOINT}?access_token=${encodeURIComponent(bytedanceTokenInput.value.trim())}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const lives = normalizeLives(payload);
    renderLiveList(lives);
    liveListStatusChip.textContent = "Live";
    liveListStatusChip.classList.add("chip--success");
    showToast("ByteDance livestreams bijgewerkt.");
  } catch (error) {
    console.warn("ByteDance lives fallback", error);
    renderLiveList(mockLiveList());
    liveListStatusChip.textContent = "Mock data";
    liveListStatusChip.classList.add("chip--warn");
    showToast("ByteDance API mislukt; mock lives getoond.");
  }
}

startButton.addEventListener("click", startBroadcast);
stopButton.addEventListener("click", stopBroadcast);
switchCameraButton.addEventListener("click", switchCamera);
toggleMicButton.addEventListener("click", toggleMic);
toggleVideoButton.addEventListener("click", toggleVideo);
bytedanceSyncButton.addEventListener("click", prepareBytedanceIngest);
refreshLivesButton.addEventListener("click", fetchByteDanceLives);

window.addEventListener("unload", stopBroadcast);

if (!window.RTCPeerConnection) {
  showToast("WebRTC wordt niet ondersteund in deze browser.");
  updateControls(false);
}
