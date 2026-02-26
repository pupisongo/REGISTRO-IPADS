import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("reservations.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS ipads (
    id INTEGER PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ipad_id INTEGER,
    fecha TEXT,
    bloque_horario TEXT,
    docente TEXT,
    curso TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ipad_id, fecha, bloque_horario)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed iPads if empty
const ipadCount = db.prepare("SELECT COUNT(*) as count FROM ipads").get() as { count: number };
if (ipadCount.count === 0) {
  const insertIpad = db.prepare("INSERT INTO ipads (id) VALUES (?)");
  for (let i = 1; i <= 60; i++) {
    insertIpad.run(i);
  }
}

// Seed default background if empty
const bgSetting = db.prepare("SELECT value FROM settings WHERE key = 'background_url'").get() as { value: string };
if (!bgSetting) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("background_url", "https://picsum.photos/id/1015/1920/1080?blur=2");
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // --- API ENDPOINTS ---

  // Get background image
  app.get("/api/settings/background", (req, res) => {
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'background_url'").get() as { value: string };
    res.json({ url: setting?.value || "" });
  });

  // Update background image
  app.post("/api/settings/background", (req, res) => {
    const { url } = req.body;
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("background_url", url);
    res.json({ success: true });
  });

  // Get availability for a specific date and block
  app.get("/api/availability", (req, res) => {
    const { fecha, bloque } = req.query;
    if (!fecha || !bloque) {
      return res.status(400).json({ error: "Fecha y bloque son requeridos" });
    }

    const reserved = db.prepare("SELECT ipad_id FROM reservations WHERE fecha = ? AND bloque_horario = ?")
      .all(fecha, bloque) as { ipad_id: number }[];
    
    const reservedIds = reserved.map(r => r.ipad_id);
    res.json({ reserved: reservedIds });
  });

  // Create a reservation
  app.post("/api/reserve", (req, res) => {
    const { ipad_id, fecha, bloque_horario, docente, curso } = req.body;

    if (!ipad_id || !fecha || !bloque_horario || !docente) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // Validate Monday to Friday
    const date = new Date(fecha);
    const day = date.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat
    if (day === 0 || day === 6) {
      return res.status(400).json({ error: "Solo se permiten reservas de lunes a viernes" });
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO reservations (ipad_id, fecha, bloque_horario, docente, curso)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(ipad_id, fecha, bloque_horario, docente, curso || "");
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        res.status(409).json({ error: "Este iPad ya está reservado para este bloque y fecha" });
      } else {
        res.status(500).json({ error: "Error al procesar la reserva" });
      }
    }
  });

  // Get all reservations with filters
  app.get("/api/reservations", (req, res) => {
    const { month, year, docente, ipad_id } = req.query;
    let query = "SELECT * FROM reservations WHERE 1=1";
    const params: any[] = [];

    if (month && year) {
      query += " AND strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?";
      params.push(month.toString().padStart(2, '0'), year.toString());
    }
    if (docente) {
      query += " AND docente LIKE ?";
      params.push(`%${docente}%`);
    }
    if (ipad_id) {
      query += " AND ipad_id = ?";
      params.push(ipad_id);
    }

    query += " ORDER BY fecha DESC, bloque_horario ASC";
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  });

  // Get statistics
  app.get("/api/stats", (req, res) => {
    const { month, year } = req.query;
    const m = month?.toString().padStart(2, '0');
    const y = year?.toString();

    const totalReservas = db.prepare("SELECT COUNT(*) as count FROM reservations WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?")
      .get(m, y) as { count: number };

    const ipadMasUsado = db.prepare(`
      SELECT ipad_id, COUNT(*) as count 
      FROM reservations 
      WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      GROUP BY ipad_id 
      ORDER BY count DESC 
      LIMIT 1
    `).get(m, y) as { ipad_id: number, count: number };

    const diaMasDemanda = db.prepare(`
      SELECT fecha, COUNT(*) as count 
      FROM reservations 
      WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      GROUP BY fecha 
      ORDER BY count DESC 
      LIMIT 1
    `).get(m, y) as { fecha: string, count: number };

    const bloqueMasReservado = db.prepare(`
      SELECT bloque_horario, COUNT(*) as count 
      FROM reservations 
      WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      GROUP BY bloque_horario 
      ORDER BY count DESC 
      LIMIT 1
    `).get(m, y) as { bloque_horario: string, count: number };

    // Total possible slots in a month (approx 20 days * 8 blocks * 60 ipads)
    // For simplicity, let's just return the counts
    res.json({
      total: totalReservas.count,
      ipadMasUsado: ipadMasUsado?.ipad_id || "N/A",
      diaMasDemanda: diaMasDemanda?.fecha || "N/A",
      bloqueMasReservado: bloqueMasReservado?.bloque_horario || "N/A"
    });
  });

  // Export to Excel
  app.get("/api/export/month/:month/:year", async (req, res) => {
    const { month, year } = req.params;
    const m = month.padStart(2, '0');
    const y = year;

    const reservations = db.prepare(`
      SELECT * FROM reservations 
      WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      ORDER BY fecha ASC, bloque_horario ASC
    `).all(m, y) as any[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Reservas");

    // Header
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "iPad", key: "ipad_id", width: 10 },
      { header: "Fecha", key: "fecha", width: 15 },
      { header: "Bloque", key: "bloque_horario", width: 20 },
      { header: "Docente", key: "docente", width: 30 },
      { header: "Curso", key: "curso", width: 20 },
      { header: "Registro", key: "timestamp", width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.addRows(reservations);

    // Stats Sheet
    const statsSheet = workbook.addWorksheet("Estadísticas");
    statsSheet.columns = [
      { header: "Métrica", key: "metric", width: 30 },
      { header: "Valor", key: "value", width: 30 },
    ];
    statsSheet.getRow(1).font = { bold: true };

    const stats = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM reservations WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?) as total,
        (SELECT ipad_id FROM reservations WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ? GROUP BY ipad_id ORDER BY COUNT(*) DESC LIMIT 1) as top_ipad,
        (SELECT bloque_horario FROM reservations WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ? GROUP BY bloque_horario ORDER BY COUNT(*) DESC LIMIT 1) as top_block
    `).get(m, y, m, y, m, y) as any;

    statsSheet.addRows([
      { metric: "Total Reservas", value: stats.total },
      { metric: "iPad más utilizado", value: stats.top_ipad || "N/A" },
      { metric: "Bloque más solicitado", value: stats.top_block || "N/A" },
    ]);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=reservas_${m}_${y}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
