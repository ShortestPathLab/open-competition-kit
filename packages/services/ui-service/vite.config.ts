import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { devtools } from "@tanstack/devtools-vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
  plugins: [
    nitro({ traceDeps: ["@open-competition-kit/sdk"] }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    devtools(),
  ],
  build: { rollupOptions: { external: ["bun", "@open-competition-kit/sdk"] } },
  ssr: { external: ["@open-competition-kit/sdk"] },
});

export default config;
