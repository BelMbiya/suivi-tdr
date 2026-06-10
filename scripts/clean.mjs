import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const paths = [".next", "coverage"];

for (const path of paths) {
  await rm(path, { recursive: true, force: true });
}

// Next writes panic logs to the OS temp directory. They are safe to remove.
try {
  const tempFiles = await readdir(tmpdir());
  await Promise.all(
    tempFiles
      .filter((file) => file.startsWith("next-panic-") && file.endsWith(".log"))
      .map((file) => rm(join(tmpdir(), file), { force: true })),
  );
} catch {
  // Best effort cleanup only.
}

console.log("Cleaned generated Next.js and test artifacts.");
