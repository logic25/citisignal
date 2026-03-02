import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const supabaseUrl = env.VITE_SUPABASE_URL || "https://sskfahfhwgnvinzzaacx.supabase.co";
  const supabasePublishableKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNza2ZhaGZod2dudmluenphYWN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1MTY1NzgsImV4cCI6MjA4NjA5MjU3OH0.3E-VuecDMyG6IHGHC24KyhV-vp7tWB0oAD7eNfI2qB0";
  const supabaseProjectId = env.VITE_SUPABASE_PROJECT_ID || "sskfahfhwgnvinzzaacx";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    // Security Fix 28: Disable source maps in production
    build: {
      sourcemap: false,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(supabaseProjectId),
    },
  };
});
