const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, "project-data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Friendly root route
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "collab-api",
    routes: [
      "GET  /projects/:project/files",
      "GET  /projects/:project/file?path=<filePath>",
      "POST /projects/:project/file { path, content }"
    ]
  });
});

function ensureProject(project) {
  const p = path.join(DATA_DIR, project);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  return p;
}

app.get("/projects/:project/files", (req, res) => {
  const pdir = ensureProject(req.params.project);
  const files = fs.readdirSync(pdir);
  res.json(files);
});

app.get("/projects/:project/file", (req, res) => {
  const { project } = req.params;
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: "Missing ?path=" });
  const full = path.join(ensureProject(project), filePath);
  if (!fs.existsSync(full)) return res.status(404).json({ error: "not found" });
  res.type("text/plain").send(fs.readFileSync(full, "utf8"));
});

app.post("/projects/:project/file", (req, res) => {
  const { project } = req.params;
  const { path: filePath, content } = req.body || {};
  if (!filePath) return res.status(400).json({ error: "Missing body.path" });
  const full = path.join(ensureProject(project), filePath);
  fs.writeFileSync(full, content ?? "", "utf8");
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ API on http://localhost:${PORT}`));
