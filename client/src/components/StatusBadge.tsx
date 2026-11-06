import type { ItemStatus } from '../api/items';

// Item status badge (system SDS section 3): color AND text, never color alone.
const STYLES: Record<ItemStatus, { label: string; className: string }> = {
  AVAILABLE: { label: 'Available', className: 'text-bg-success' },
  RESERVED: { label: 'Reserved', className: 'text-bg-warning' },
  ON_LOAN: { label: 'On Loan', className: 'text-bg-primary' },
  MAINTENANCE: { label: 'Maintenance', className: 'text-bg-secondary' },
};

export const statusLabel = (status: ItemStatus) => STYLES[status]?.label ?? status;

export default function StatusBadge({ status }: { status: ItemStatus }) {
  const style = STYLES[status] ?? { label: status, className: 'text-bg-dark' };
  return <span className={`badge status-badge ${style.className}`}>{style.label}</span>;
}
