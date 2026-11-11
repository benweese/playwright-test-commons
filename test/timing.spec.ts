import { test, expect } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
import { timingCheck } from "../src/index.js";

/** A stand-in response whose timing() reports the given request→first byte and request→last byte times. */
function fakeResponse(firstByte: number, lastByte: number, requestStart = 40): APIResponse<unknown> {
	return {
		timing: () => ({
			startTime: Date.now(),
			domainLookupStart: -1,
			domainLookupEnd: -1,
			connectStart: -1,
			secureConnectionStart: -1,
			connectEnd: -1,
			requestStart,
			responseStart: requestStart + firstByte,
			responseEnd: requestStart + lastByte
		}),
		dispose: async () => {}
	} as unknown as APIResponse<unknown>;
}

function calls(...responses: APIResponse<unknown>[]) {
	let i = 0;
	return async () => responses[i++] as APIResponse<unknown>;
}

test.describe("timingCheck", () => {
	test("averages request sent → last byte, skipping warm-up calls", async () => {
		const result = await timingCheck(
			calls(fakeResponse(900, 950), fakeResponse(90, 100), fakeResponse(190, 200)),
			500,
			{
				runs: 2
			}
		);
		expect(result).toEqual({ averageMs: 150, durations: [100, 200], timeToFirstByte: [90, 190] });
	});

	test("connection setup before requestStart is not counted", async () => {
		const result = await timingCheck(calls(fakeResponse(80, 100, 600)), 500, { runs: 1, warmup: 0 });
		expect(result.durations).toEqual([100]);
	});

	test("fails when the average is over the limit", async () => {
		test.fail(); // expected: 300ms average > 250ms limit
		await timingCheck(calls(fakeResponse(290, 300), fakeResponse(290, 300)), 250, { runs: 2, warmup: 0 });
	});
});
