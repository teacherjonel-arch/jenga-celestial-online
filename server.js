const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = process.env.PORT || 10000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const rooms = new Map();

function send(ws, message) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function broadcast(room, message) {
  for (const player of room.players) send(player.ws, message);
}

function makeRoomCode() {
  let code;
  do code = crypto.randomBytes(3).toString('hex').toUpperCase();
  while (rooms.has(code));
  return code;
}

function cleanName(name, fallback) {
  const value = String(name || '').trim().slice(0, 30);
  return value || fallback;
}

function publicRoom(room) {
  return {
    players: room.players.map(p => p.name),
    connected: room.players.length
  };
}

function initialBlocks() {
  return Array.from({ length: 36 }, (_, id) => ({
    id,
    layer: Math.floor(id / 3),
    removed: false,
    visible: true
  }));
}

function gameState(room) {
  return {
    currentPlayerIndex: room.currentPlayerIndex,
    isFallen: room.isFallen,
    blocks: room.blocks
  };
}

function removePlayer(ws) {
  const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
  if (!room) return;

  const player = room.players.find(p => p.ws === ws);
  if (!player) return;

  const wasHost = player.index === 0;
  if (wasHost) {
    broadcast(room, { type: 'room_closed' });
    rooms.delete(room.code);
    return;
  }

  room.players = room.players.filter(p => p.ws !== ws);
  room.players.forEach((p, i) => { p.index = i; });
  if (room.currentPlayerIndex >= room.players.length) room.currentPlayerIndex = 0;
  broadcast(room, { type: 'lobby', ...publicRoom(room) });
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, service: 'jenga-celestial', rooms: rooms.size }));
    return;
  }

  let requestPath = (req.url || '/').split('?')[0];
  if (requestPath === '/') requestPath = '/index.html';
  const safePath = path.normalize(requestPath).replace(/^([.][.][\\/])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', ws => {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { type: 'error', message: 'Mensaje inválido.' }); }

    if (msg.type === 'create_room') {
      if (ws.roomCode) return send(ws, { type: 'error', message: 'Ya estás en una sala.' });
      const code = makeRoomCode();
      const room = {
        code,
        started: false,
        isFallen: false,
        currentPlayerIndex: 0,
        players: [{ ws, index: 0, name: cleanName(msg.name, 'Jugador 1') }],
        blocks: initialBlocks()
      };
      rooms.set(code, room);
      ws.roomCode = code;
      ws.playerIndex = 0;
      send(ws, { type: 'room_created', roomCode: code, playerIndex: 0, players: [room.players[0].name] });
      return;
    }

    if (msg.type === 'join_room') {
      const code = String(msg.roomCode || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return send(ws, { type: 'error', message: 'La sala no existe.' });
      if (room.started) return send(ws, { type: 'error', message: 'La partida ya comenzó.' });
      if (room.players.length >= 4) return send(ws, { type: 'error', message: 'La sala ya tiene 4 jugadores.' });

      const player = { ws, index: room.players.length, name: cleanName(msg.name, `Jugador ${room.players.length + 1}`) };
      room.players.push(player);
      ws.roomCode = code;
      ws.playerIndex = player.index;
      send(ws, { type: 'joined', roomCode: code, playerIndex: player.index, connected: room.players.length, players: room.players.map(p => p.name) });
      broadcast(room, { type: 'lobby', ...publicRoom(room) });
      return;
    }

    const room = ws.roomCode ? rooms.get(ws.roomCode) : null;
    if (!room) return send(ws, { type: 'error', message: 'Primero crea o únete a una sala.' });
    const player = room.players.find(p => p.ws === ws);
    if (!player) return;

    if (msg.type === 'start_game') {
      if (player.index !== 0) return send(ws, { type: 'error', message: 'Solo el anfitrión puede iniciar.' });
      if (room.players.length < 2) return send(ws, { type: 'error', message: 'Se necesitan al menos 2 jugadores para iniciar.' });
      room.started = true;
      room.isFallen = false;
      room.currentPlayerIndex = 0;
      room.blocks = initialBlocks();
      broadcast(room, { type: 'start', players: room.players.map(p => p.name), currentPlayerIndex: 0, state: gameState(room) });
      return;
    }

    if (msg.type === 'request_block') {
      if (!room.started || room.isFallen) return;
      if (player.index !== room.currentPlayerIndex) return;
      const block = room.blocks.find(b => b.id === Number(msg.blockId));
      if (!block || block.removed) return;
      broadcast(room, { type: 'question', blockId: block.id, playerIndex: player.index });
      return;
    }

    if (msg.type === 'answer') {
      if (!room.started || room.isFallen) return;
      if (player.index !== room.currentPlayerIndex) return;
      const block = room.blocks.find(b => b.id === Number(msg.blockId));
      if (!block || block.removed) return;

      const selected = Number(msg.selected);
      if (!Number.isInteger(selected) || selected < 0 || selected > 3) return;
      const failedPlayerIndex = room.currentPlayerIndex;
      block.removed = true;
      block.visible = false;

      const layerBlocks = room.blocks.filter(b => b.layer === block.layer && !b.removed);
      const fallen = layerBlocks.length === 0;
      room.isFallen = fallen;
      room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;

      broadcast(room, {
        type: 'answer_result',
        blockId: block.id,
        selected,
        currentPlayerIndex: room.currentPlayerIndex,
        fallen,
        failedPlayerIndex,
        state: gameState(room)
      });
      return;
    }

    if (msg.type === 'reset') {
      if (player.index !== 0) return send(ws, { type: 'error', message: 'Solo el anfitrión puede reiniciar.' });
      room.started = false;
      room.isFallen = false;
      room.currentPlayerIndex = 0;
      room.blocks = initialBlocks();
      broadcast(room, { type: 'reset' });
      broadcast(room, { type: 'lobby', ...publicRoom(room) });
    }
  });

  ws.on('close', () => removePlayer(ws));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Jenga Celestial online escuchando en ${PORT}`);
});
