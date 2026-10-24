export const rupees = (n: number | null | undefined) =>
  `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return '';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// Same idea as humanizeStatus() in components/ui/StatusBadge.tsx.
export const humanize = (v: string | null | undefined) =>
  (v ?? '').replace(/[_-]+/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase());

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad';
export function toneFor(status: string | null | undefined): Tone {
  const s = (status ?? '').toLowerCase();
  if (['completed', 'accepted', 'approved', 'released'].includes(s)) return 'ok';
  if (['disputed', 'rejected', 'cancelled', 'refunded'].includes(s)) return 'bad';
  if (['pending', 'delivered', 'assigned', 'in_progress', 'held', 'escrow_funded'].includes(s)) return 'warn';
  return 'neutral';
}
