import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="flex items-center justify-center size-9 rounded-full glass border border-white/10 hover:bg-white/5 transition-all"
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="size-4 text-muted-foreground hover:text-primary transition-colors" />
      ) : (
        <Moon className="size-4 text-muted-foreground hover:text-primary transition-colors" />
      )}
    </button>
  );
}
