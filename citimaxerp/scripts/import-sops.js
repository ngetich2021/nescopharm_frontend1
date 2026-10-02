const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { randomUUID } = require("crypto");

// --- Config ---
const COMPANY_ID = "9b267ea3-5970-4160-8b82-afec7599e862";
const CREATED_BY = "a11a9785-b5b9-4d7e-906c-9aa44ce9a57f"; // asli osman
const YEAR = 2026;
const SOP_DIR = path.join(__dirname, "..", "docs", "SOP");

const DB = {
  host: "ep-cool-credit-a2yz2gw3.aws-eu-central-1.pg.laravel.cloud",
  port: 5432,
  database: "main",
  user: "laravel",
  password: "npg_UaBCPjwn8ph1",
  ssl: { rejectUnauthorized: false },
};

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://367be3a2035528943240074d0096e0cd.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "e9cda6d0460f2b6c34d127ea98eab44a",
    secretAccessKey: "8bc17876139012ee87f9aa08b6dd823383a8f6d52acc5cc5840f53b62cae07e4",
  },
});
const BUCKET = "fls-a0ea6963-33a8-4ecd-b492-0b3d24c327fe";

// SOP number + title map derived from the tabulation spreadsheet
// filename keyword -> { sop_number, title }
const SOP_MAP = [
  { keywords: ["change control"],                          sop_number: "NSPL/SOP/QA/027", title: "Change Control" },
  { keywords: ["cleaning", "housekeeping"],                sop_number: "NSPL/SOP/WH/012", title: "Cleaning and Housekeeping" },
  { keywords: ["complaints"],                              sop_number: "NSPL/SOP/QA/026", title: "Complaints Handling" },
  { keywords: ["deviation", "incident"],                   sop_number: "NSPL/SOP/QA/006", title: "Deviation and Incident Management" },
  { keywords: ["document", "record control"],              sop_number: "NSPL/SOP/QA/003", title: "Document and Record Control" },
  { keywords: ["management review"],                       sop_number: "NSPL/SOP/QA/009", title: "Management Review" },
  { keywords: ["organization", "responsible person"],      sop_number: "NSPL/SOP/QA/002", title: "Organization, Responsibilities and Appointment of Responsible Person" },
  { keywords: ["outsourced storage", "distribution services"], sop_number: "NSPL/SOP/QA/031", title: "Management of Outsourced Storage and Distribution Services" },
  { keywords: ["pest control"],                            sop_number: "NSPL/SOP/WH/013", title: "Pest Control Management" },
  { keywords: ["premises maintenance"],                    sop_number: "NSPL/SOP/WH/011", title: "Premises Maintenance" },
  { keywords: ["product recall", "mock recall"],           sop_number: "NSPL/SOP/QA/028", title: "Product Recall and Mock Recall" },
  { keywords: ["quality manual"],                          sop_number: "NSPL/QM/GSDP/001", title: "Quality Manual" },
  { keywords: ["quality policy", "quality objectives"],    sop_number: "NSPL/SOP/QA/001", title: "Quality Policy and Quality Objectives" },
  { keywords: ["quality risk", "qrm"],                     sop_number: "NSPL/SOP/QA/009B", title: "Quality Risk Management (QRM)" },
  { keywords: ["returns management"],                      sop_number: "NSPL/SOP/QA/029", title: "Returns Management" },
  { keywords: ["self-inspection", "internal audit"],       sop_number: "NSPL/SOP/QA/010", title: "Self-Inspection / Internal Audit" },
  { keywords: ["stock control", "inventory management"],   sop_number: "NSPL/SOP/WH/018", title: "Stock Control and Inventory Management" },
  { keywords: ["storage and handling"],                    sop_number: "NSPL/SOP/WH/017", title: "Storage and Handling of Medicinal Products" },
  { keywords: ["substandard", "falsified"],                sop_number: "NSPL/SOP/QA/030", title: "Management of Substandard and Falsified Products (SFP)" },
  { keywords: ["temperature", "humidity"],                 sop_number: "NSPL/SOP/WH/015", title: "Temperature and Humidity Mapping" },
  { keywords: ["transport", "distribution control"],       sop_number: "NSPL/SOP/WH/032", title: "Transport and Distribution Control" },
];

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function matchSop(filename) {
  const lower = filename.toLowerCase();
  for (const entry of SOP_MAP) {
    if (entry.keywords.every((kw) => lower.includes(kw))) {
      return entry;
    }
  }
  // partial match — at least one keyword
  for (const entry of SOP_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry;
    }
  }
  return null;
}

function mimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === ".doc")  return "application/msword";
  if (ext === ".pdf")  return "application/pdf";
  return "application/octet-stream";
}

async function upload(localPath, s3Key, mime) {
  // Check if already exists
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: s3Key }));
    console.log(`  ↳ Already on R2, skipping upload`);
    return;
  } catch (_) {}

  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    Body: body,
    ContentType: mime,
  }));
}

async function main() {
  const client = new Client(DB);
  await client.connect();
  console.log("Connected to database\n");

  const files = fs.readdirSync(SOP_DIR).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return [".docx", ".doc", ".pdf"].includes(ext);
  });

  // Deduplicate: if two files match the same SOP number, prefer the one with "Final" in name
  const seen = new Map(); // sop_number -> filename
  for (const f of files) {
    const match = matchSop(f);
    if (!match) continue;
    const existing = seen.get(match.sop_number);
    if (!existing || f.toLowerCase().includes("final")) {
      seen.set(match.sop_number, f);
    }
  }

  // Handle unmatched files
  const unmatched = files.filter((f) => !matchSop(f));
  if (unmatched.length) {
    console.log("⚠️  No SOP mapping found for:");
    unmatched.forEach((f) => console.log("   -", f));
    console.log();
  }

  let inserted = 0, skipped = 0, errors = 0;

  for (const [sop_number, filename] of seen.entries()) {
    const match = matchSop(filename);
    const localPath = path.join(SOP_DIR, filename);
    const stats = fs.statSync(localPath);
    const uuid = randomUUID();
    const slug = slugify(match.title);
    const ext = path.extname(filename);
    const s3Key = `sops/${COMPANY_ID}/${YEAR}/${uuid}-${slug}${ext}`;
    const mime = mimeType(filename);

    console.log(`[${sop_number}] ${match.title}`);
    console.log(`  File: ${filename}`);

    try {
      // Upload to R2
      process.stdout.write(`  Uploading to R2...`);
      await upload(localPath, s3Key, mime);
      console.log(` done`);

      // Insert into DB
      await client.query(
        `INSERT INTO sops (id, company_id, sop_number, title, year, status, document_path, original_file_name, mime_type, file_size, storage_disk, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,'s3',$10,NOW(),NOW())
         ON CONFLICT (company_id, sop_number, year) DO UPDATE
           SET title = EXCLUDED.title,
               document_path = EXCLUDED.document_path,
               original_file_name = EXCLUDED.original_file_name,
               file_size = EXCLUDED.file_size,
               updated_at = NOW()`,
        [uuid, COMPANY_ID, sop_number, match.title, YEAR, s3Key, filename, mime, stats.size, CREATED_BY]
      );
      console.log(`  ✓ Saved to database\n`);
      inserted++;
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}\n`);
      errors++;
    }
  }

  console.log(`\n=== Done: ${inserted} inserted/updated, ${skipped} skipped, ${errors} errors ===`);
  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
