const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const CSV_FILE = path.join(__dirname, "..", "Receipts", "all-expenses.csv");

const DB_CONFIG = {
  host: "ep-cool-credit-a2yz2gw3.aws-eu-central-1.pg.laravel.cloud",
  port: 5432,
  database: "main",
  user: "laravel",
  password: "npg_UaBCPjwn8ph1",
  ssl: { rejectUnauthorized: false },
};

function parseCSV(content) {
  const lines = content.trim().split("\n");
  const header = lines[0].split(",");
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);

    const row = {};
    header.forEach((h, idx) => (row[h] = values[idx] || ""));
    rows.push(row);
  }
  return rows;
}

async function main() {
  const client = new Client(DB_CONFIG);
  await client.connect();
  console.log("Connected to database");

  const csv = fs.readFileSync(CSV_FILE, "utf-8");
  const rows = parseCSV(csv);
  console.log(`\n--- Inserting ${rows.length} expenses ---`);

  let inserted = 0;
  let errors = 0;

  for (const row of rows) {
    const approvedBy = row.approved_by && row.approved_by.length === 36 ? row.approved_by : null;

    try {
      await client.query(
        `INSERT INTO expenses (
          company_id, category_id, description, amount, expense_date,
          notes, created_by, status, approved_by, payment_method, vendor_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          row.company_id,
          row.category_id,
          row.description,
          parseFloat(row.amount),
          row.expense_date,
          row.notes || null,
          row.created_by,
          row.status || "approved",
          approvedBy,
          "cash",
          row.description.substring(0, 100),
        ]
      );
      inserted++;
    } catch (err) {
      errors++;
      console.error(`Error: ${err.message} | ${row.description}`);
    }
  }

  const count = await client.query(
    "SELECT COUNT(*) FROM expenses WHERE company_id = $1",
    [rows[0].company_id]
  );
  console.log(`\nInserted: ${inserted}, Errors: ${errors}`);
  console.log(`Total expenses in database: ${count.rows[0].count}`);

  await client.end();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
