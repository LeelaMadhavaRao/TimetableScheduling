// Compiles the experiment harness together with supabase/functions/_shared into
// .experiments-build/ (Deno-style ".ts" imports are rewritten to ".js" for Node).
import { execSync } from "node:child_process"
import { writeFileSync } from "node:fs"

execSync("npx tsc -p experiments/tsconfig.json", { stdio: "inherit" })
writeFileSync(".experiments-build/package.json", '{ "type": "module" }\n')
