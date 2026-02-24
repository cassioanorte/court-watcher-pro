import { Sun, Moon, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useColorMode,
  LIGHT_VARIANT_OPTIONS,
  DARK_VARIANT_OPTIONS,
  type LightVariant,
  type DarkVariant,
} from "@/hooks/useColorMode";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ThemeSelectorProps {
  compact?: boolean;
}

const ThemeSelector = ({ compact }: ThemeSelectorProps) => {
  const { mode, toggle, lightVariant, setVariant, darkVariant, setDarkVariant } = useColorMode();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 p-2 rounded-lg bg-card border text-foreground hover:bg-muted transition-colors text-sm">
          {mode === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          {!compact && (
            <>
              <span className="hidden sm:inline text-xs">
                {mode === "light"
                  ? LIGHT_VARIANT_OPTIONS.find((v) => v.key === lightVariant)?.label
                  : DARK_VARIANT_OPTIONS.find((v) => v.key === darkVariant)?.label}
              </span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={toggle} className="cursor-pointer">
          {mode === "dark" ? (
            <><Sun className="w-4 h-4 mr-2" /> Modo Claro</>
          ) : (
            <><Moon className="w-4 h-4 mr-2" /> Modo Escuro</>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {mode === "light"
          ? LIGHT_VARIANT_OPTIONS.map((v) => (
              <DropdownMenuItem
                key={v.key}
                onClick={() => setVariant(v.key)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", lightVariant === v.key ? "opacity-100" : "opacity-0")} />
                <div>
                  <p className="text-sm font-medium">{v.label}</p>
                  <p className="text-[10px] text-muted-foreground">{v.desc}</p>
                </div>
              </DropdownMenuItem>
            ))
          : DARK_VARIANT_OPTIONS.map((v) => (
              <DropdownMenuItem
                key={v.key}
                onClick={() => setDarkVariant(v.key)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Check className={cn("w-3.5 h-3.5 shrink-0", darkVariant === v.key ? "opacity-100" : "opacity-0")} />
                <div>
                  <p className="text-sm font-medium">{v.label}</p>
                  <p className="text-[10px] text-muted-foreground">{v.desc}</p>
                </div>
              </DropdownMenuItem>
            ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ThemeSelector;
