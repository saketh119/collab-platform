// terminal-server/index.js
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");
const path = require("path");
const os = require("os");

// CONFIG: allowed workspace root (server-side)
// make sure this points to the folder where your api/project-data lives
const WORKSPACES_ROOT = path.join(__dirname, "..", "api", "project-data");

const app = express();
app.use(express.json());

// Small route: list available subfolders under WORKSPACES_ROOT
app.get("/workspaces", (req, res) => {
  const fs = require("fs");
  if (!fs.existsSync(WORKSPACES_ROOT)) return res.json([]);
  const items = fs.readdirSync(WORKSPACES_ROOT).filter(name =>
    fs.statSync(path.join(WORKSPACES_ROOT, name)).isDirectory()
  );
  res.json(items);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/term" });

wss.on("connection", (ws, req) => {
  // Expect initial message describing which workspace folder and optional cols/rows
  let ptyProcess = null;
  ws.on("message", (msgRaw) => {
    let msg;
    try { msg = JSON.parse(msgRaw); } catch { return; }

    if (msg.type === "start") {
      // msg: { type: "start", workspace: "my-first-project", shell?: "bash", cols, rows }
      const fs = require("fs");
      const workspace = msg.workspace || "";
      const cwd = path.join(WORKSPACES_ROOT, workspace);
      if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
        ws.send(JSON.stringify({ type: "error", error: "invalid workspace" }));
        ws.close();
        return;
      }

      const shell = msg.shell || (os.platform() === "win32" ? "powershell.exe" : "bash");
      ptyProcess = pty.spawn(shell, [], {
        name: "xterm-color",
        cols: msg.cols || 80,
        rows: msg.rows || 24,
        cwd,
        env: process.env
      });

      ptyProcess.onData((data) => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: "output", data }));
      });

      return;
    }

    if (msg.type === "input") {
      if (ptyProcess) ptyProcess.write(msg.data);
    }

    if (msg.type === "resize") {
      if (ptyProcess) ptyProcess.resize(msg.cols, msg.rows);
    }

    if (msg.type === "kill") {
      if (ptyProcess) {
        try { ptyProcess.kill(); } catch {}
        ptyProcess = null;
      }
    }
  });

  ws.on("close", () => {
    try { if (ptyProcess) ptyProcess.kill(); } catch {}
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log("✅ Terminal server listening on ws://localhost:" + PORT + "/term and HTTP /workspaces"));
