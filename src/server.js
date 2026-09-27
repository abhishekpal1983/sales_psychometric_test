import express from "express";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { score, SCALES, PLAIN, PROBES, FC_N, SJKEY } from "./scoring.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) { console.error("ADMIN_PASSWORD is not set. Set it in Railway variables."); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL is not set. Add the Postgres plugin in Railway."); process.exit(1); }

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false } });
await pool.query(`CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  role TEXT NOT NULL,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  minutes INT,
  left_page INT,
  tier TEXT,
  scores JSONB NOT NULL,
  raw JSONB NOT NULL
)`);

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "200kb" }));
app.use((req, res, next) => { res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); next(); });

// simple rate limit on submissions per IP
const hits = new Map();
function limited(ip) { const now = Date.now(); const h = (hits.get(ip) || []).filter(t => now - t < 3600e3); h.push(now); hits.set(ip, h); return h.length > 20; }

// ---- candidate ----
app.post("/api/submit", async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: "Too many submissions from this network. Try again later." });
  const d = req.body || {};
  const name = String(d.n || "").trim().slice(0, 120);
  const email = String(d.e || "").trim().slice(0, 160);
  if (name.length < 2) return res.status(400).json({ error: "Name missing." });
  if (!["agent", "manager"].includes(d.r)) return res.status(400).json({ error: "Role missing." });
  if (!d.a || typeof d.a !== "object" || Object.keys(d.a).length < 40) return res.status(400).json({ error: "Incomplete answers." });
  const s = score(d);
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
  await pool.query(
    "INSERT INTO results (id,name,email,role,minutes,left_page,scores,raw) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, name, email || null, d.r, Math.round((d.t || 0) / 60000), d.b || 0, s, { a: d.a, l: d.l, o: d.o, seed: d.seed, ua: req.headers["user-agent"] }]
  );
  res.json({ ok: true, ref: id.slice(-6).toUpperCase() });
});

// ---- admin ----
function auth(req, res, next) {
  const pw = req.headers["x-admin-password"];
  if (!pw || pw.length !== ADMIN_PASSWORD.length || !timingSafeEqual(pw, ADMIN_PASSWORD)) return res.status(401).json({ error: "Wrong password." });
  next();
}
function timingSafeEqual(a, b) { let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

app.get("/api/admin/meta", auth, (req, res) => res.json({ SCALES, PLAIN, PROBES, FC_N, SJ_MAX: SJKEY.length * 2 }));
app.get("/api/admin/results", auth, async (req, res) => {
  const { rows } = await pool.query("SELECT id,name,email,role,taken_at,minutes,left_page,tier,scores FROM results ORDER BY taken_at DESC");
  res.json(rows);
});
app.patch("/api/admin/results/:id", auth, async (req, res) => {
  const tier = ["Top third", "Middle third", "Bottom third", ""].includes(req.body.tier) ? (req.body.tier || null) : undefined;
  if (tier === undefined) return res.status(400).json({ error: "Bad tier." });
  await pool.query("UPDATE results SET tier=$2 WHERE id=$1", [req.params.id, tier]);
  res.json({ ok: true });
});
app.post("/api/admin/import", auth, async (req, res) => {
  let d; try { d = JSON.parse(Buffer.from(String(req.body.token || "").trim(), "base64").toString("utf8")); } catch { return res.status(400).json({ error: "Code could not be read." }); }
  const name = String(d.n || "").trim().slice(0, 120); if (name.length < 2 || !["agent","manager"].includes(d.r) || !d.a) return res.status(400).json({ error: "Code is incomplete." });
  const s = score(d); const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
  await pool.query("INSERT INTO results (id,name,email,role,minutes,left_page,scores,raw) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)", [id, name, d.e || null, d.r, Math.round((d.t||0)/60000), d.b||0, s, { a: d.a, l: d.l, o: d.o, seed: d.seed, imported: true }]);
  res.json({ ok: true, id });
});
app.delete("/api/admin/results/:id", auth, async (req, res) => { await pool.query("DELETE FROM results WHERE id=$1", [req.params.id]); res.json({ ok: true }); });
app.get("/api/admin/export.csv", auth, async (req, res) => {
  const { rows } = await pool.query("SELECT name,role,taken_at,minutes,left_page,tier,scores FROM results ORDER BY taken_at DESC");
  const keys = ["PA","AS","HC","GR","LS","LG","CO","SA","HO","TS","HY"];
  const head = ["name","role","date","tier","validity","band","composite","adjusted",...keys,"impression","forced_choice","sjt","attention_fails","contradictions","median_ms","left_page","minutes"];
  const lines = rows.map(r => { const s = r.scores; return [`"${r.name.replace(/"/g,'""')}"`, r.role, r.taken_at.toISOString().slice(0,10), r.tier||"", s.validity, `"${s.band}"`, s.comp, s.effComp, ...keys.map(k => s.scales[k] ?? ""), s.sd, s.fc, s.sj, s.at, s.cons, s.med, r.left_page, r.minutes].join(","); });
  res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", "attachment; filename=screener-results.csv");
  res.send([head.join(","), ...lines].join("\n"));
});

app.use(express.static(path.join(__dirname, "..", "public"), { extensions: ["html"] }));
app.listen(PORT, () => console.log("Screener listening on " + PORT));
