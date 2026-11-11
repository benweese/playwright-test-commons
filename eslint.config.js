// ESLint's own config stays JavaScript: loading a .ts config needs an extra runtime loader.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
	{ ignores: ["**/node_modules/**", "dist/**", "**/test-results/**", "**/playwright-report/**", ".tmp/**"] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: { ...globals.node }
		},
		rules: {
			"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
			"@typescript-eslint/consistent-type-imports": "error",
			"prefer-const": "error",
			"no-var": "error",
			eqeqeq: ["error", "always"]
		}
	},
	prettier
);
