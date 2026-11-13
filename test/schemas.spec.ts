import { test, expect } from "@playwright/test";
import { readFile, rm } from "fs/promises";
import path from "path";
import { createJsonSchema, schemaFilePath, configureSchemas, validateJsonSchema } from "../src/index.js";

const schemasDir = path.resolve(".tmp/schemas");

test.describe.serial("JSON schemas", () => {
	test.beforeAll(async () => {
		await rm(schemasDir, { recursive: true, force: true });
		configureSchemas({ schemasDir });
	});

	test("schemaFilePath refuses names that escape the schemas folder", () => {
		expect(schemaFilePath(schemasDir, "posts/getPost")).toBe(path.join(schemasDir, "posts/getPost.schema.json"));
		expect(schemaFilePath(schemasDir, "a..b/c d")).toBe(path.join(schemasDir, "ab/c_d.schema.json"));
		for (const name of ["../../etc/passwd", "/etc/passwd", "/"]) {
			expect(() => schemaFilePath(schemasDir, name), name).toThrow(/resolves outside/);
		}
	});

	test("createJsonSchema writes a strict schema", async () => {
		await createJsonSchema(schemasDir, "items/item", { id: 1, tags: ["a"], owner: { name: "x" }, deletedAt: null });
		const schema = JSON.parse(await readFile(path.join(schemasDir, "items/item.schema.json"), "utf8"));
		expect(schema.additionalProperties).toBe(false);
		expect(schema.properties.owner.additionalProperties).toBe(false);
		expect(schema.properties.deletedAt.type).toEqual(["null", "string"]);
	});

	test("validateJsonSchema passes a matching body", async () => {
		await validateJsonSchema("items/item", { id: 2, tags: [], owner: { name: "y" }, deletedAt: "2026-01-31" });
	});

	test("update: true regenerates the schema from the body, and the cached validator follows", async () => {
		await validateJsonSchema(
			"items/item",
			{ id: 5, tags: [], owner: { name: "z" }, deletedAt: null, extra: 1 },
			{
				update: true
			}
		);
		const schema = JSON.parse(await readFile(path.join(schemasDir, "items/item.schema.json"), "utf8"));
		expect(Object.keys(schema.properties)).toContain("extra");
		await createJsonSchema(schemasDir, "items/item", { id: 1, tags: ["a"], owner: { name: "x" }, deletedAt: null });
		configureSchemas(); // clears the cache, so the restored schema is read again
	});

	test("dateOptions from configureSchemas apply to every validation; checkDates: false skips them", async () => {
		await createJsonSchema(schemasDir, "events/event", { startDate: "31/01/2026" });
		configureSchemas({ dateOptions: { format: "DD/MM/YYYY" } });
		try {
			await validateJsonSchema("events/event", { startDate: "28/02/2026" });
			configureSchemas({ dateOptions: {} });
			await validateJsonSchema("events/event", { startDate: "28/02/2026" }, { checkDates: false });
		} finally {
			configureSchemas({ dateOptions: {} });
		}
	});

	test("validateJsonSchema fails on an unexpected field", async () => {
		test.fail(); // expected: additionalProperties: false rejects "extra"
		await validateJsonSchema("items/item", { id: 3, tags: [], owner: { name: "z" }, deletedAt: null, extra: true });
	});

	test("validateJsonSchema fails on an impossible date", async () => {
		test.fail(); // expected: the automatic date check rejects Feb 30
		await validateJsonSchema("items/item", { id: 4, tags: [], owner: { name: "z" }, deletedAt: "2026-02-30" });
	});
});
