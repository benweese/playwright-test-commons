import { test, expect } from "@playwright/test";
import { generateTestDescription, formatTestId, TAGS } from "../src/index.js";

test.describe("generateTestDescription", () => {
	test("builds '#0012 | description @tags'", () => {
		expect(generateTestDescription({ id: 12, description: "loads", tags: [TAGS.UI, TAGS.SMOKE] })).toBe(
			"#0012 | loads @ui @smoke"
		);
	});

	test("works without tags", () => {
		expect(generateTestDescription({ id: 1, description: "lists items" })).toBe("#0001 | lists items");
	});

	for (const id of [undefined, null, 0, -3, 1.5, "12", "#0012", "SMOKE-001", NaN]) {
		test(`rejects id ${typeof id === "string" ? JSON.stringify(id) : String(id)}`, () => {
			expect(() => generateTestDescription({ id, description: "x" })).toThrow(/positive whole number/);
		});
	}
});

test.describe("formatTestId", () => {
	test("pads to four digits", () => {
		expect([1, 12, 345, 6789].map(formatTestId)).toEqual(["#0001", "#0012", "#0345", "#6789"]);
	});

	test("keeps ids above 9999 whole", () => {
		expect(formatTestId(12345)).toBe("#12345");
	});
});
