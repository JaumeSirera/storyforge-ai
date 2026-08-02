import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flag, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import type { StoryNode } from "@/lib/story-types";
import { nodeQuestions } from "@/lib/story-types";
import { cn } from "@/lib/utils";

type ChoiceRef = { nodeIdx: number; qIdx: number; cIdx: number };

export type StoryFlowchartProps = {
  nodes: StoryNode[];
  disabled?: boolean;
  onReorderScenes: (activeId: string, overId: string) => void;
  onRewireChoice: (ref: ChoiceRef, targetNodeId: string | null) => void;
  onDeleteScene: (nodeIdx: number) => void;
  onDeleteChoice: (ref: ChoiceRef) => void;
  onEditScene: (nodeId: string) => void;
  onAddScene: () => void;
};

type Edge = { from: string; to: string; label: string; key: string };

/** Interactive scene/branch org-chart with drag & drop reordering and rewiring. */
export function StoryFlowchart({
  nodes,
  disabled = false,
  onReorderScenes,
  onRewireChoice,
  onDeleteScene,
  onDeleteChoice,
  onEditScene,
  onAddScene,
}: StoryFlowchartProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [dragging, setDragging] = useState<null | { type: "scene" | "choice" }>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [paths, setPaths] = useState<{ key: string; d: string; label: string; x: number; y: number }[]>([]);

  const edges: Edge[] = [];
  nodes.forEach((n, nodeIdx) => {
    nodeQuestions(n).forEach((q) => {
      q.choices.forEach((c, cIdx) => {
        const kind = c.nextKind ?? (c.next ? "scene" : "end");
        if (kind === "scene" && c.next && nodes.some((t) => t.id === c.next)) {
          edges.push({ from: n.id, to: c.next, label: c.label || `Opción ${cIdx + 1}`, key: `${n.id}-${nodeIdx}-${c.id}` });
        }
      });
    });
  });
  const edgesKey = edges.map((e) => `${e.from}>${e.to}`).join("|");

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cb = container.getBoundingClientRect();
    const next: { key: string; d: string; label: string; x: number; y: number }[] = [];
    for (const e of edges) {
      const a = cardRefs.current.get(e.from);
      const b = cardRefs.current.get(e.to);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = ra.right - cb.left;
      const y1 = ra.top + ra.height / 2 - cb.top;
      const x2 = rb.right - cb.left;
      const y2 = rb.top + rb.height / 2 - cb.top;
      const bulge = 28 + Math.min(90, Math.abs(y2 - y1) * 0.25);
      const d = `M ${x1} ${y1} C ${x1 + bulge} ${y1}, ${x2 + bulge} ${y2}, ${x2} ${y2}`;
      next.push({ key: e.key, d, label: e.label, x: Math.max(x1, x2) + bulge * 0.6, y: (y1 + y2) / 2 });
    }
    setPaths(next);
  }, [edgesKey, nodes.length]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const ro = new ResizeObserver(() => measure());
    if (containerRef.current) ro.observe(containerRef.current);
    cardRefs.current.forEach((el) => ro.observe(el));
    window.addEventListener("scroll", measure, true);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const handleDragStart = (e: DragStartEvent) => {
    const type = (e.active.data.current as { type?: "scene" | "choice" } | undefined)?.type;
    setDragging(type ? { type } : null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;
    const a = active.data.current as { type?: string; nodeId?: string; ref?: ChoiceRef } | undefined;
    const o = over.data.current as { type?: string; nodeId?: string | null } | undefined;
    if (!a || !o) return;
    if (a.type === "scene" && o.type === "scene-drop" && a.nodeId && o.nodeId && a.nodeId !== o.nodeId) {
      onReorderScenes(a.nodeId, o.nodeId);
      return;
    }
    if (a.type === "choice" && a.ref) {
      if (o.type === "scene-drop" && o.nodeId) onRewireChoice(a.ref, o.nodeId);
      else if (o.type === "end-drop") onRewireChoice(a.ref, null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Arrastra la <strong>escena</strong> por su asa para reordenarla, o arrastra una <strong>ramificación</strong> y suéltala
        sobre otra escena (o sobre <strong>FIN</strong>) para cambiar su destino.
      </p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <div className="sm:overflow-x-auto">
          <div ref={containerRef} className="relative space-y-3 sm:min-w-[520px] sm:pr-28">
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              <defs>
                <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill="currentColor" className="text-primary" />
                </marker>
              </defs>
              {paths.map((p) => (
                <path
                  key={p.key}
                  d={p.d}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  className="text-primary/50"
                  markerEnd="url(#flow-arrow)"
                />
              ))}
            </svg>

            {nodes.map((n, nodeIdx) => (
              <FlowSceneCard
                key={n.id}
                node={n}
                nodeIdx={nodeIdx}
                disabled={disabled}
                highlight={dragging?.type === "choice"}
                sceneLabel={(id) => {
                  const i = nodes.findIndex((t) => t.id === id);
                  if (i < 0) return "escena";
                  return `Escena ${i + 1}: ${nodes[i].title || "sin título"}`;
                }}
                registerRef={(el) => {
                  if (el) cardRefs.current.set(n.id, el);
                  else cardRefs.current.delete(n.id);
                }}
                onDeleteScene={onDeleteScene}
                onDeleteChoice={onDeleteChoice}
                onEditScene={onEditScene}
              />
            ))}


            <div className="flex items-center gap-3">
              <EndDropZone active={dragging?.type === "choice"} />
              {!disabled && (
                <Button type="button" size="sm" variant="outline" onClick={onAddScene}>
                  <Plus className="mr-1 h-4 w-4" /> Añadir escena
                </Button>
              )}
            </div>
          </div>
        </div>
      </DndContext>
    </div>
  );
}

function EndDropZone({ active }: { active: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "flow-end", data: { type: "end-drop", nodeId: null } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground transition-colors",
        active && "border-primary/60 bg-primary/5",
        isOver && "border-primary bg-primary/10 text-foreground",
      )}
    >
      FIN de la simulación
    </div>
  );
}

