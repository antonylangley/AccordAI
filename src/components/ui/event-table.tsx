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

const headClass =
  "px-4 py-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.12em] text-accord-muted";

export function EventTable({ events, compact = false, selectedId, onSelect }: EventTableProps) {
  return (
    <div className="accord-surface overflow-hidden rounded-md">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-accord-border bg-accord-mist/60">
            <tr>
              <th scope="col" className={headClass}>
                {compact ? "Time" : "Severity"}
              </th>
              <th scope="col" className={headClass}>
                {compact ? "Department" : "Category"}
              </th>
              <th scope="col" className={headClass}>
                {compact ? "Provider" : "Department"}
              </th>
              {!compact ? (
                <>
                  <th scope="col" className={headClass}>
                    User
                  </th>
                  <th scope="col" className={headClass}>
                    Provider
                  </th>
                </>
              ) : null}
              <th scope="col" className={headClass}>
                {compact ? "Risk" : "Action taken"}
              </th>
              <th scope="col" className={headClass}>
                {compact ? "Action" : "Time"}
              </th>
              <th scope="col" className={cn(headClass, "text-right")}>
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-accord-hairline">
            {events.map((event) => {
              const rowContent = compact ? (
                <>
                  <td className="tnum px-4 py-3 font-mono text-[13px] text-accord-muted">{event.time}</td>
                  <td className="px-4 py-3 font-medium text-accord-text">{event.department}</td>
                  <td className="px-4 py-3 text-accord-muted">{event.provider}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={event.severity} />
                  </td>
                  <td className="px-4 py-3 text-accord-muted">{event.actionTaken}</td>
                  <td className="px-4 py-3 text-right text-accord-muted">{event.status}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3">
                    <RiskBadge level={event.severity} />
                  </td>
                  <td className="px-4 py-3 font-medium text-accord-text">{event.category}</td>
                  <td className="px-4 py-3 text-accord-muted">{event.department}</td>
                  <td className="px-4 py-3 text-accord-muted">{event.user}</td>
                  <td className="px-4 py-3 text-accord-muted">{event.provider}</td>
                  <td className="px-4 py-3 text-accord-muted">{event.actionTaken}</td>
                  <td className="tnum px-4 py-3 font-mono text-[13px] text-accord-muted">{event.time}</td>
                  <td className="px-4 py-3 text-right text-accord-muted">{event.status}</td>
                </>
              );

              if (!onSelect) {
                return (
                  <tr key={event.id} className="transition-colors hover:bg-accord-mist/50">
                    {rowContent}
                  </tr>
                );
              }

              return (
                <tr
                  key={event.id}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accord-mist/60",
                    selectedId === event.id ? "bg-accord-primary/[0.06]" : "bg-white"
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
