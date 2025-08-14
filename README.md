# Free Web Calling App (WebRTC + WebSockets)

**What you get**
- 1:1 video calling with camera/mic
- Screen sharing (replace track)
- In-call chat via data channel (fallback relay)
- Recording (saves a WebM of the remote stream locally)
- Clean, responsive UI
- Uses **free Google STUN** (`stun:stun.l.google.com:19302`)
- No external paid services. **No TURN** by default (see below).

## Quick Start (Local, Free)
```bash
# 1) Extract the project and open a terminal in it
npm install
npm start
```
Now open **http://localhost:3000** in two different devices/tabs.
- Enter the same **room ID** (e.g., `demo-123`) and click **Join** on both.
- Click **Copy Invite** to share a URL with `?room=ROOMID`.

> Browsers require HTTPS (or localhost) for camera/mic. Localhost works out of the box.

## Deploy (Free Platforms)
Host `server.js` on any free Node hosting provider that supports WebSockets, and serve `public/` as static files. The server listens on `PORT` or `3000`.
- Set your app to use **Node 18+**.
- Ensure **WebSockets** are enabled.
- Access your deployed URL and share the invite.

## About TURN (Optional)
Some restrictive networks need a **TURN** server for media relay. Free TURN is rare/unreliable; most providers are paid. You can still use this app without TURN in many home/office networks. If you need TURN later, add to `iceServers` in `public/app.js`:
```js
const iceServers = [
  { urls: ['stun:stun.l.google.com:19302'] },
  { urls: 'turn:YOUR_TURN_SERVER', username: 'user', credential: 'pass' }
];
```

## Project Structure
```
webrtc-calling-app/
├─ server.js           # Node + ws signaling server
├─ package.json        # Dependencies & scripts
└─ public/
   ├─ index.html       # UI
   ├─ styles.css       # Styling
   └─ app.js           # WebRTC logic
```

## Features & Shortcuts
- Toggle **Camera** / **Mic**
- **Screen Share** replaces outgoing camera track; stops when you end share
- **Chat** via data channel; falls back to server relay
- **Recording**: saves remote stream (`.webm`)
- Invite link copies URL with `?room=ROOMID`

## Notes
- Rooms are limited to **2 participants** for simplicity. You can expand to N-way by creating a mesh (each peer connects to all others) or by using an SFU (more complex).
- Works on modern Chrome, Edge, Firefox; Safari is improving but can be finicky with some features.
- If you see "Room is full", choose a different room ID.
