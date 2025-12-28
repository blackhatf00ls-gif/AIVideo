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

let localStream = null;
let broadcasterPeer = null;
let viewerPeer = null;
let facingMode = "environment";

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

startButton.addEventListener("click", startBroadcast);
stopButton.addEventListener("click", stopBroadcast);
switchCameraButton.addEventListener("click", switchCamera);
toggleMicButton.addEventListener("click", toggleMic);
toggleVideoButton.addEventListener("click", toggleVideo);

window.addEventListener("unload", stopBroadcast);

if (!window.RTCPeerConnection) {
  showToast("WebRTC wordt niet ondersteund in deze browser.");
  updateControls(false);
}
