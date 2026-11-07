/**
 * Builds the resolved test configuration from a per-environment settings object.
 *
 * The consuming test repo owns the actual values (URLs, test data) in its own
 * `config/environments.js`; commons only knows how to pick and merge them. This keeps
 * commons free of site-specific values and free of import-time side effects.
 *
 * Resolution order (later wins):
 *   1. environments[TEST_ENV]          (TEST_ENV defaults to options.defaultEnv)
 *   2. BASE_URL / API_BASE_URL env vars (handy for one-off runs against a preview URL)
 *
 * @module config
 */

/**
 * @param {Record<string, object>} environments - map of env name to settings, e.g. { local: {...}, prod: {...} }
 * @param {object} [options]
 * @param {string} [options.defaultEnv="local"] - environment used when TEST_ENV is not set
 * @param {NodeJS.ProcessEnv} [options.env=process.env]
 * @returns {object} the settings for the selected environment, plus `testEnv` and `debug`
 */
export function createConfig(environments, { defaultEnv = "local", env = process.env } = {}) {
	const testEnv = env.TEST_ENV || defaultEnv;
	const selected = environments[testEnv];
	if (!selected) {
		throw new Error(`Unknown TEST_ENV "${testEnv}". Known environments: ${Object.keys(environments).join(", ")}`);
	}

	return {
		...selected,
		baseUrl: env.BASE_URL || selected.baseUrl,
		apiBaseUrl: env.API_BASE_URL || selected.apiBaseUrl || selected.baseUrl,
		testEnv,
		// Logs every request and response body when set; keep off in CI to avoid leaking data into logs.
		debug: env.DEBUG_API === "true"
	};
}
