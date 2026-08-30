import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Salat Laval" },
      {
        name: "description",
        content:
          "Connecte-toi avec Google ou par e-mail pour sauvegarder tes prières et tes statistiques hebdomadaires.",
      },
      { property: "og:title", content: "Connexion — Salat Laval" },
      {
        property: "og:description",
        content: "Sauvegarde tes prières et statistiques en te connectant à ton compte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const google = async () => {
    setMsg(null);
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setMsg("Connexion Google impossible. Réessaie.");
      setLoading(false);
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      setMsg(
        error ? error.message : "Vérifie ta boîte mail pour confirmer ton compte.",
      );
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setMsg(error.message);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-sm">
        <header className="text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Laval · Québec</p>
          <h1 className="mt-3 font-serif text-3xl font-semibold">Mes cinq prières</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connecte-toi pour sauvegarder tes prières et tes statistiques.
          </p>
        </header>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 shadow-lg">
          <button
            onClick={google}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-accent px-5 py-3 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            Continuer avec Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Adresse e-mail"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full border border-accent/50 px-5 py-3 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-60"
            >
              {mode === "signin" ? "Se connecter" : "Créer un compte"}
            </button>
          </form>

          {msg && <p className="mt-4 text-center text-xs text-muted-foreground">{msg}</p>}

          <button
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMsg(null);
            }}
            className="mt-5 w-full text-center text-xs text-muted-foreground underline"
          >
            {mode === "signin"
              ? "Pas encore de compte ? Créer un compte"
              : "J'ai déjà un compte — se connecter"}
          </button>
        </div>
      </div>
    </main>
  );
}
