import { cn } from "@/lib/utils";

export const CapIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
  >
    <path d="M12 4 2.5 9 12 14l9.5-5Z" />
    <path d="M6.5 11.4V16c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.6" />
  </svg>
);

interface LogoProps {
  inverted?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Logo = ({ inverted = false, className, size = "md" }: LogoProps) => (
  <span className={cn("inline-flex items-center gap-3 select-none", className)}>
    <span
      className={cn(
        "grid place-items-center rounded-2xl bg-[#ECEAF9] text-[#332E86] shadow-sm shrink-0",
        size === "lg" ? "h-12 w-12 rounded-2xl" : size === "sm" ? "h-8 w-8 rounded-xl" : "h-10 w-10 rounded-[14px]"
      )}
    >
      <CapIcon className={size === "lg" ? "h-7 w-7" : size === "sm" ? "h-5 w-5" : "h-6 w-6"} />
    </span>
    <span className={cn("font-display font-bold tracking-tight", size === "lg" ? "text-2xl" : "text-xl")}>
      <span className={inverted ? "text-white" : "text-[#14162B]"}>edU</span>
      <span className={inverted ? "text-[#8D7FE3]" : "text-[#332E86]"}>loc</span>
    </span>
  </span>
);
