import { test, expect } from "@playwright/test";
import { generateTestDescription, TAGS } from "../src/index.js";

test.describe("generateTestDescription", () => {
	test("builds 'ID | description @tags'", () => {
		expect(generateTestDescription({ id: "HOME-001", description: "loads", tags: [TAGS.UI, TAGS.SMOKE] })).toBe(
			"HOME-001 | loads @ui @smoke"
		);
	});

	test("works without tags", () => {
		expect(generateTestDescription({ id: "API-0042", description: "lists items" })).toBe("API-0042 | lists items");
	});

	for (const id of [undefined, "", "home-001", "HOME-1", "HOME001", "1HOME-001"]) {
		test(`rejects id ${JSON.stringify(id)}`, () => {
			expect(() => generateTestDescription({ id, description: "x" })).toThrow(/must look like AREA-001/);
		});
	}
});
