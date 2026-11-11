/**
 * Builds the resolved test configuration from a per-environment settings object.
 *
 * The consuming test repo owns the actual values (URLs, test data) in its own
 * `config/environments.ts`; commons only knows how to pick and merge them. This keeps
 * commons free of site-specific values and free of import-time side effects.
 *
 * Resolution order (later wins):
 *   1. environments[TEST_ENV]          (TEST_ENV defaults to options.defaultEnv)
 *   2. BASE_URL / API_BASE_URL env vars (handy for one-off runs against a preview URL)
 *
 * @module config
 */

/** Settings for one environment. Add any other per-environment values a test repo needs. */
export interface EnvironmentSettings {
	baseUrl: string;
	/** Defaults to baseUrl. */
	apiBaseUrl?: string;
	/** Specs that create or change data skip when true. */
	readOnly?: boolean;
}

export interface CreateConfigOptions {
	/** Environment used when TEST_ENV is not set. Default "local". */
	defaultEnv?: string;
	/** Where to read TEST_ENV, BASE_URL, API_BASE_URL and DEBUG_API from. Default process.env. */
	env?: Record<string, string | undefined>;
}

export type ResolvedConfig<T extends EnvironmentSettings> = T & {
	baseUrl: string;
	apiBaseUrl: string;
	testEnv: string;
	/** Logs every request and response body when true (DEBUG_API=true). */
	debug: boolean;
};

export function createConfig<T extends EnvironmentSettings>(
	environments: Record<string, T>,
	{ defaultEnv = "local", env = process.env }: CreateConfigOptions = {}
): ResolvedConfig<T> {
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
		// Keep off in CI to avoid leaking data into logs.
		debug: env.DEBUG_API === "true"
	};
}
