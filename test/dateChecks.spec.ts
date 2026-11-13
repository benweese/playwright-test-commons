import { test } from "@playwright/test";
import dayjs from "dayjs";
import { expectDateBetween, expectSortedByDate, expectValidDate, validateDatesInBody } from "../src/index.js";

// Passing cases only: a failing soft check would fail the test. The failure messages are checked
// in failurePaths.spec.ts, which runs failing checks in a separate Playwright run.

test.describe("expectValidDate", () => {
	test("accepts ISO 8601 by default and a dayjs format when given", () => {
		expectValidDate("2026-01-31T09:30:00Z");
		expectValidDate("31/01/2026", { format: "DD/MM/YYYY", label: "deliveryDate" });
		expectValidDate("2026-01-31 09:30:00", { format: "YYYY-MM-DD HH:mm:ss" });
	});
});

test.describe("expectDateBetween", () => {
	test("is inclusive at both ends and accepts strings, Dates and dayjs objects", () => {
		expectDateBetween("2026-01-01", "2026-01-01", "2026-12-31");
		expectDateBetween("2026-12-31T00:00:00Z", new Date("2026-01-01T00:00:00Z"), dayjs("2026-12-31T00:00:00Z"));
		expectDateBetween("15/06/2026", "2026-01-01", "2026-12-31", { format: "DD/MM/YYYY" });
	});
});

test.describe("expectSortedByDate", () => {
	const items = [{ at: "2026-03-01" }, { at: "2026-02-01" }, { at: "2026-02-01" }, { at: "2026-01-01" }];

	test("accepts newest first by default, with ties", () => {
		expectSortedByDate(items, "at");
	});

	test("accepts oldest first with order asc", () => {
		expectSortedByDate([...items].reverse(), "at", "asc");
	});

	test("accepts a custom format, and empty or single-item lists", () => {
		expectSortedByDate([{ d: "02/01/2026" }, { d: "01/01/2026" }], "d", "desc", { format: "DD/MM/YYYY" });
		expectSortedByDate([], "at");
		expectSortedByDate([{ at: "not even a date" }], "at");
	});
});

test.describe("validateDatesInBody", () => {
	test("passes valid dates in nested objects and arrays, and ignores non-date keys", () => {
		validateDatesInBody({
			createdAt: "2026-01-31T09:30:00Z",
			published_at: "2026-01-31",
			title: "2026-02-30 is not a date, but this key isn't date-like",
			author: { birthDate: "1990-05-17" },
			comments: [{ updatedAt: "2026-02-01T10:00:00+01:00" }, null, 42],
			deletedAt: null
		});
	});

	test("uses custom date keys and format", () => {
		validateDatesInBody(
			{ when: "31/01/2026", createdAt: "not checked: the custom keys replace the defaults" },
			{ dateKeys: /^when$/, format: "DD/MM/YYYY" }
		);
	});

	test("ignores bodies that aren't objects", () => {
		for (const body of [null, undefined, "2026-02-30", 7, true]) {
			validateDatesInBody(body);
		}
	});
});
