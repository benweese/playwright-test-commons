/**
 * Date validation.
 *
 * Two ways to use it:
 * 1. Automatically: validateJsonSchema calls validateDatesInBody on every response, which
 *    walks the body and checks every field that looks like a date (by key name).
 * 2. Directly in a test: expectValidDate, expectDateBetween, expectSortedByDate.
 *
 * "Valid" means ISO 8601 by default (2026-01-31, 2026-01-31T09:30:00Z,
 * 2026-01-31T09:30:00.123+01:00). Pass a dayjs format string for anything else,
 * e.g. "YYYY-MM-DD HH:mm:ss" or "DD/MM/YYYY". All soft assertions, so one bad date
 * doesn't stop the rest of the test.
 *
 * @module validateDates
 */

import { expect } from "@playwright/test";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import utc from "dayjs/plugin/utc.js";

dayjs.extend(customParseFormat);
dayjs.extend(utc);

const ISO_8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Keys treated as dates by validateDatesInBody unless overridden. */
const DEFAULT_DATE_KEY = /(At|Date|_at|_date)$|^(date|createdAt|updatedAt|publishedAt|timestamp)$/;

/**
 * @param {unknown} value
 * @returns {boolean} true for a real ISO 8601 date or date-time (rejects 2026-02-30)
 */
export function isIsoDate(value) {
	if (typeof value !== "string" || !ISO_8601.test(value)) {
		return false;
	}
	// The regex checks shape; dayjs strict parsing of the date part catches impossible days.
	return dayjs(value.slice(0, 10), "YYYY-MM-DD", true).isValid() && !Number.isNaN(Date.parse(value));
}

function parse(value, format) {
	return format ? dayjs(value, format, true) : isIsoDate(value) ? dayjs(value) : dayjs("invalid");
}

/**
 * @param {unknown} value
 * @param {object} [options]
 * @param {string} [options.format] - dayjs format; omit for ISO 8601
 * @param {string} [options.label="date"] - shown in the failure message
 */
export function expectValidDate(value, { format, label = "date" } = {}) {
	const ok = typeof value === "string" && parse(value, format).isValid();
	expect.soft(ok, `${label} "${value}" is a valid ${format ?? "ISO 8601"} date`).toBe(true);
}

/**
 * @param {string} value
 * @param {string | Date | dayjs.Dayjs} from - inclusive
 * @param {string | Date | dayjs.Dayjs} to - inclusive
 * @param {object} [options]
 * @param {string} [options.format]
 * @param {string} [options.label="date"]
 *
 * @example
 * // published within the last 7 days
 * expectDateBetween(post.publishedAt, dayjs().subtract(7, "day"), dayjs());
 */
export function expectDateBetween(value, from, to, { format, label = "date" } = {}) {
	const date = parse(value, format);
	const start = dayjs(from);
	const end = dayjs(to);
	const ok = date.isValid() && !date.isBefore(start) && !date.isAfter(end);
	expect.soft(ok, `${label} "${value}" is between ${start.toISOString()} and ${end.toISOString()}`).toBe(true);
}

/**
 * @param {object[]} items
 * @param {string} key - date field on each item
 * @param {"desc" | "asc"} [order="desc"]
 * @param {object} [options]
 * @param {string} [options.format]
 */
export function expectSortedByDate(items, key, order = "desc", { format } = {}) {
	for (let i = 1; i < items.length; i += 1) {
		const previous = parse(items[i - 1][key], format);
		const current = parse(items[i][key], format);
		const ok = order === "desc" ? !current.isAfter(previous) : !current.isBefore(previous);
		expect
			.soft(
				ok,
				`items[${i}].${key} (${items[i][key]}) is ${order === "desc" ? "not after" : "not before"} items[${i - 1}].${key} (${items[i - 1][key]})`
			)
			.toBe(true);
	}
}

/**
 * Walks a response body and checks every date-like field.
 *
 * @param {unknown} body
 * @param {object} [options]
 * @param {RegExp} [options.dateKeys] - which keys are dates (default: ends in At/Date, etc.)
 * @param {string} [options.format] - dayjs format; omit for ISO 8601
 * @param {string} [path] - internal, for failure messages
 */
export function validateDatesInBody(body, { dateKeys = DEFAULT_DATE_KEY, format } = {}, path = "body") {
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
