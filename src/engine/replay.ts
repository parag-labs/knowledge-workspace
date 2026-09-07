/**
 * Replay: fold a query's event log into a view of what happened. Because the run is fully
 * described by its events, this is exact and backs the UI timeline.
 */

import type { LoggedEvent, QueryEvent, RunStatus } from "./events";

export interface QueryView {
  readonly question: string;
  readonly seeds: number;
  readonly reached: number;
  readonly evidence: number;
  readonly citations: number;
  readonly status: RunStatus | "running";
}

const EMPTY: QueryView = { question: "", seeds: 0, reached: 0, evidence: 0, citations: 0, status: "running" };

function apply(view: QueryView, event: QueryEvent): QueryView {
  switch (event.type) {
    case "QueryStarted":
      return { ...view, question: event.question };
    case "SeedsFound":
      return { ...view, seeds: event.seeds.length };
    case "Traversed":
      return { ...view, reached: event.reached };
    case "EvidenceCollected":
      return { ...view, evidence: view.evidence + 1 };
    case "AnswerComposed":
      return { ...view, citations: event.citations };
    case "QueryCompleted":
      return { ...view, status: event.status };
    case "QueryFailed":
      return { ...view, status: "failed" };
    default:
      return view;
  }
}

/** Fold events up to and including `untilSeq` (default: all) into a query view. */
export function replay(events: readonly LoggedEvent[], untilSeq = Infinity): QueryView {
  return events.filter((e) => e.seq <= untilSeq).reduce((view, e) => apply(view, e.event), EMPTY);
}
