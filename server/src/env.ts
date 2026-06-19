import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// API_GATEWAY_ENV_PATH lets embedders (e.g. the desktop app, where __dirname sits
// inside a bundle) point at an explicit .env — or at nothing: dotenv silently
// no-ops on a missing file either way.
dotenv.config({
	path:
		process.env.API_GATEWAY_ENV_PATH ?? path.resolve(__dirname, "../../.env"),
});
