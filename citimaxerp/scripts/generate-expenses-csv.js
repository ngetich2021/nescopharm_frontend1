const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// Constants
const COMPANY_ID = "9b267ea3-5970-4160-8b82-afec7599e862";
const ASLI_USER_ID = "a11a9785-b5b9-4d7e-906c-9aa44ce9a57f";
const RECEIPTS_DIR = path.join(__dirname, "..", "Receipts");
const OUTPUT_FILE = path.join(RECEIPTS_DIR, "all-expenses.csv");

// Category UUIDs from the database
const CATEGORIES = {
  SALARIES:     "857e6cc6-2ac8-4cea-9342-c4b7bfad3c6e", // Salaries & Allowances
  FOOD:         "e5213fb5-4d0c-4ff5-b51f-77af154c2651", // Food & Meals
  OFFICE:       "23504f05-f893-4aae-a9f7-d20275cf5b4e", // Office Supplies
  UTILITIES:    "354f3fa8-c64f-4768-b9c5-bee31598dc7d", // Utilities
  TRANSPORT:    "bc3c5576-05c5-49f6-999b-3a0eabc1d752", // Transport & Logistics
  GOVERNMENT:   "0e8f2814-ba6d-478d-aedf-6c6b8135b3c3", // Government & Tax
  EQUIPMENT:    "56f08071-8bf4-434b-bc7c-d27dfc784eee", // Furniture & Equipment
  REPAIRS:      "16a8f5a6-7be2-4aae-81d2-3f3b06adef02", // Repairs & Maintenance
  MARKETING:    "3a4aeac8-94a3-47ad-8d27-94d8dce3e1dd", // Marketing & Branding
  CLEANING:     "d2fd902e-9647-4051-9d68-118af9471304", // Cleaning & Hygiene
};

// Keyword-based category mapping (lowercase keywords -> category UUID)
const CATEGORY_MAP = [
  { id: CATEGORIES.SALARIES, keywords: ["salary", "wage", "payroll", "monthly salary", "allowance", "advance", "loan", "airtime", "mobile allowance", "top up", "petty cash"] },
  { id: CATEGORIES.FOOD, keywords: ["food", "lunch", "tea", "catering", "meals", "breakfast", "snacks", "water refill", "dispenser water", "cook"] },
  { id: CATEGORIES.OFFICE, keywords: ["stationery", "office supplies", "note books", "notebooks", "printing", "lamination", "office requirement", "pens", "files", "tissues", "tape", "paper", "photocopy"] },
  { id: CATEGORIES.UTILITIES, keywords: ["electricity", "water bill", "sewer", "wifi", "internet", "webmail", "domain renewal", "true host"] },
  { id: CATEGORIES.TRANSPORT, keywords: ["transport", "fuel", "uber", "taxi", "fare", "rider", "delivery fee", "delivery", "parcel", "courier", "offloading", "truck"] },
  { id: CATEGORIES.GOVERNMENT, keywords: ["paye", "nssf", "sha", "nhif", "nita", "housing levy", "ahl", "fire certificate", "city council", "permit", "ecitizen", "kra", "kentrade", "kebs", "license", "legal", "audit"] },
  { id: CATEGORIES.EQUIPMENT, keywords: ["printer", "laptop", "phone", "equipment", "ladder", "furniture", "chair", "desk", "locker", "trolley", "cctv", "computer", "gypsum", "pallets", "plywood"] },
  { id: CATEGORIES.REPAIRS, keywords: ["repair", "maintenance", "plumbing", "fundi", "repairing", "fixing", "blinds", "sink", "labour"] },
  { id: CATEGORIES.MARKETING, keywords: ["marketing", "advertising", "branding", "signage", "signboard", "logo", "business card", "social media"] },
  { id: CATEGORIES.CLEANING, keywords: ["cleaning", "detergent", "hygiene", "acid", "napkin"] },
];

// Default fallback category (Utilities as general catch-all)
const DEFAULT_CATEGORY = CATEGORIES.UTILITIES;

function matchCategory(description) {
  const lower = (description || "").toLowerCase();
  for (const cat of CATEGORY_MAP) {
    for (const kw of cat.keywords) {
      if (lower.includes(kw)) return cat.id;
    }
  }
  return DEFAULT_CATEGORY;
}

// Parse date from various formats
function parseDate(value) {
  if (!value && value !== 0) return null;

  // Excel serial number
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, "0");
      const d = String(date.d).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  // String date in DD.MM.YY or DD.MM.YYYY format
  const str = String(value).trim();
  const match = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    let year = match[3];
    if (year.length === 2) {
      year = parseInt(year) >= 50 ? "19" + year : "20" + year;
    }
    return `${year}-${month}-${day}`;
  }

  return null;
}

