const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, "project-data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Friendly root
app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "collab-api",
    routes: [
      "GET  /projects/:project/files",
      "GET  /projects/:project/file?path=<filePath>",
      "POST /projects/:project/file { path, content }",
    ],
  });
});

// List all workspaces (projects)
app.get("/workspaces", (_req, res) => {
  // fs is already required at the top
  const root = path.join(__dirname, "project-data");
  if (!fs.existsSync(root)) return res.json([]);
  
  const items = fs.readdirSync(root).filter(name => 
    fs.statSync(path.join(root, name)).isDirectory()
  );
  res.json(items);
});

function ensureProject(project) {
  const p = path.join(DATA_DIR, project);
  
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });

  // Default starter files for a new project. 
  const defaults = {
    "app.ts": `// Simple TypeScript file used for testing the editor
export function greet(name: string) {
  return 'Hello, ' + name + '!';
}

console.log(greet("team"));`,

    "index.html": `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>My First Project</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <h1>Hi team 👋</h1>
    <p>Edit me from the collaborative editor!</p>
    <script type="module">
      import { greet } from "./app.ts";
      console.log(greet("from index.html"));
    </script>
  </body>
</html>`,

    "style.css": `:root {
  --fg: #0f172a;
  --bg: #f8fafc;
  --accent: #3b82f6;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--fg);
}

h1 {
  color: var(--accent);
  margin: 24px;
}

p {
  margin: 0 24px 24px;
}`
  };

  try {
    for (const [name, content] of Object.entries(defaults)) {
      const full = path.join(p, name);
      // Only write default files if they don't exist yet
      if (!fs.existsSync(full)) fs.writeFileSync(full, content, "utf8");
    }
  } catch (err) {
    console.error("Error creating default project files:", err);
  }

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
  
  // Security Note: In production, validate filePath does not contain ".." to prevent directory traversal
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
app.listen(PORT, () => console.log('API on http://localhost:' + PORT));