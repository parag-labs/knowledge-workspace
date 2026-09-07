/**
 * The typed event model. A query run is fully described by the ordered events it emits, which
 * powers the live UI (plan → search → traverse → evidence → answer) and after-the-fact replay.
 */

import type { EntityId, EvidenceId, QueryId } from "./ids";
import type { EntityKind, RelationType } from "./entities";

export type RunStatus = "answered" | "insufficient_evidence" | "failed";

export type QueryEvent =
  | { readonly type: "QueryStarted"; readonly question: string }
  | { readonly type: "PlanProposed"; readonly seedKinds: readonly EntityKind[]; readonly traverse: readonly RelationType[]; readonly maxHops: number; readonly tokens: number }
  | { readonly type: "SeedsFound"; readonly seeds: readonly { id: EntityId; name: string; score: number }[] }
  | { readonly type: "Traversed"; readonly reached: number; readonly hops: number }
  | { readonly type: "EvidenceCollected"; readonly id: EvidenceId; readonly entity: EntityId; readonly source: string; readonly section: string | undefined; readonly confidence: number }
  | { readonly type: "MissingInfo"; readonly detail: string }
  | { readonly type: "AnswerComposed"; readonly answer: string; readonly citations: number }
  | { readonly type: "QueryCompleted"; readonly status: RunStatus }
  | { readonly type: "QueryFailed"; readonly error: string };

export type QueryEventType = QueryEvent["type"];

export interface LoggedEvent {
  readonly seq: number;
  readonly at: number;
  readonly queryId: QueryId;
  readonly event: QueryEvent;
}

/** An append-only log with an optional listener that fires as each event is appended (for SSE). */
export class EventLog {
  private readonly events: LoggedEvent[] = [];
  private seq = 0;

  constructor(
    private readonly queryId: QueryId,
    private readonly clock: () => number = () => Date.now(),
    private readonly onAppend?: (e: LoggedEvent) => void,
  ) {}

  append(event: QueryEvent): LoggedEvent {
    const logged: LoggedEvent = { seq: this.seq++, at: this.clock(), queryId: this.queryId, event };
    this.events.push(logged);
    this.onAppend?.(logged);
    return logged;
  }

  all(): readonly LoggedEvent[] {
    return this.events;
  }
}
