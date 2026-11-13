import { defineConfig } from "@playwright/test";

/** A test repo with every id problem check-test-ids reports; run by test/checkTestIdsCommand.spec.ts. */
export default defineConfig({
	testDir: ".",
	projects: [{ name: "api", grep: /@api/ }]
});
