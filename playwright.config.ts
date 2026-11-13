import { defineConfig } from "@playwright/test";

/**
 * Unit tests for the framework itself. Most run in Node; the BasePage and accessibility tests
 * use Chromium. test/fixtures holds suites that other tests run on purpose, so they are skipped here.
 */
export default defineConfig({
	testDir: "./test",
	testIgnore: "fixtures/**",
	reporter: process.env.CI ? [["list"], ["github"]] : "list"
});
