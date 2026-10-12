
require("dotenv").config({ path: __dirname + "/.env" });

const bcrypt = require("bcryptjs");
const db = require("./db");

async function seedAdmin() {
  try {
    const username = process.env.ADMIN_USERNAME;
    const password = process.env.ADMIN_PASSWORD;

    if (!username || !password) {
      throw new Error("ADMIN_USERNAME atau ADMIN_PASSWORD belum diatur.");
    }

    const hash = await bcrypt.hash(password, 12);

    await db.execute(
      `INSERT INTO admin_users (username, password_hash)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE password_hash = ?`,
      [username, hash, hash]
    );

    console.log("Akun admin berhasil disiapkan.");
  } catch (error) {
    console.error("Gagal membuat admin:", error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

seedAdmin();
