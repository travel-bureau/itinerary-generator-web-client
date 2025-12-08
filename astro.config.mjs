import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";

import sentry from "@sentry/astro";
import spotlightjs from "@spotlightjs/astro";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  routes: {
    404: "/404",
  }
});
