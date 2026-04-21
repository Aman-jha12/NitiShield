type Props = { level: string };

export default function RiskBadge({ level }: Props) {
  const map: Record<string, { label: string; className: string }> = {
    green: { label: "Lower risk", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
    yellow: { label: "Moderate risk", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
    red: { label: "Higher risk", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  };
  const cfg = map[level] || map.yellow;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
