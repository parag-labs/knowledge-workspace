"use client";

import { useCallback, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  KnowledgeGraph,
  MockQueryPlanner,
  ask,
  seedGraph,
  exampleQuestions,
  type Entity,
  type Relationship,
  type GroundedAnswer,
  type LoggedEvent,
} from "@/engine";

const graph = KnowledgeGraph.from(seedGraph);

interface Result {
  status: string;
  answer: GroundedAnswer;
  reachedIds: string[];
  events: LoggedEvent[];
}

/** Lay the full graph out in columns by entity kind, highlighting reached + seed nodes. */
function toFlow(entities: Entity[], rels: Relationship[], reached: Set<string>, seeds: Set<string>): { nodes: Node[]; edges: Edge[] } {
  const columns: Record<string, number> = { Person: 0, Decision: 1, Document: 2, Meeting: 3, Requirement: 2, Technology: 3, Project: 0, Task: 0 };
  const perCol: Record<number, number> = {};
  const nodes: Node[] = entities.map((e) => {
    const col = columns[e.kind] ?? 0;
    const row = (perCol[col] = (perCol[col] ?? 0) + 1);
    const dim = reached.size > 0 && !reached.has(String(e.id));
    return {
      id: String(e.id),
      position: { x: col * 230 + 40, y: row * 92 },
      data: { label: `${e.name} · ${e.kind}` },
      className: `kind-${e.kind}${seeds.has(String(e.id)) ? " seed" : ""}`,
      style: dim ? { opacity: 0.28 } : undefined,
    };
  });
  const edges: Edge[] = rels.map((r, i) => ({
    id: `e${i}`,
    source: String(r.from),
    target: String(r.to),
    label: r.type,
    animated: reached.has(String(r.from)) && reached.has(String(r.to)),
  }));
  return { nodes, edges };
}

function tagClass(type: string): string {
  if (type === "MissingInfo") return "warn";
  if (type === "QueryFailed") return "bad";
  if (type === "AnswerComposed" || type === "QueryCompleted" || type === "EvidenceCollected") return "ok";
  return "info";
}

export function Workspace() {
  const [question, setQuestion] = useState<string>(exampleQuestions.whyCosmos);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const reached = useMemo(() => new Set(result?.reachedIds ?? []), [result]);
  const seeds = useMemo(() => {
    const s = result?.events.find((e) => e.event.type === "SeedsFound");
    return new Set(s?.event.type === "SeedsFound" ? s.event.seeds.map((x) => String(x.id)) : []);
  }, [result]);

  const flow = useMemo(
    () => toFlow(graph.all(), [...graph.allRelationships()], reached, seeds),
    [reached, seeds],
  );

  const run = useCallback(async (q: string) => {
    setBusy(true);
    try {
      // The engine is pure, deterministic TypeScript, so the whole query runs client-side -
      // no backend and no API key. That is what lets this run as a static GitHub Pages demo.
      const r = await ask(graph, q, { planner: new MockQueryPlanner() });
      setResult({ status: r.status, answer: r.answer, reachedIds: [...r.reachedIds], events: [...r.events] });
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <>
      <div className="topbar">
        <h1>Knowledge Workspace</h1>
        <span className="muted mono">graph traversal · evidence-grounded answers</span>
      </div>
      <div className="layout">
        <div className="graph-pane">
          <ReactFlow nodes={flow.nodes} edges={flow.edges} fitView proOptions={{ hideAttribution: true }}>
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <div className="inspector">
          <h2>Ask the graph</h2>
          <div className="controls">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run(question)}
              placeholder="Ask a question…"
            />
            <button className="run" onClick={() => run(question)} disabled={busy}>
              {busy ? "…" : "Ask"}
            </button>
          </div>
          <div className="samples">
            {Object.values(exampleQuestions).map((q) => (
              <span
                key={q}
                className="chip"
                onClick={() => {
                  setQuestion(q);
                  run(q);
                }}
              >
                {q}
              </span>
            ))}
          </div>

          {result && (
            <>
              <h2>Answer</h2>
              <div className={`answer ${result.answer.sufficient ? "" : "insufficient"}`}>
                {result.answer.text}
                {!result.answer.sufficient && result.answer.missing && (
                  <>
                    {"\n\n"}
                    <span className="muted">Missing: {result.answer.missing}</span>
                  </>
                )}
              </div>

              {result.answer.evidence.length > 0 && (
                <>
                  <h2>Evidence ({result.answer.evidence.length})</h2>
                  {result.answer.evidence.map((ev) => (
                    <div className="evidence" key={String(ev.id)}>
                      <span className="conf">confidence {ev.confidence.toFixed(2)}</span>
                      <span className="src">
                        {ev.source}
                        {ev.section ? ` § ${ev.section}` : ""}
                      </span>
                      <div className="body">{ev.entity.text}</div>
                    </div>
                  ))}
                </>
              )}

              <h2>Query trace</h2>
              {result.events.map((e) => (
                <div className="event" key={e.seq}>
                  <span className={`tag ${tagClass(e.event.type)}`}>{e.event.type}</span>
                  <span className="muted">{describe(e.event)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function describe(e: LoggedEvent["event"]): string {
  switch (e.type) {
    case "QueryStarted":
      return e.question;
    case "PlanProposed":
      return `seeds:[${e.seedKinds.join(",")}] hops:${e.maxHops}`;
    case "SeedsFound":
      return e.seeds.map((s) => `${s.name} (${s.score.toFixed(2)})`).join(", ");
    case "Traversed":
      return `reached ${e.reached} entities in ${e.hops} hops`;
    case "EvidenceCollected":
      return `${e.source}${e.section ? ` § ${e.section}` : ""} · ${e.confidence.toFixed(2)}`;
    case "MissingInfo":
      return e.detail;
    case "AnswerComposed":
      return `${e.citations} cited claims`;
    case "QueryCompleted":
      return e.status;
    case "QueryFailed":
      return e.error;
    default:
      return "";
  }
}
