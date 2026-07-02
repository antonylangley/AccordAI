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

export function EventTable({ events, compact = false, selectedId, onSelect }: EventTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-accord-border bg-white/94 shadow-accord-panel">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-accord-border text-left text-sm">
          <thead className="bg-accord-mist/75 text-[11px] uppercase tracking-[0.12em] text-accord-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">
                {compact ? "Time" : "Severity"}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {compact ? "Department" : "Category"}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {compact ? "Provider" : "Department"}
              </th>
              {!compact ? (
                <>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    User
                  </th>
                  <th scope="col" className="px-4 py-3 font-semibold">
                    Provider
                  </th>
                </>
              ) : null}
              <th scope="col" className="px-4 py-3 font-semibold">
                {compact ? "Risk" : "Action taken"}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                {compact ? "Action" : "Time"}
              </th>
              <th scope="col" className="px-4 py-3 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-accord-border/70">
            {events.map((event) => {
              const rowContent = compact ? (
                <>
                  <td className="px-4 py-3.5 text-accord-muted">{event.time}</td>
                  <td className="px-4 py-3.5 font-medium text-accord-text">{event.department}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.provider}</td>
                  <td className="px-4 py-3.5">
                    <RiskBadge level={event.severity} />
                  </td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.actionTaken}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.status}</td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3.5">
                    <RiskBadge level={event.severity} />
                  </td>
                  <td className="px-4 py-3.5 font-medium text-accord-text">{event.category}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.department}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.user}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.provider}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.actionTaken}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.time}</td>
                  <td className="px-4 py-3.5 text-accord-muted">{event.status}</td>
                </>
              );

              if (!onSelect) {
                return <tr key={event.id}>{rowContent}</tr>;
              }

              return (
                <tr
                  key={event.id}
                  className={cn(
                    "cursor-pointer transition hover:bg-accord-mist",
                    selectedId === event.id ? "bg-[#f1f2ff]" : "bg-white"
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
