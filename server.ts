import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

const db = new Database("minha_hq.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS comics (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS panels (
    id TEXT PRIMARY KEY,
    comic_id TEXT NOT NULL,
    image_url TEXT,
    caption TEXT,
    order_index INTEGER,
    FOREIGN KEY (comic_id) REFERENCES comics(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/comics", (req, res) => {
    const comics = db.prepare("SELECT * FROM comics ORDER BY created_at DESC").all();
    res.json(comics);
  });

  app.post("/api/comics", (req, res) => {
    const { title, description } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO comics (id, title, description) VALUES (?, ?, ?)").run(id, title, description);
    res.json({ id, title, description });
  });

  app.get("/api/comics/:id", (req, res) => {
    const comic = db.prepare("SELECT * FROM comics WHERE id = ?").get(req.params.id);
    if (!comic) return res.status(404).json({ error: "Comic not found" });
    
    const panels = db.prepare("SELECT * FROM panels WHERE comic_id = ? ORDER BY order_index ASC").all(req.params.id);
    res.json({ ...comic, panels });
  });

  app.delete("/api/comics/:id", (req, res) => {
    db.prepare("DELETE FROM panels WHERE comic_id = ?").run(req.params.id);
    db.prepare("DELETE FROM comics WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/comics/:id/panels", (req, res) => {
    const { image_url, caption, order_index } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO panels (id, comic_id, image_url, caption, order_index) VALUES (?, ?, ?, ?, ?)")
      .run(id, req.params.id, image_url, caption, order_index);
    res.json({ id, image_url, caption, order_index });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
