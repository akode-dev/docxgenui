import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const typedFiles = ["**/*.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
      "src-tauri/target",
      "src-tauri/binaries",
      "artifacts",
      "eslint.config.js",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((configuration) => ({
    ...configuration,
    files: typedFiles,
  })),
  {
    files: typedFiles,
    languageOptions: {
      ecmaVersion: 2023,
      globals: {
        ...globals.browser,
        ...globals.es2023,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          "checksVoidReturn": {
            "attributes": false
          }
        }
      ]
    },
  },
);
