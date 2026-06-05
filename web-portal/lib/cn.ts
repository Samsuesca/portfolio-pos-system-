// Minimal class joiner. Avoids pulling in clsx/tailwind-merge.
// If two conflicting Tailwind utilities pass through, the later one wins per
// Tailwind cascade — acceptable for our primitive override pattern.
export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}