function FlowSceneCard({
  node,
  nodeIdx,
  disabled,
  highlight,
  sceneLabel,
  registerRef,
  onDeleteScene,
  onDeleteChoice,
  onEditScene,
}: {
  node: StoryNode;
  nodeIdx: number;
  disabled: boolean;
  highlight: boolean;
  sceneLabel: (id: string) => string;
  registerRef: (el: HTMLElement | null) => void;
  onDeleteScene: (nodeIdx: number) => void;
  onDeleteChoice: (ref: ChoiceRef) => void;
  onEditScene: (nodeId: string) => void;
}) {

  const draggable = useDraggable({ id: `scene-${node.id}`, data: { type: "scene", nodeId: node.id }, disabled });
  const droppable = useDroppable({ id: `drop-${node.id}`, data: { type: "scene-drop", nodeId: node.id } });

  const questions = nodeQuestions(node);

  return (
    <div
      ref={(el) => {
        droppable.setNodeRef(el);
        registerRef(el);
      }}
      style={{ transform: draggable.transform ? `translate3d(${draggable.transform.x}px, ${draggable.transform.y}px, 0)` : undefined }}
      className={cn(
        "relative z-10 rounded-lg border bg-card p-3 shadow-soft transition-colors",
        draggable.isDragging && "opacity-60",
        highlight && "border-primary/40",
        droppable.isOver && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          ref={draggable.setActivatorNodeRef}
          {...draggable.attributes}
          {...draggable.listeners}
          disabled={disabled}
          className="mt-0.5 cursor-grab touch-none p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing disabled:cursor-default"
          aria-label={`Mover ${node.title}`}
          title="Arrastra para reordenar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="text-[11px]">Escena {nodeIdx + 1}</Badge>
            <span className="truncate font-medium">{node.title}</span>
            {node.isEnding && (
              <Badge variant={node.endingType === "success" ? "default" : "secondary"} className="gap-1">
                <Flag className="h-3 w-3" /> Final
              </Badge>
            )}
          </div>

          {questions.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Sin preguntas ni ramificaciones.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {questions.map((q, qIdx) => (
                <div key={q.id ?? qIdx} className="rounded-md border border-dashed bg-muted/20 p-2">
                  <p className="mb-1 line-clamp-1 text-xs text-muted-foreground">
                    {q.kind === "comment" ? "Comentario" : q.kind === "goto" ? "Enlace" : "Pregunta"} {qIdx + 1}: {q.text || "—"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.choices.map((c, cIdx) => (
                      <BranchChip
                        key={c.id}
                        label={c.label || `Opción ${cIdx + 1}`}
                        destination={destinationLabel(c.nextKind, c.next, sceneLabel)}
                        disabled={disabled}
                        ref_={{ nodeIdx, qIdx, cIdx }}
                        onDelete={disabled ? undefined : () => onDeleteChoice({ nodeIdx, qIdx, cIdx })}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          <Button type="button" size="icon" variant="ghost" onClick={() => onEditScene(node.id)} aria-label="Editar escena">
            <Pencil className="h-4 w-4" />
          </Button>
          {!disabled && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="text-destructive"
              onClick={() => onDeleteScene(nodeIdx)}
              aria-label="Eliminar escena"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function destinationLabel(nextKind: string | undefined, next: string | null): string {
  const kind = nextKind ?? (next ? "scene" : "end");
  if (kind === "end") return "FIN";
  if (kind === "continue") return "sigue el vídeo";
  if (kind === "question") return "otra pregunta";
  return "escena";
}

function BranchChip({
  label,
  destination,
  disabled,
  ref_,
  onDelete,
}: {
  label: string;
  destination: string;
  disabled: boolean;
  ref_: ChoiceRef;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: `choice-${ref_.nodeIdx}-${ref_.qIdx}-${ref_.cIdx}`,
    data: { type: "choice", ref: ref_ },
    disabled,
  });
  return (
    <span
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px]",
        isDragging && "opacity-60 ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="flex min-w-0 cursor-grab touch-none items-center gap-1 active:cursor-grabbing disabled:cursor-default"
        title="Arrastra sobre una escena para cambiar el destino"
      >
        <GripVertical className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
        <span className="flex-shrink-0 text-muted-foreground">→ {destination}</span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
          aria-label={`Eliminar ramificación ${label}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
