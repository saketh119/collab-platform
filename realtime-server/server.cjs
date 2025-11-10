const http = require("http");
const { WebSocketServer } = require("ws");
const url = require("url");

const rooms = new Map(); // roomId -> { text: string, clients: Set<ws> }

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { text: "", clients: new Set() });
  return rooms.get(roomId);
}

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("WS realtime server alive");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const { query } = url.parse(req.url, true);
  const roomId = query.room || "default";
  const clientId = Math.random().toString(36).slice(2, 8);
  ws._clientId = clientId;

  const room = getRoom(roomId);
  room.clients.add(ws);

  // Send current doc
  ws.send(JSON.stringify({ type: "init", text: room.text }));

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === "update") {
      room.text = msg.text;
      for (const c of room.clients) {
        if (c !== ws && c.readyState === 1) {
          c.send(JSON.stringify({ type: "remote-update", text: room.text, from: clientId }));
        }
      }
    }

    // Presence: broadcast name + cursor position
    if (msg.type === "presence") {
      const payload = JSON.stringify({
        type: "presence",
        from: clientId,
        name: msg.name,
        cursor: msg.cursor, // { lineNumber, column }
      });
      for (const c of room.clients) {
        if (c !== ws && c.readyState === 1) c.send(payload);
      }
    }
  });

  ws.on("close", () => {
    room.clients.delete(ws);
  });
});

const PORT = 1234;
server.listen(PORT, () => console.log("✅ WS Server running on ws://localhost:" + PORT));
