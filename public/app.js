// Free WebRTC Calling App (1:1).
// Requirements: load on HTTPS or localhost. Start the Node server for signaling.
// Features: join/leave room, camera/mic toggle, screen share, chat via data channel,
// simple recording (remote stream), invite link copy.

const els = {
  themeBtn: document.getElementById('themeBtn'),
  inviteLink: document.getElementById('inviteLink'),
  roomInput: document.getElementById('roomInput'),
  joinBtn: document.getElementById('joinBtn'),
  leaveBtn: document.getElementById('leaveBtn'),
  toggleCam: document.getElementById('toggleCam'),
  toggleMic: document.getElementById('toggleMic'),
  shareScreen: document.getElementById('shareScreen'),
  endCall: document.getElementById('endCall'),
  recordBtn: document.getElementById('recordBtn'),
  chat: document.getElementById('chat'),
  chatInput: document.getElementById('chatInput'),
  sendBtn: document.getElementById('sendBtn'),
  localVideo: document.getElementById('localVideo'),
  remoteVideo: document.getElementById('remoteVideo'),
};

// Theme
if (localStorage.getItem('webrtc-theme') === 'light') document.body.classList.add('light');
els.themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('webrtc-theme', document.body.classList.contains('light') ? 'light':'dark');
});

// Globals
let ws, roomId = '', pc, dc, localStream, remoteStream, mediaRecorder, recordedChunks = [];
let camOn = true, micOn = true, screenOn = false;

function log(...args){ console.log('[app]', ...args) }
function chatAdd(text, mine=false){
  const div = document.createElement('div');
  div.className = 'msg ' + (mine ? 'me':'them');
  div.textContent = text;
  els.chat.appendChild(div);
  els.chat.scrollTop = els.chat.scrollHeight;
}
function setInviteLink() {
  const url = new URL(window.location.href);
  if (roomId) url.searchParams.set('room', roomId);
  els.inviteLink.href = url.toString();
}
els.inviteLink.addEventListener('click', async (e) => {
  e.preventDefault();
  await navigator.clipboard.writeText(els.inviteLink.href);
  els.inviteLink.textContent = '✅ Copied!';
  setTimeout(() => els.inviteLink.textContent = 'Copy Invite', 1200);
});

