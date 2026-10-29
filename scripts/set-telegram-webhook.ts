// Registers <APP_BASE_URL>/api/telegram/webhook with Telegram.
import { setTelegramWebhook } from "../src/lib/channels/telegram";
import { env } from "../src/lib/env";

const cfg = env();
if (!cfg.telegram.token || cfg.baseUrl.startsWith("http://localhost")) {
  console.error("Set TELEGRAM_BOT_TOKEN and a public https APP_BASE_URL first.");
  process.exit(1);
}
console.log(`[${cfg.appEnv}] registering ${cfg.baseUrl}/api/telegram/webhook`);
console.log(await setTelegramWebhook(cfg.baseUrl));
