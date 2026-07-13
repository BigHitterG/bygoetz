type FutureAdSlotProps = {
  label?: string;
};

export function FutureAdSlot({ label }: FutureAdSlotProps) {
  if (!label) return null;

  return (
    <aside className="cg-ad-slot" aria-label="Sponsored message">
      {label}
    </aside>
  );
}

