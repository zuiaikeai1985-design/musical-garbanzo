import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", "test-results", "playwright-report", "coverage"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      "prefer-const": "error",
    },
  },
  {
    // The simulation engine must stay free of DOM/React/canvas so it can run headless in Node.
    files: ["src/engine/**/*.ts"],
    languageOptions: {
      globals: {},
    },
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "window", message: "engine/ must stay DOM-free (headless-testable)." },
        { name: "document", message: "engine/ must stay DOM-free (headless-testable)." },
        { name: "navigator", message: "engine/ must stay DOM-free (headless-testable)." },
        { name: "localStorage", message: "engine/ must stay DOM-free (headless-testable)." },
        { name: "requestAnimationFrame", message: "engine/ must stay DOM-free." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the world's seeded RNG instead." },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["react", "react-dom", "**/render/*", "**/ui/*"], message: "engine/ must not depend on the view layer." },
          ],
        },
      ],
    },
  },
);
