import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";

const NEXT: Record<Theme, Theme> = {
  light: "dark",
  dark: "system",
  system: "light",
};
const LABEL: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, mounted } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => setTheme(NEXT[theme])}
      // Until mounted, the stored theme is unknown; announce nothing misleading.
      aria-label={mounted ? `Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.` : "Theme"}
      title={mounted ? `Theme: ${LABEL[theme]}` : undefined}
    >
      {mounted ? <Icon className="size-4" aria-hidden /> : <span className="size-4" />}
      <span className="sr-only sm:not-sr-only sm:ml-1.5 sm:text-xs">
        {mounted ? LABEL[theme] : ""}
      </span>
    </Button>
  );
}
