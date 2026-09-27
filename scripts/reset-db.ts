/**
 * Cross-platform database reset: deletes the local SQLite file (and its
 * WAL/SHM sidecar files) and re-seeds. Replaces a plain `rm -f` shell
 * command so this works identically on Windows (VS Code integrated
 * terminal / PowerShell / cmd.exe), macOS, and Linux.
 */
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const files = ["xarena.db", "xarena.db-shm", "xarena.db-wal"];

for (const file of files) {
  const fullPath = path.join(dataDir, file);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath);
    console.log(`Deleted ${path.join("data", file)}`);
  }
}

console.log("Database reset. Run `npm run db:seed` to repopulate it.");
