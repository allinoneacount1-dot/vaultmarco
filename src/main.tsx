import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Hero } from "./components/marco/Hero";
import { Navbar } from "./components/marco/Navbar";
import { Sections } from "./components/marco/Sections";
import { Particles } from "./components/marco/Particles";
import { ScrollProgress } from "./components/marco/ScrollProgress";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Particles />
        <ScrollProgress />
        <Navbar />
        <main className="relative z-10">
          <Hero />
          <Sections />
        </main>
        <Toaster position="top-right" />
      </div>
      <Analytics />
      <SpeedInsights />
    </QueryClientProvider>
  </StrictMode>
);
