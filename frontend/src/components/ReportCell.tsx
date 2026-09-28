import type { ReactNode } from "react";

/** Visible labels keep the same evidence readable when table rows stack. */
export default function ReportCell({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <td role="cell" className={className}>
    <span className="report-cell-label" aria-hidden="true">{label}</span>
    <div className="report-cell-content">{children}</div>
  </td>;
}
