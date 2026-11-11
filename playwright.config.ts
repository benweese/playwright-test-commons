import { defineConfig } from "@playwright/test";

/** Unit tests for the framework itself. They run in Node and need no browser. */
export default defineConfig({
	testDir: "./test",
	reporter: process.env.CI ? [["list"], ["github"]] : "list"
});
