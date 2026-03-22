import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

const coreModules = [
  "@mariozechner/pi-coding-agent",
  "@mariozechner/pi-ai",
  "@mariozechner/pi-tui",
  "@sinclair/typebox",
];

export default tseslint.config(
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/no-unresolved": "off",
      "import/no-extraneous-dependencies": "off",
    },
    settings: {
      "import/core-modules": coreModules,
      "import/ignore": [
        "^@mariozechner/",
        "^@sinclair/typebox$",
      ],
    },
  },
  {
    ignores: ["node_modules/", "dist/", ".direnv/"],
  }
);
