import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Rocket } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign In — Bounty Hunter" },
      { name: "description", content: "Sign in or create your Bounty Hunter account." },
    ],
  }),
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: "/dashboard" });
    });
  }, [nav]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        // fire-and-forget n8n notification
        try {
          await fetch("/api/public/user-events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "user.signup", email }),
          });
        } catch {}
        toast.success("Account created — signing you in…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
      nav({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/80 backdrop-blur p-8 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-primary">
            <Rocket className="h-5 w-5" />
            <span className="font-semibold tracking-tight">Bounty Hunter</span>
          </div>
          <h1 className="text-2xl font-bold">
            {mode === "signin" ? "Sign in to your room" : "Create your room"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Access your personal lead pipeline and admin tools."
              : "Spin up a private workspace in seconds."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-gradient-to-r from-primary to-accent">
            {busy ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          {mode === "signin" ? (
            <>New here?{" "}
              <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </>
          ) : (
            <>Already have one?{" "}
              <button className="text-primary hover:underline" onClick={() => setMode("signin")}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="text-center">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back home</Link>
        </div>
      </div>
    </main>
  );
}