// WebSocket Signaling
function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}`;
}
function connectWS() {
  ws = new WebSocket(wsUrl());
  ws.onopen = () => log('WS connected');
  ws.onmessage = (e) => {
    const { type, roomId: rid, payload, from, id, peers } = JSON.parse(e.data);
    if (type === 'joined') {
      log('Joined room', rid, 'peers:', peers);
      if (peers >= 1) makeOffer(); // second user creates the offer
    } else if (type === 'room_full') {
      alert('Room is full (max 2). Create a new room ID.');
      leave();
    } else if (type === 'peer_joined') {
      log('Peer joined', from);
    } else if (type === 'peer_left') {
      log('Peer left');
      if (remoteStream) {
        els.remoteVideo.srcObject = null;
        remoteStream = null;
      }
      if (pc) pc.close();
      setupPeer();
    } else if (type === 'offer') {
      handleOffer(payload);
    } else if (type === 'answer') {
      handleAnswer(payload);
    } else if (type === 'candidate') {
      handleCandidate(payload);
    } else if (type === 'chat') {
      chatAdd(payload, false);
    }
  };
  ws.onclose = () => log('WS closed');
}
connectWS();

function sendWS(type, payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, roomId, payload }));
  }
}

// WebRTC
const iceServers = [{ urls: ['stun:stun.l.google.com:19302'] }];

function setupPeer() {
  pc = new RTCPeerConnection({ iceServers });
  pc.onicecandidate = (e) => {
    if (e.candidate) sendWS('candidate', e.candidate);
  };
  pc.ontrack = (e) => {
    if (!remoteStream) remoteStream = new MediaStream();
    remoteStream.addTrack(e.track);
    els.remoteVideo.srcObject = remoteStream;
  };
  pc.onconnectionstatechange = () => log('pc state:', pc.connectionState);

  // Data channel for chat (offerer creates)
  try {
    dc = pc.createDataChannel('chat');
    wireDC(dc);
  } catch {}
  pc.ondatachannel = (e) => {
    dc = e.channel;
    wireDC(dc);
  };

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  }
}

function wireDC(channel) {
  channel.onopen = () => log('DC open');
  channel.onmessage = (e) => chatAdd(e.data, false);
  channel.onclose = () => log('DC closed');
}

async function ensureMedia() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  els.localVideo.srcObject = localStream;
  return localStream;
}

async function join() {
  roomId = (els.roomInput.value || '').trim();
  if (!roomId) {
    alert('Enter a room ID.');
    return;
  }
  await ensureMedia();
  setupPeer();
  sendWS('join', {});
  els.joinBtn.disabled = true;
  els.leaveBtn.disabled = false;
  els.roomInput.disabled = true;
  setInviteLink();
}
function leave() {
  sendWS('leave', {});
  if (pc) pc.close();
  pc = null;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  els.remoteVideo.srcObject = null;
  remoteStream = null;
  els.joinBtn.disabled = false;
  els.leaveBtn.disabled = true;
  els.roomInput.disabled = false;
}
els.joinBtn.addEventListener('click', join);
els.leaveBtn.addEventListener('click', leave);

// Auto-join from ?room=
(function autoJoinFromURL(){
  const params = new URLSearchParams(location.search);
  const r = params.get('room');
  if (r) { els.roomInput.value = r; join(); }
})();

// Offer/Answer
async function makeOffer() {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  sendWS('offer', offer);
}
async function handleOffer(offer) {
  if (!pc) setupPeer();
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  sendWS('answer', answer);
}
async function handleAnswer(answer) {
  await pc.setRemoteDescription(answer);
}
function handleCandidate(cand) {
  try { pc.addIceCandidate(cand); } catch (e) { console.warn('ICE add failed', e); }
}

// Controls
els.toggleCam.addEventListener('click', () => {
  camOn = !camOn;
  localStream?.getVideoTracks().forEach(t => t.enabled = camOn);
  els.toggleCam.textContent = camOn ? '📷 Camera Off' : '📷 Camera On';
});
els.toggleMic.addEventListener('click', () => {
  micOn = !micOn;
  localStream?.getAudioTracks().forEach(t => t.enabled = micOn);
  els.toggleMic.textContent = micOn ? '🎤 Mute' : '🎤 Unmute';
});

els.shareScreen.addEventListener('click', async () => {
  if (!screenOn) {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screen.getVideoTracks()[0];
      // replace outgoing video track
      const sender = pc?.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);
      screenOn = true;
      screenTrack.onended = async () => {
        // revert to camera
        const camTrack = localStream.getVideoTracks()[0];
        const sender = pc?.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(camTrack);
        screenOn = false;
      };
    } catch (e) {
      alert('Screen share blocked.');
    }
  } else {
    // stop screen -> revert to camera
    const camTrack = localStream.getVideoTracks()[0];
    const sender = pc?.getSenders().find(s => s.track && s.track.kind === 'video');
    if (sender) sender.replaceTrack(camTrack);
    screenOn = false;
  }
});

els.endCall.addEventListener('click', () => {
  leave();
});

// Chat
function sendChat() {
  const txt = els.chatInput.value.trim();
  if (!txt) return;
  if (dc && dc.readyState === 'open') {
    dc.send(txt);
    chatAdd(txt, true);
    els.chatInput.value = '';
  } else {
    sendWS('chat', txt); // fallback via server relay
    chatAdd(txt, true);
    els.chatInput.value = '';
  }
}
els.sendBtn.addEventListener('click', sendChat);
els.chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

// Recording remote stream (simple). Saves WebM locally.
els.recordBtn.addEventListener('click', () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    const target = els.remoteVideo.srcObject || localStream;
    if (!target) return alert('Nothing to record yet.');
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(target, { mimeType: 'video/webm;codecs=vp9,opus' });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `call-${Date.now()}.webm`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    };
    mediaRecorder.start();
    els.recordBtn.textContent = '⏹️ Stop Recording';
  } else {
    mediaRecorder.stop();
    els.recordBtn.textContent = '⏺️ Start Recording';
  }
});
