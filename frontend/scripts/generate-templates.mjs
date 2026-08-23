// One-off generator for the downloadable input templates (CSV/JSON/XLSX)
// offered on the upload screen. Run with `node scripts/generate-templates.mjs`
// whenever the template content needs to change - the three output files
// are committed to public/templates/ as static assets, not generated at
// runtime, so the browser bundle doesn't need to ship a full XLSX writer.
import * as fs from "node:fs"
import { fileURLToPath } from "node:url"
import * as XLSX from "xlsx"

XLSX.set_fs(fs)

const rows = [
  { timestamp: "2026-01-01T00:00:00", metric_name: "example_metric", value: 95.2, sample_size: 200 },
  { timestamp: "2026-01-01T01:00:00", metric_name: "example_metric", value: 94.8, sample_size: 198 },
  { timestamp: "2026-01-01T02:00:00", metric_name: "example_metric", value: 95.5, sample_size: 205 },
]

const outDir = fileURLToPath(new URL("../public/templates/", import.meta.url))

const worksheet = XLSX.utils.json_to_sheet(rows)
const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, worksheet, "metrics")
XLSX.writeFile(workbook, outDir + "template.xlsx")

fs.writeFileSync(outDir + "template.csv", XLSX.utils.sheet_to_csv(worksheet))
fs.writeFileSync(outDir + "template.json", JSON.stringify(rows, null, 2))

console.log("Generated template.csv, template.json, template.xlsx in", outDir)
