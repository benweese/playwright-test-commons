import { test, expect } from "@playwright/test";
import { isIsoDate } from "../src/index.js";

test.describe("isIsoDate", () => {
	for (const value of [
		"2026-01-31",
		"2026-01-31T09:30",
		"2026-01-31T09:30:00Z",
		"2026-01-31T09:30:00.123+01:00",
		"2024-02-29T00:00:00Z"
	]) {
		test(`accepts ${value}`, () => {
			expect(isIsoDate(value)).toBe(true);
		});
	}

	for (const value of ["2026-02-30", "2025-02-29", "2026-13-01", "31/01/2026", "2026-1-31", "", null, 20260131]) {
		test(`rejects ${JSON.stringify(value)}`, () => {
			expect(isIsoDate(value)).toBe(false);
		});
	}
});
