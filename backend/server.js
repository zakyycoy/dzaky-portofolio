
require("dotenv").config({
  path: __dirname + "/.env"
});

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

// Pastikan SESSION_SECRET sudah diatur di backend/.env
if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET belum diatur di backend/.env");
}

app.use(express.json({ limit: "10kb" }));

app.use(session({
  name: "dzaky.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 2 * 60 * 60 * 1000
  }
}));

// Tes lokasi folder admin
const fs = require("fs");

const adminPath = path.join(__dirname, "../admin");

console.log("Lokasi admin:", adminPath);
console.log(
  "index.html ditemukan:",
  fs.existsSync(path.join(adminPath, "index.html"))
);


app.get(["/admin", "/admin/"], (req, res) => {
  res.sendFile(path.join(adminPath, "index.html"));
});

app.use("/admin", express.static(adminPath));
// Tampilkan website portfolio
app.use(express.static(path.join(__dirname, "../frontend")));

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.adminUser) {
    return res.status(401).json({
      success: false,
      message: "Silakan login sebagai admin."
    });
  }

  next();
}

// Tes backend
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Backend DZAKY.DEV aktif!"
  });
});

// Tes database
app.get("/api/db-test", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({
      success: true,
      message: "Database MySQL berhasil terhubung!"
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: "Koneksi database gagal."
    });
  }
});

// Daftar project
app.get("/api/projects", async (req, res) => {
  try {
    const [projects] = await db.query(
      "SELECT * FROM projects ORDER BY id DESC"
    );
    res.json({
      success: true,
      total: projects.length,
      data: projects
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil data project."
    });
  }
});

// Login admin
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !username.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Username dan password wajib diisi."
      });
    }

    const [rows] = await db.execute(
      "SELECT id, username, password_hash FROM admin_users WHERE username = ?",
      [username.trim()]
    );

    if (
      rows.length === 0 ||
      !(await bcrypt.compare(password, rows[0].password_hash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Username atau password salah."
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).json({
          success: false,
          message: "Gagal membuat sesi login."
        });
      }

      req.session.adminUser = {
        id: rows[0].id,
        username: rows[0].username
      };

      req.session.save((saveError) => {
        if (saveError) {
          return res.status(500).json({
            success: false,
            message: "Gagal menyimpan sesi login."
          });
        }

        res.json({
          success: true,
          message: "Login berhasil!",
          username: rows[0].username
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan saat login."
    });
  }
});

// Cek sesi login
app.get("/api/admin/me", (req, res) => {
  if (!req.session.adminUser) {
    return res.status(401).json({ success: false });
  }

  res.json({
    success: true,
    username: req.session.adminUser.username
  });
});

// Logout
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: "Gagal logout."
      });
    }

    res.clearCookie("dzaky.sid");
    res.json({ success: true, message: "Logout berhasil." });
  });
});

// Tambah project
app.post("/api/admin/projects", requireAdmin, async (req, res) => {
  try {
    const { title, description, technologies, project_url } = req.body;

    if (
      typeof title !== "string" ||
      typeof description !== "string" ||
      !title.trim() ||
      !description.trim() ||
      title.length > 150 ||
      description.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Judul dan deskripsi wajib diisi."
      });
    }

    const [result] = await db.execute(
      `INSERT INTO projects
       (title, description, technologies, project_url)
       VALUES (?, ?, ?, ?)`,
      [
        title.trim(),
        description.trim(),
        typeof technologies === "string" ? technologies.trim() : "",
        typeof project_url === "string" ? project_url.trim() : ""
      ]
    );

    res.status(201).json({
      success: true,
      message: "Project berhasil ditambahkan!",
      id: result.insertId
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: "Gagal menambahkan project."
    });
  }
});

// Edit project
app.put("/api/admin/projects/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { title, description, technologies, project_url } = req.body;

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      typeof title !== "string" ||
      typeof description !== "string" ||
      !title.trim() ||
      !description.trim() ||
      title.length > 150 ||
      description.length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message: "Data project tidak valid."
      });
    }

    const [result] = await db.execute(
      `UPDATE projects
       SET title = ?, description = ?, technologies = ?, project_url = ?
       WHERE id = ?`,
      [
        title.trim(),
        description.trim(),
        typeof technologies === "string" ? technologies.trim() : "",
        typeof project_url === "string" ? project_url.trim() : "",
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Project tidak ditemukan."
      });
    }

    res.json({
      success: true,
      message: "Project berhasil diperbarui!"
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui project."
    });
  }
});

// Hapus project
app.delete("/api/admin/projects/:id", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        success: false,
        message: "ID project tidak valid."
      });
    }

    const [result] = await db.execute(
      "DELETE FROM projects WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Project tidak ditemukan."
      });
    }

    res.json({
      success: true,
      message: "Project berhasil dihapus!"
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      success: false,
      message: "Gagal menghapus project."
    });
  }
});

// Jalankan server setelah database bisa dihubungi
async function startServer() {
  try {
    await db.query("SELECT 1");

    app.listen(PORT, () => {
      console.log(`Backend aktif di http://localhost:${PORT}`);
      console.log(`Admin: http://localhost:${PORT}/admin/`);
    });
  } catch (error) {
    console.error("Koneksi database gagal:", error.message);
    process.exit(1);
  }
}

startServer();
