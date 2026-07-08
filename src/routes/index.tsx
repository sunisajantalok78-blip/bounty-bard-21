import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Rocket, Sparkles, Radio } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
  head: () => ({
    meta: [
      { title: "Bounty Hunter — Live Lead Intelligence" },
      { name: "description", content: "Real-time lead scraping, contact validation, and AI proposal generation. Powered by Jina AI + Lovable Cloud." },
      { property: "og:title", content: "Bounty Hunter — Live Lead Intelligence" },
      { property: "og:description", content: "Real-time lead scraping, contact validation, and AI proposal generation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8 py-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
          <Radio className="h-3 w-3 animate-pulse" /> Live infrastructure online
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Bounty Hunter
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Real Jina AI web scraping, MX-validated contact extraction, and AI-generated business
          proposals — all synced live to your Lovable Cloud database.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent">
            <Link to="/dashboard">
              <Rocket className="h-4 w-4 mr-2" /> Open Dashboard
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">
              <Sparkles className="h-4 w-4 mr-2" /> Sign in / Sign up
            </Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 pt-8 text-left">
          {[
            { t: "Jina AI Search", d: "Live keyword scraping across web, LinkedIn, Facebook, Instagram." },
            { t: "MX Validation", d: "Real DNS-over-HTTPS checks on every extracted email." },
            { t: "Live Sync", d: "Supabase Realtime pushes status updates instantly to the UI." },
          ].map((c) => (
            <div key={c.t} className="rounded-lg border border-border/60 bg-card/40 p-4">
              <div className="text-sm font-semibold">{c.t}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
