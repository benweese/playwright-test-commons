/**
 * Date validation. `validateJsonSchema` runs {@link validateDatesInBody} on every response, so
 * date fields are checked automatically. Tests can also call {@link expectValidDate},
 * {@link expectDateBetween} and {@link expectSortedByDate} directly.
 *
 * "Valid" means ISO 8601 by default (2026-01-31, 2026-01-31T09:30:00Z,
 * 2026-01-31T09:30:00.123+01:00). Pass a dayjs format for anything else, e.g.
 * "YYYY-MM-DD HH:mm:ss" or "DD/MM/YYYY". Every check is a soft assertion, so one bad date
 * doesn't stop the rest of the test.
 *
 * @module validateDates
 */

import { expect } from "@playwright/test";
import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(customParseFormat);
dayjs.extend(utc);

/** A date to compare against: an ISO string, a `Date` or a dayjs object. */
export type DateInput = string | Date | Dayjs;

/** Settings for {@link validateDatesInBody}. */
export interface DateOptions {
	/** Which keys hold dates. Default: keys ending in `At`, `Date`, `_at` or `_date`, or named `date` or `timestamp`. */
	dateKeys?: RegExp;
	/** dayjs format the dates use. Default: ISO 8601. */
	format?: string;
}

/** Settings for {@link expectValidDate} and {@link expectDateBetween}. */
export interface DateCheckOptions {
	/** dayjs format the value uses. Default: ISO 8601. */
	format?: string;
	/** Names the value in the failure message. Default `"date"`. */
	label?: string;
}

const ISO_8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const DEFAULT_DATE_KEY = /(At|Date|_at|_date)$|^(date|createdAt|updatedAt|publishedAt|timestamp)$/;

/**
 * Checks for a real ISO 8601 date or date-time. The shape must match and the day must exist,
 * so `"2026-02-30"` is rejected.
 *
 * @param value - anything
 * @returns true if `value` is a string holding a valid ISO 8601 date
 */
export function isIsoDate(value: unknown): value is string {
	if (typeof value !== "string" || !ISO_8601.test(value)) {
		return false;
	}
	// The regex only checks the shape; strict parsing of the date part rejects impossible days.
	return dayjs(value.slice(0, 10), "YYYY-MM-DD", true).isValid() && !Number.isNaN(Date.parse(value));
}

/** Parses a value strictly: with `format` if given, otherwise as ISO 8601. Anything else is an invalid date. */
function parse(value: unknown, format?: string): Dayjs {
	if (typeof value !== "string") {
		return dayjs("invalid");
	}
	return format ? dayjs(value, format, true) : isIsoDate(value) ? dayjs(value) : dayjs("invalid");
}

/**
 * Asserts (soft) that a value is a valid date.
 *
 * @param value - the value to check
 * @param options - see {@link DateCheckOptions}
 *
 * @example
 * expectValidDate(order.deliveryDate, { format: "DD/MM/YYYY", label: "deliveryDate" });
 */
export function expectValidDate(value: unknown, { format, label = "date" }: DateCheckOptions = {}): void {
	const ok = parse(value, format).isValid();
	expect.soft(ok, `${label} "${String(value)}" is a valid ${format ?? "ISO 8601"} date`).toBe(true);
}

/**
 * Asserts (soft) that a value is a valid date between two others, inclusive.
 *
 * @param value - the value to check
 * @param from - earliest allowed date
 * @param to - latest allowed date
 * @param options - see {@link DateCheckOptions}
 *
 * @example
 * // published within the last 7 days
 * expectDateBetween(post.publishedAt, dayjs().subtract(7, "day"), dayjs());
 */
export function expectDateBetween(
	value: unknown,
	from: DateInput,
	to: DateInput,
	{ format, label = "date" }: DateCheckOptions = {}
): void {
	const date = parse(value, format);
	const start = dayjs(from);
	const end = dayjs(to);
	const ok = date.isValid() && !date.isBefore(start) && !date.isAfter(end);
	expect
		.soft(ok, `${label} "${String(value)}" is between ${start.toISOString()} and ${end.toISOString()}`)
		.toBe(true);
}

/**
 * Asserts (soft) that items are ordered by a date field. Reports every out-of-order pair.
 *
 * @param items - the items, in the order received
 * @param key - the date field on each item
 * @param order - `"desc"` (newest first) or `"asc"`. Default `"desc"`
 * @param options - how the dates are written
 * @param options.format - dayjs format of the dates. Default: ISO 8601
 *
 * @example
 * expectSortedByDate(body.items, "publishedAt", "desc");
 */
export function expectSortedByDate(
	items: readonly Record<string, unknown>[],
	key: string,
	order: "desc" | "asc" = "desc",
	{ format }: { format?: string } = {}
): void {
	for (let i = 1; i < items.length; i += 1) {
		const before = items[i - 1]?.[key];
		const after = items[i]?.[key];
		const previous = parse(before, format);
		const current = parse(after, format);
		const ok = order === "desc" ? !current.isAfter(previous) : !current.isBefore(previous);
		expect
			.soft(
				ok,
				`items[${i}].${key} (${String(after)}) is ${order === "desc" ? "not after" : "not before"} items[${i - 1}].${key} (${String(before)})`
			)
			.toBe(true);
	}
}

/**
 * Walks a response body and asserts (soft) that every date-like field holds a valid date.
 * Called by `validateJsonSchema` on every validation.
 *
 * @param body - the parsed response body
 * @param options - see {@link DateOptions}
 * @param path - where `body` sits in the response, for failure messages. Default `"body"`
 */
export function validateDatesInBody(
	body: unknown,
	{ dateKeys = DEFAULT_DATE_KEY, format }: DateOptions = {},
	path = "body"
): void {
	if (Array.isArray(body)) {
		body.forEach((item, i) => validateDatesInBody(item, { dateKeys, format }, `${path}[${i}]`));
		return;
	}
	if (!body || typeof body !== "object") {
		return;
	}
	for (const [key, value] of Object.entries(body)) {
		const fieldPath = `${path}.${key}`;
		if (typeof value === "string" && dateKeys.test(key)) {
			expectValidDate(value, { format, label: fieldPath });
		} else if (value && typeof value === "object") {
			validateDatesInBody(value, { dateKeys, format }, fieldPath);
		}
	}
}