// Parse amount, handling string values with commas or typos
function parseAmount(value) {
  if (typeof value === "number") return value;
  if (!value) return null;
  const cleaned = String(value).replace(/[,\s]/g, "").replace(/O/g, "0"); // fix O->0 typos
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Escape CSV field
function csvField(val) {
  const str = String(val == null ? "" : val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function parseBookA() {
  const wb = XLSX.readFile(path.join(RECEIPTS_DIR, "RECEIPT BOOK A.xlsx"));
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const rows = [];
  // Data starts at index 2, header at index 1
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const date = parseDate(row[0]);
    const receiptRef = row[1];
    const amount = parseAmount(row[2]);
    const description = String(row[3] || "").trim();

    if (!date || !amount || !description) continue;

    rows.push({
      date,
      notes: `Receipt Book A - ${receiptRef}`,
      amount,
      description,
    });
  }
  return rows;
}

function parseBookB() {
  const wb = XLSX.readFile(path.join(RECEIPTS_DIR, "RECEIPT BOOK B.xlsx"));
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const rows = [];
  // Data starts at index 2 (row 0 is partial header, row 1 is empty)
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const date = parseDate(row[0]);
    const receiptRef = String(row[1] || "").trim();
    const amount = parseAmount(row[2]);
    const description = String(row[3] || "").trim();

    if (!date || !amount || !description) continue;

    const refLabel = receiptRef.toUpperCase().includes("B-REF") ? receiptRef : `Receipt Book B - ${receiptRef}`;
    rows.push({
      date,
      notes: refLabel,
      amount,
      description,
    });
  }
  return rows;
}

function parseBookC() {
  const wb = XLSX.readFile(path.join(RECEIPTS_DIR, "RECEIPT BOOK C.xlsx"));
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const rows = [];
  // Row 0 is header, data starts at index 1
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const date = parseDate(row[0]);
    const receiptRef = String(row[1] || "").trim();
    const amount = parseAmount(row[2]);
    const description = String(row[3] || "").trim();

    if (!date || !amount || !description) continue;

    const refLabel = receiptRef.toUpperCase().includes("C-REF") ? receiptRef : `Receipt Book C - ${receiptRef}`;
    rows.push({
      date,
      notes: refLabel,
      amount,
      description,
    });
  }
  return rows;
}

function parseBookD() {
  const wb = XLSX.readFile(path.join(RECEIPTS_DIR, "RECEIPT BOOK D.xlsx"));
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const rows = [];
  // Row 0 is header, row 1 is empty, data starts at index 2
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const date = parseDate(row[0]);
    const receiptRef = String(row[1] || "").trim();
    const amount = parseAmount(row[2]);
    const description = String(row[3] || "").trim();

    if (!date || !amount || !description) continue;

    const refLabel = receiptRef.toUpperCase().includes("D-REF") || receiptRef.toUpperCase().includes("DREF")
      ? receiptRef
      : `Receipt Book D - ${receiptRef}`;
    rows.push({
      date,
      notes: refLabel,
      amount,
      description,
    });
  }
  return rows;
}

function parseBookE() {
  const wb = XLSX.readFile(path.join(RECEIPTS_DIR, "RECEIPT BOOK E.xlsx"));
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  const rows = [];
  // Row 0 is header, row 1 is empty, data starts at index 2
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    const date = parseDate(row[0]);
    const receiptRef = String(row[1] || "").trim();
    const amount = parseAmount(row[2]);
    const description = String(row[3] || "").trim();

    if (!date || !amount || !description) continue;

    const refLabel = receiptRef.toUpperCase().includes("E-REF") ? receiptRef : `Receipt Book E - ${receiptRef}`;
    rows.push({
      date,
      notes: refLabel,
      amount,
      description,
    });
  }
  return rows;
}

// Main
const allRows = [
  ...parseBookA(),
  ...parseBookB(),
  ...parseBookC(),
  ...parseBookD(),
  ...parseBookE(),
];

// Build CSV
const header = "company_id,category_id,description,amount,expense_date,notes,created_by,created_on,status,approved_by";
const csvLines = [header];

for (const row of allRows) {
  const category = matchCategory(row.description);
  const line = [
    COMPANY_ID,
    csvField(category),
    csvField(row.description),
    row.amount,
    row.date,
    csvField(row.notes),
    ASLI_USER_ID,
    row.date,
    "approved",
    ASLI_USER_ID,
  ].join(",");
  csvLines.push(line);
}

fs.writeFileSync(OUTPUT_FILE, csvLines.join("\n") + "\n");
console.log(`Generated ${allRows.length} expense rows`);
console.log(`Output: ${OUTPUT_FILE}`);

// Print category distribution
const CAT_NAMES = {
  [CATEGORIES.SALARIES]: "Salaries & Allowances",
  [CATEGORIES.FOOD]: "Food & Meals",
  [CATEGORIES.OFFICE]: "Office Supplies",
  [CATEGORIES.UTILITIES]: "Utilities",
  [CATEGORIES.TRANSPORT]: "Transport & Logistics",
  [CATEGORIES.GOVERNMENT]: "Government & Tax",
  [CATEGORIES.EQUIPMENT]: "Furniture & Equipment",
  [CATEGORIES.REPAIRS]: "Repairs & Maintenance",
  [CATEGORIES.MARKETING]: "Marketing & Branding",
  [CATEGORIES.CLEANING]: "Cleaning & Hygiene",
};
const catCounts = {};
for (const row of allRows) {
  const cat = matchCategory(row.description);
  const name = CAT_NAMES[cat] || "Unknown";
  catCounts[name] = (catCounts[name] || 0) + 1;
}
console.log("\nCategory distribution:");
Object.entries(catCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
