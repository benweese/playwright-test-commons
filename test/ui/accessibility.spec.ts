import { test, expect } from "@playwright/test";
import { WCAG_AA_TAGS, expectNoA11yViolations, scanA11y } from "../../src/index.js";

const CLEAN = `<html lang="en"><head><title>Clean</title></head><body><main><h1>Hello</h1>
<img src="logo.png" alt="Company logo"><button>Save</button></main></body></html>`;

const BROKEN = `<html lang="en"><head><title>Broken</title></head><body><main><h1>Hello</h1>
<div id="ads"><img src="ad.png"></div><img id="hero" src="hero.png"></main></body></html>`;

test.describe("accessibility", () => {
	test("WCAG_AA_TAGS covers WCAG 2.0, 2.1 and 2.2 at A and AA", () => {
		expect(WCAG_AA_TAGS).toEqual(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
	});

	test("a clean page has no violations, and expectNoA11yViolations passes", async ({ page }) => {
		await page.setContent(CLEAN);
		expect(await scanA11y(page)).toEqual([]);
		await expectNoA11yViolations(page);
	});

	test("scanA11y reports each violation with its rule, impact, help and targets", async ({ page }) => {
		await page.setContent(BROKEN);
		expect(await scanA11y(page)).toEqual([
			{
				id: "image-alt",
				impact: "critical",
				help: expect.stringContaining("alternative text"),
				targets: ['img[src$="ad.png"]', "#hero"]
			}
		]);
	});

	test("exclude leaves selectors out of the scan", async ({ page }) => {
		await page.setContent(BROKEN);
		const violations = await scanA11y(page, { exclude: ["#ads"] });
		expect(violations.map((v) => v.targets)).toEqual([["#hero"]]);
		await page.setContent(BROKEN);
		await expectNoA11yViolations(page, { exclude: ["#ads", "#hero"] });
	});

	test("tags choose which rules run", async ({ page }) => {
		await page.setContent(BROKEN);
		// image-alt is not a best-practice rule, so a best-practice-only scan doesn't report it.
		const violations = await scanA11y(page, { tags: ["best-practice"] });
		expect(violations.map((v) => v.id)).not.toContain("image-alt");
	});
});
