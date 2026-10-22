import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const WS = (process.env.DSH_WS || "explore") as
  | "explore"
  | "analyze"
  | "decisions"
  | "io"
  | "ontology"
  | "admin";
const entries = {
  explore: {
    entry: "src/dsh-explore-host.tsx",
    name: "DshExplore",
    fileName: "explore.js",
    outDir: "dist/explore",
  },
  analyze: {
    entry: "src/dsh-analyze-host.tsx",
    name: "DshAnalyze",
    fileName: "analyze.js",
    outDir: "dist/analyze",
  },
  decisions: {
    entry: "src/dsh-decisions-host.tsx",
    name: "DshDecisions",
    fileName: "decisions.js",
    outDir: "dist/decisions",
  },
  io: {
    entry: "src/dsh-io-host.tsx",
    name: "DshIo",
    fileName: "io.js",
    outDir: "dist/io",
  },
  ontology: {
    entry: "src/dsh-ontology-host.tsx",
    name: "DshOntology",
    fileName: "ontology.js",
    outDir: "dist/ontology",
  },
  admin: {
    entry: "src/dsh-admin-host.tsx",
    name: "DshAdmin",
    fileName: "admin.js",
    outDir: "dist/admin",
  },
} as const;
const spec = entries[WS];

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  base: `/semantic-os/ws/${WS}/`,
  build: {
    outDir: path.resolve(__dirname, `../${spec.outDir}`),
    emptyOutDir: true,
    target: "esnext",
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, spec.entry),
      name: spec.name,
      formats: ["es"],
      fileName: () => spec.fileName,
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: `${WS}[extname]`,
      },
    },
  },
});
