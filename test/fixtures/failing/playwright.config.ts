import { defineConfig } from "@playwright/test";

/**
 * Checks that are meant to fail. Not part of the normal run (the root config ignores
 * test/fixtures); test/failurePaths.spec.ts runs this config and asserts on each failure's message.
 */
export default defineConfig({
	testDir: ".",
	retries: 0,
	workers: 1,
	timeout: 15_000,
	expect: { timeout: 1_000 },
	reporter: "json"
});
