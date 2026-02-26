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

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    docente TEXT,
    curso TEXT,
    ipads TEXT, -- Comma separated list of IDs
    fecha TEXT,
    bloque_horario TEXT,
    tipo TEXT, -- 'RESERVA' or 'DEVOLUCION'
    novedades TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
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

  // Get availability for a specific date (optionally filtered by block)
  app.get("/api/availability", (req, res) => {
    const { fecha, bloque } = req.query;
    if (!fecha) {
      return res.status(400).json({ error: "Fecha es requerida" });
    }

    let query = "SELECT ipad_id, bloque_horario FROM reservations WHERE fecha = ?";
    const params: any[] = [fecha];

    if (bloque) {
      query += " AND bloque_horario = ?";
      params.push(bloque);
    }

    const rows = db.prepare(query).all(...params) as { ipad_id: number, bloque_horario: string }[];
    res.json({ reserved: rows });
  });

  // Create a reservation (handles multiple IDs)
  app.post("/api/reserve", (req, res) => {
    const { ipad_ids, fecha, bloque_horario, docente, curso } = req.body;

    if (!ipad_ids || !Array.isArray(ipad_ids) || ipad_ids.length === 0 || !fecha || !bloque_horario || !docente) {
      return res.status(400).json({ error: "Faltan campos obligatorios o formato inválido" });
    }

    const insertRes = db.prepare(`
      INSERT INTO reservations (ipad_id, fecha, bloque_horario, docente, curso)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertHistory = db.prepare(`
      INSERT INTO history (docente, curso, ipads, fecha, bloque_horario, tipo, novedades)
      VALUES (?, ?, ?, ?, ?, 'RESERVA', '')
    `);

    const transaction = db.transaction((ids: number[]) => {
      for (const id of ids) {
        insertRes.run(id, fecha, bloque_horario, docente, curso || "");
      }
      insertHistory.run(docente, curso || "", ids.join(", "), fecha, bloque_horario);
    });

    try {
      transaction(ipad_ids);
      res.json({ success: true });
    } catch (error: any) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        res.status(409).json({ error: "Uno o más iPads ya están reservados para este bloque y fecha" });
      } else {
        console.error(error);
        res.status(500).json({ error: "Error al procesar la reserva" });
      }
    }
  });

  // Return/Release iPads
  app.post("/api/return", (req, res) => {
    const { ipad_ids, fecha, docente, curso, novedades } = req.body;

    if (!ipad_ids || !Array.isArray(ipad_ids) || ipad_ids.length === 0 || !fecha) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // Prevent modifications to past days (using string comparison for YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];
    
    if (fecha < todayStr) {
      return res.status(400).json({ error: "No se pueden realizar devoluciones de días anteriores" });
    }

    // Find which blocks are actually being released for the history report
    const getBlocks = db.prepare(`
      SELECT bloque_horario FROM reservations 
      WHERE ipad_id = ? AND fecha = ?
    `);

    const remove = db.prepare(`
      DELETE FROM reservations 
      WHERE ipad_id = ? AND fecha = ?
    `);

    const insertHistory = db.prepare(`
      INSERT INTO history (docente, curso, ipads, fecha, bloque_horario, tipo, novedades)
      VALUES (?, ?, ?, ?, ?, 'DEVOLUCION', ?)
    `);

    const transaction = db.transaction((ids: number[]) => {
      const releasedBlocks = new Set<string>();
      
      for (const id of ids) {
        const rows = getBlocks.all(id, fecha) as { bloque_horario: string }[];
        if (rows.length > 0) {
          rows.forEach(r => releasedBlocks.add(r.bloque_horario));
          remove.run(id, fecha);
        }
      }
      
      if (releasedBlocks.size > 0) {
        const blocksStr = Array.from(releasedBlocks).join(", ");
        insertHistory.run(docente || "N/A", curso || "N/A", ids.join(", "), fecha, blocksStr, novedades || "");
        return true;
      }
      return false;
    });

    try {
      const result = transaction(ipad_ids);
      if (result) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "No se encontraron reservas activas para los iPads seleccionados en esta fecha" });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: "Error al liberar los iPads" });
    }
  });

  // Get all history with filters
  app.get("/api/reservations", (req, res) => {
    const { month, year, docente } = req.query;
    let query = "SELECT * FROM history WHERE 1=1";
    const params: any[] = [];

    if (month && year) {
      query += " AND strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?";
      params.push(month.toString().padStart(2, '0'), year.toString());
    }
    if (docente) {
      query += " AND docente LIKE ?";
      params.push(`%${docente}%`);
    }

    query += " ORDER BY timestamp DESC";
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

    const history = db.prepare(`
      SELECT * FROM history 
      WHERE strftime('%m', fecha) = ? AND strftime('%Y', fecha) = ?
      ORDER BY timestamp DESC
    `).all(m, y) as any[];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Historial");

    // Header
    sheet.columns = [
      { header: "ID", key: "id", width: 10 },
      { header: "Tipo", key: "tipo", width: 15 },
      { header: "iPads", key: "ipads", width: 30 },
      { header: "Fecha Uso", key: "fecha", width: 15 },
      { header: "Bloque", key: "bloque_horario", width: 20 },
      { header: "Docente", key: "docente", width: 30 },
      { header: "Curso", key: "curso", width: 20 },
      { header: "Novedades", key: "novedades", width: 40 },
      { header: "Registro", key: "timestamp", width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.addRows(history);

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
