// Simple signaling server for a 1:1 WebRTC call using WebSockets
// Run: npm install && npm start
// Serves static files from /public and handles signaling messages.
// Free to run locally or on any free Node hosting provider that supports WebSockets.
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve client
app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map(); // roomId -> Set(ws)

function getRoomClients(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, new Set());
  return rooms.get(roomId);
}

function broadcastToRoom(roomId, data, exceptWs = null) {
  const set = getRoomClients(roomId);
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN && client !== exceptWs) {
      client.send(JSON.stringify(data));
    }
  }
}

wss.on('connection', (ws) => {
  ws._roomId = null;
  ws._id = Math.random().toString(36).slice(2, 10);

  ws.on('message', (msg) => {
    let data;
    try { data = JSON.parse(msg); } catch { return; }

    const { type, roomId, payload } = data;

    if (type === 'join') {
      const clients = getRoomClients(roomId);
      if (clients.size >= 2) {
        ws.send(JSON.stringify({ type: 'room_full', roomId }));
        return;
      }
      ws._roomId = roomId;
      clients.add(ws);
      ws.send(JSON.stringify({ type: 'joined', roomId, id: ws._id, peers: clients.size - 1 }));
      broadcastToRoom(roomId, { type: 'peer_joined', id: ws._id }, ws);
      return;
    }

    if (!ws._roomId) return;

    // Relay SDP/ICE/chat/leave
    if (['offer','answer','candidate','chat','leave'].includes(type)) {
      broadcastToRoom(ws._roomId, { type, from: ws._id, payload }, ws);
    }
  });

  ws.on('close', () => {
    const roomId = ws._roomId;
    if (roomId) {
      const clients = getRoomClients(roomId);
      clients.delete(ws);
      broadcastToRoom(roomId, { type: 'peer_left', id: ws._id });
      if (clients.size === 0) rooms.delete(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
