// Validates configuration without starting the server:  npm run check:env
import { configReport } from "../src/lib/env";

const { appEnv, errors, warnings } = configReport();
console.log(`Environment: ${appEnv}`);
for (const w of warnings) console.log(`  warning  ${w}`);
for (const e of errors) console.log(`  ERROR    ${e}`);
if (errors.length && appEnv === "production") {
  console.log("\nProduction config is invalid; the server would refuse to start.");
  process.exit(1);
}
console.log(errors.length ? "\nOK for development (these become errors in production)." : "\nConfiguration OK.");
