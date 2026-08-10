import { useState } from "react";
import { z } from "zod";
import { ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(80),
  telegram: z.string().trim().max(60).optional().or(z.literal("")),
  email: z.string().trim().email("Invalid email").max(200),
  topic: z.enum(["partnership", "collab", "press", "other"]),
  message: z.string().trim().min(10, "Message too short").max(1500),
});

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as string] = issue.message;
      }
      setErrors(errs);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setSubmitting(true);

    // Static-safe delivery (no backend): compose the inquiry, copy it, hand off to Telegram.
    const d = parsed.data;
    const composed = [
      `INQUIRY · ${d.topic.toUpperCase()}`,
      `Name: ${d.name}`,
      d.telegram ? `Telegram: ${d.telegram}` : null,
      `Email: ${d.email}`,
      "—",
      d.message,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await navigator.clipboard.writeText(composed);
      toast.success("Inquiry copied — paste it in the Telegram chat that just opened.");
    } catch {
      toast.info("Opening Telegram — paste your inquiry there.");
    }
    window.open("https://t.me/DxmZone", "_blank", "noopener,noreferrer");
    setSubmitting(false);
    (e.target as HTMLFormElement).reset();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-14 glass-strong border-glow rounded-3xl p-6 sm:p-10 grid sm:grid-cols-2 gap-4"
      noValidate
    >
      <Field label="Name" name="name" placeholder="Your name" error={errors.name} />
      <Field label="Telegram" name="telegram" placeholder="@handle" error={errors.telegram} />
      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="you@domain.com"
        className="sm:col-span-2"
        error={errors.email}
      />
      <div className="block sm:col-span-2">
        <label
          htmlFor="field-topic"
          className="block text-[10px] font-mono tracking-[0.25em] text-muted-foreground mb-2 uppercase"
        >
          Topic
        </label>
        <select
          id="field-topic"
          name="topic"
          defaultValue="partnership"
          className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
        >
          <option value="partnership">Partnership</option>
          <option value="collab">Collaboration</option>
          <option value="press">Press / Media</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Field
        label="Message"
        name="message"
        placeholder="Tell us about the collaboration…"
        textarea
        className="sm:col-span-2"
        error={errors.message}
      />
      <div className="sm:col-span-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
        <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">
          SECURE · ENCRYPTED · DIRECT
        </span>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 text-[12px] font-medium uppercase tracking-[0.18em] glow-cyan hover:scale-[1.03] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? "Transmitting…" : "Transmit"} <ArrowUpRight className="size-4" />
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  textarea,
  className = "",
  error,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
  className?: string;
  error?: string;
}) {
  const base =
    "w-full bg-white/[0.03] border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 transition-all";
  const ok = "border-white/8 focus:border-primary/60 focus:ring-primary/40";
  const bad = "border-red-500/50 focus:border-red-500 focus:ring-red-500/40";
  const cls = `${base} ${error ? bad : ok}`;
  const fieldId = `field-${name}`;
  return (
    <div className={`block ${className}`}>
      <label
        htmlFor={fieldId}
        className="block text-[10px] font-mono tracking-[0.25em] text-muted-foreground mb-2 uppercase"
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          id={fieldId}
          name={name}
          rows={4}
          placeholder={placeholder}
          className={cls}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
        />
      ) : (
        <input
          id={fieldId}
          name={name}
          type={type}
          placeholder={placeholder}
          className={cls}
          aria-invalid={!!error}
          aria-describedby={error ? `${fieldId}-error` : undefined}
        />
      )}
      {error && (
        <span id={`${fieldId}-error`} className="mt-1.5 block text-[11px] text-red-400 font-mono">
          {error}
        </span>
      )}
    </div>
  );
}
