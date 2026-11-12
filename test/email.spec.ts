import { test, expect } from "@playwright/test";
import { uniqueEmail } from "../src/index.js";

test("uniqueEmail uses the local part and domain, with a plus tag", () => {
	expect(uniqueEmail({ localPart: "playwright", domain: "example.com" })).toMatch(
		/^playwright\+\d{13}\.[0-9a-f]{6}@example\.com$/
	);
});

test('uniqueEmail defaults the local part to "test"', () => {
	expect(uniqueEmail({ domain: "example.com" })).toMatch(/^test\+/);
});

test("uniqueEmail never repeats an address", () => {
	const emails = new Set(Array.from({ length: 1000 }, () => uniqueEmail({ domain: "example.com" })));
	expect(emails.size).toBe(1000);
});
