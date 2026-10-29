// Run the discovery + notification pipeline from the command line / OS scheduler.
//   npm run pipeline            -> only re-analyses pages that changed
//   npm run pipeline -- --force -> re-analyses every source
//   npm run pipeline -- --no-notify
import { runPipeline } from "../src/lib/pipeline/run";

const args = process.argv.slice(2);
const result = await runPipeline({ force: args.includes("--force"), notify: !args.includes("--no-notify") });
console.log(result.log.join("\n"));
console.log(`\nQueued for review: ${result.newForReview} new, ${result.windowsForReview} window changes.`);
