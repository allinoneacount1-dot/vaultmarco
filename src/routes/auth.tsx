import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Mail, Shield } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Navbar } from "@/components/marco/Navbar";

const SITE_URL = "https://vaultmarco.lovable.app";
const TITLE = "Sign In · MARCOVAULT | Operator Access";
const DESC =
  "Operator-grade authentication for MARCOVAULT — secure access to the multi-chain command center, AI workflows and alpha signals.";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex,follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${SITE_URL}/auth` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/auth` }],
  }),
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().email("Invalid email").max(200),
  password: z.string().min(8, "Min 8 characters").max(200),
});

const signupSchema = loginSchema.extend({
  handle: z
    .string()
    .trim()
    .min(2, "Min 2 chars")
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, _ or -"),
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = (mode === "login" ? loginSchema : signupSchema).safeParse(fd);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path[0] as string] = i.message;
      setErrors(errs);
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    toast.info(
      "Auth backend not connected yet. Enable Lovable Cloud to wire email + Google sign-in.",
      { duration: 5000 },
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Navbar />
      <div className="absolute inset-0 grid-bg [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute left-1/2 top-1/3 -translate-x-1/2 size-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

      <section className="relative pt-32 pb-20 px-4">
        <div className="mx-auto max-w-md">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-[0.25em] text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="size-3" /> BACK TO VAULT
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass-strong border-glow rounded-3xl p-8 sm:p-10"
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="size-2 rounded-full bg-accent animate-pulse-glow" />
              <span className="text-[10px] font-mono tracking-[0.3em] text-muted-foreground">
                OPERATOR ACCESS
              </span>
            </div>

            <h1 className="text-chrome font-display text-3xl sm:text-4xl font-semibold leading-tight">
              {mode === "login" ? "Re-enter the vault." : "Request operator access."}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {mode === "login"
                ? "Authenticate to access your command center, saved signals and AI workflows."
                : "Create your operator profile to track wallets, save signals and unlock multi-chain tools."}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-1 p-1 glass rounded-xl">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setErrors({});
                  }}
                  className={`py-2 text-[11px] font-mono uppercase tracking-[0.25em] rounded-lg transition-all ${
                    mode === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              {mode === "signup" && (
                <AuthField
                  label="Handle"
                  name="handle"
                  placeholder="vaultoperator"
                  icon={<Shield className="size-3.5" />}
                  error={errors.handle}
                />
              )}
              <AuthField
                label="Email"
                name="email"
                type="email"
                placeholder="operator@vault.io"
                icon={<Mail className="size-3.5" />}
                error={errors.email}
              />
              <AuthField
                label="Password"
                name="password"
                type="password"
                placeholder="••••••••"
                icon={<Lock className="size-3.5" />}
                error={errors.password}
              />

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-3 text-[12px] font-medium uppercase tracking-[0.22em] glow-cyan hover:scale-[1.01] transition-transform disabled:opacity-60"
              >
                {loading ? "Authenticating…" : mode === "login" ? "Enter Vault" : "Request Access"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/5 text-center">
              <p className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">
                SECURE · ENCRYPTED · MULTI-CHAIN READY
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}

function AuthField({
  label,
  name,
  placeholder,
  type = "text",
  icon,
  error,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] font-mono tracking-[0.25em] text-muted-foreground mb-2 uppercase">
        {label}
      </span>
      <div
        className={`flex items-center gap-2 bg-white/[0.03] border rounded-xl px-3.5 transition-all focus-within:ring-1 ${
          error
            ? "border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/40"
            : "border-white/8 focus-within:border-primary/60 focus-within:ring-primary/40"
        }`}
      >
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          className="w-full bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
        />
      </div>
      {error && <span className="mt-1.5 block text-[11px] text-red-400 font-mono">{error}</span>}
    </label>
  );
}
