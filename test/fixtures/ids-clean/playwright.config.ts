import { defineConfig } from "@playwright/test";

/** A test repo whose ids are all fine; run by test/checkTestIdsCommand.spec.ts. */
export default defineConfig({
	testDir: ".",
	projects: [
		{ name: "api", grep: /@api/ },
		{ name: "ui", grep: /@ui/ }
	]
});
