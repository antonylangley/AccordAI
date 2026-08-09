"use client";

import type { GovernanceEvent } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { RiskBadge } from "./risk-badge";

type EventTableProps = {
  events: GovernanceEvent[];
  compact?: boolean;
  selectedId?: string;
  onSelect?: (event: GovernanceEvent) => void;
};

const th = "px-3 py-2 font-medium";
const td = "px-3 py-3";

export function EventTable({ events, compact = false, selectedId, onSelect }: EventTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-accord-border bg-accord-panel">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-accord-border text-[11px] uppercase tracking-[0.06em] text-accord-muted">
            <tr>
              <th scope="col" className={th}>
                {compact ? "Time" : "Severity"}
              </th>
              <th scope="col" className={th}>
                {compact ? "Department" : "Category"}
              </th>
              <th scope="col" className={th}>
                {compact ? "Provider" : "Department"}
              </th>
              {!compact ? (
                <>
                  <th scope="col" className={th}>
                    User
                  </th>
                  <th scope="col" className={th}>
                    Provider
                  </th>
                </>
              ) : null}
              <th scope="col" className={th}>
                {compact ? "Risk" : "Action taken"}
              </th>
              <th scope="col" className={th}>
                {compact ? "Action" : "Time"}
              </th>
              <th scope="col" className={th}>
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-accord-border/60">
            {!events.length ? (
              <tr>
                <td colSpan={compact ? 6 : 8} className="px-3 py-8 text-center text-[13px] text-accord-muted">
                  No live governance events yet.
                </td>
              </tr>
            ) : null}
            {events.map((event) => {
              const rowContent = compact ? (
                <>
                  <td className={cn(td, "font-mono text-xs text-accord-muted [font-variant-numeric:tabular-nums]")}>{event.time}</td>
                  <td className={cn(td, "font-medium text-accord-text")}>{event.department}</td>
                  <td className={cn(td, "text-accord-muted")}>{event.provider}</td>
                  <td className={td}>
                    <RiskBadge level={event.severity} />
                  </td>
                  <td className={cn(td, "text-accord-muted")}>{event.actionTaken}</td>
                  <td className={cn(td, "text-accord-muted")}>{event.status}</td>
                </>
              ) : (
                <>
                  <td className={td}>
                    <RiskBadge level={event.severity} />
                  </td>
                  <td className={cn(td, "font-medium text-accord-text")}>{event.category}</td>
                  <td className={cn(td, "text-accord-muted")}>{event.department}</td>
                  <td className={cn(td, "text-accord-muted")}>{event.user}</td>
                  <td className={cn(td, "text-accord-muted")}>{event.provider}</td>
                  <td className={cn(td, "text-accord-muted")}>{event.actionTaken}</td>
                  <td className={cn(td, "font-mono text-xs text-accord-muted [font-variant-numeric:tabular-nums]")}>{event.time}</td>
                  <td className={cn(td, "text-accord-muted")}>{event.status}</td>
                </>
              );

              if (!onSelect) {
                return <tr key={event.id}>{rowContent}</tr>;
              }

              return (
                <tr
                  key={event.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accord-surface/70",
                    selectedId === event.id ? "bg-accord-surface" : "bg-accord-panel"
                  )}
                  onClick={() => onSelect(event)}
                >
                  {rowContent}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
