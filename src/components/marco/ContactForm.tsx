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
      className="hairline grid gap-x-8 gap-y-7 bg-(--graphite) p-7 sm:grid-cols-2 md:p-10"
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
          className="mono-label mb-2 block"
        >
          Topic
        </label>
        <select
          id="field-topic"
          name="topic"
          defaultValue="partnership"
          className="hairline-b w-full border-0 bg-transparent px-0 py-3 text-sm text-(--bone) focus:border-(--gold) focus:outline-none [&>option]:bg-(--graphite)"
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
        <span className="mono-label">
          DELIVERED VIA TELEGRAM · NO SERVERS
        </span>
        <button
          type="submit"
          disabled={submitting}
          className="chrome-fill inline-flex items-center gap-2 px-7 py-3.5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] transition-[filter] duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
    "w-full border-0 border-b bg-transparent px-0 py-3 text-sm text-(--bone) placeholder:text-(--faint) focus:outline-none transition-colors duration-300";
  const ok = "border-(--hairline-strong) focus:border-(--gold)";
  const bad = "border-(--down) focus:border-(--down)";
  const cls = `${base} ${error ? bad : ok}`;
  const fieldId = `field-${name}`;
  return (
    <div className={`block ${className}`}>
      <label
        htmlFor={fieldId}
        className="mono-label mb-2 block"
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
        <span id={`${fieldId}-error`} className="mono-data mt-1.5 block text-[11px] text-(--down)">
          {error}
        </span>
      )}
    </div>
  );
}
