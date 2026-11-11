import { test, expect } from "@playwright/test";
import { createConfig } from "../src/index.js";

const environments = {
	local: { baseUrl: "http://localhost:3000" },
	prod: { baseUrl: "https://example.com", apiBaseUrl: "https://api.example.com", readOnly: true }
};

test.describe("createConfig", () => {
	test("uses defaultEnv when TEST_ENV is unset", () => {
		const config = createConfig(environments, { defaultEnv: "prod", env: {} });
		expect(config).toMatchObject({ testEnv: "prod", baseUrl: "https://example.com", readOnly: true });
	});

	test("TEST_ENV wins over defaultEnv, and apiBaseUrl falls back to baseUrl", () => {
		const config = createConfig(environments, { defaultEnv: "prod", env: { TEST_ENV: "local" } });
		expect(config).toMatchObject({ testEnv: "local", apiBaseUrl: "http://localhost:3000" });
	});

	test("BASE_URL and API_BASE_URL override the environment", () => {
		const config = createConfig(environments, {
			env: { TEST_ENV: "prod", BASE_URL: "https://preview.example", API_BASE_URL: "https://preview.example/api" }
		});
		expect(config).toMatchObject({ baseUrl: "https://preview.example", apiBaseUrl: "https://preview.example/api" });
	});

	test("unknown TEST_ENV lists the known ones", () => {
		expect(() => createConfig(environments, { env: { TEST_ENV: "qa" } })).toThrow(
			/Known environments: local, prod/
		);
	});
});
