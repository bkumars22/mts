import { readFileSync } from "node:fs"
import { join } from "node:path"
import { parseInput } from "../../parseInput"

// Reads the CANONICAL fixtures from tests/fixtures/ at the repo root -
// no copy, no duplication, so there is exactly one source of truth for
// what "clean"/"gap"/"low_sample"/"outliers" mean, shared by the Python
// tests and this parity suite.
const FIXTURES_DIR = join(__dirname, "../../../../../tests/fixtures")

export function loadFixture(name: string) {
  const text = readFileSync(join(FIXTURES_DIR, name), "utf-8")
  return parseInput(name, text)
}
