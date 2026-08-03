import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { Flag, GripVertical, Maximize2, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import type { StoryNode } from "@/lib/story-types";
import { nodeQuestions } from "@/lib/story-types";
import { cn } from "@/lib/utils";

const ZoomContext = createContext(1);
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));


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
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  zoomRef.current = zoom;
  offsetRef.current = offset;

  /** Zoom anchored at a point in viewport coordinates (defaults to viewport center). */
  const zoomAt = useCallback((factor: number, px?: number, py?: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const ax = px ?? (rect ? rect.width / 2 : 0);
    const ay = py ?? (rect ? rect.height / 2 : 0);
    const current = zoomRef.current;
    const next = clampZoom(current * factor);
    const k = next / current;
    const o = offsetRef.current;
    setOffset({ x: ax - (ax - o.x) * k, y: ay - (ay - o.y) * k });
    setZoom(next);
  }, []);

  const zoomBy = useCallback((factor: number) => zoomAt(factor), [zoomAt]);
  const resetView = useCallback(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Native non-passive wheel listener (React's onWheel is passive).
  const wheelHandlerRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelHandlerRef.current = (e: WheelEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    if (e.ctrlKey || e.metaKey) {
      zoomAt(Math.exp(-dy * 0.0025), e.clientX - rect.left, e.clientY - rect.top);
      return;
    }
    const dx = e.deltaX * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    if (e.shiftKey || Math.abs(dx) > Math.abs(dy)) {
      setOffset((o) => ({ x: o.x - dx, y: o.y - dy }));
      return;
    }
    zoomAt(Math.exp(-dy * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      wheelHandlerRef.current(e);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Background drag to pan + two-pointer pinch zoom.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null);

  const handleViewportPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      // Let cards, buttons and drag handles keep their own interactions.
      if (target.closest("[data-flow-card],button,a,input,select,textarea")) {
        if (pointersRef.current.size === 0) return;
      }
      const el = viewportRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      const onMove = (ev: PointerEvent) => {
        const pts = pointersRef.current;
        const prev = pts.get(ev.pointerId);
        if (!prev) return;
        pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        const list = [...pts.values()];
        if (list.length >= 2) {
          const [p1, p2] = list;
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const rect = el.getBoundingClientRect();
          const cx = (p1.x + p2.x) / 2 - rect.left;
          const cy = (p1.y + p2.y) / 2 - rect.top;
          if (pinchRef.current && pinchRef.current.dist > 0) {
            zoomAt(dist / pinchRef.current.dist, cx, cy);
          }
          pinchRef.current = { dist, cx, cy };
          return;
        }
        pinchRef.current = null;
        setOffset((o) => ({ x: o.x + (ev.clientX - prev.x), y: o.y + (ev.clientY - prev.y) }));
      };
      const onUp = (ev: PointerEvent) => {
        pointersRef.current.delete(ev.pointerId);
        if (pointersRef.current.size < 2) pinchRef.current = null;
        if (pointersRef.current.size === 0) {
          el.removeEventListener("pointermove", onMove);
          el.removeEventListener("pointerup", onUp);
          el.removeEventListener("pointercancel", onUp);
        }
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    },
    [zoomAt],
  );


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
    const s = zoomRef.current || 1;
    for (const e of edges) {
      const a = cardRefs.current.get(e.from);
      const b = cardRefs.current.get(e.to);
      if (!a || !b) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const x1 = (ra.right - cb.left) / s;
      const y1 = (ra.top + ra.height / 2 - cb.top) / s;
      const x2 = (rb.right - cb.left) / s;
      const y2 = (rb.top + rb.height / 2 - cb.top) / s;

      const bulge = 28 + Math.min(90, Math.abs(y2 - y1) * 0.25);
      const d = `M ${x1} ${y1} C ${x1 + bulge} ${y1}, ${x2 + bulge} ${y2}, ${x2} ${y2}`;
      next.push({ key: e.key, d, label: e.label, x: Math.max(x1, x2) + bulge * 0.6, y: (y1 + y2) / 2 });
    }
    setPaths(next);
  }, [edgesKey, nodes.length, zoom]);

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
        sobre otra escena (o sobre <strong>FIN</strong>) para cambiar su destino. Usa la rueda o el pellizco para hacer zoom y
        arrastra el fondo para desplazarte.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => zoomBy(1 / 1.2)} aria-label="Alejar organigrama">
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => zoomBy(1.2)} aria-label="Acercar organigrama">
          <Plus className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2" onClick={resetView} aria-label="Restablecer vista del organigrama">
          <Maximize2 className="h-4 w-4" /> Ajustar
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        <ZoomContext.Provider value={zoom}>
          <div
            ref={viewportRef}
            onPointerDown={handleViewportPointerDown}
            className="relative h-[clamp(320px,68dvh,820px)] w-full cursor-grab touch-none overflow-hidden rounded-lg border bg-muted/10 active:cursor-grabbing"
          >
            <div
              className="absolute left-0 top-0 max-w-none origin-top-left will-change-transform"
              style={{
                width: viewportWidth ? Math.max(280, viewportWidth / zoom) : "100%",
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
              }}
            >
              <div ref={containerRef} className="relative space-y-3 p-2 pr-10 sm:p-3 sm:pr-24 lg:pr-40">
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
          </div>
        </ZoomContext.Provider>
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
  const zoom = useContext(ZoomContext);
  const draggable = useDraggable({ id: `scene-${node.id}`, data: { type: "scene", nodeId: node.id }, disabled });
  const droppable = useDroppable({ id: `drop-${node.id}`, data: { type: "scene-drop", nodeId: node.id } });

  const questions = nodeQuestions(node);

  return (
    <div
      data-flow-card=""
      ref={(el) => {
        droppable.setNodeRef(el);
        registerRef(el);
      }}
      style={{
        transform: draggable.transform
          ? `translate3d(${draggable.transform.x / zoom}px, ${draggable.transform.y / zoom}px, 0)`
          : undefined,
      }}

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
            <span className="min-w-0 break-words font-medium">{node.title}</span>
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
                  <p className="mb-1 break-words text-xs text-muted-foreground">
                    {q.kind === "comment" ? "Comentario" : q.kind === "goto" ? "Enlace" : "Pregunta"} {qIdx + 1}: {q.text || "—"}
                  </p>
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
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

function destinationLabel(
  nextKind: string | undefined,
  next: string | null,
  sceneLabel: (id: string) => string,
): string {
  const kind = nextKind ?? (next ? "scene" : "end");
  if (kind === "end") return "FIN";
  if (kind === "continue") return "sigue el vídeo";
  if (kind === "question") return "otra pregunta";
  return next ? sceneLabel(next) : "escena sin destino";
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
  const zoom = useContext(ZoomContext);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: `choice-${ref_.nodeIdx}-${ref_.qIdx}-${ref_.cIdx}`,
    data: { type: "choice", ref: ref_ },
    disabled,
  });
  return (
    <span
      ref={setNodeRef}
      style={{ transform: transform ? `translate3d(${transform.x / zoom}px, ${transform.y / zoom}px, 0)` : undefined }}

      className={cn(
        "flex max-w-full items-start gap-1 rounded-lg border bg-background px-2 py-1 text-xs sm:inline-flex sm:items-center sm:rounded-full",
        isDragging && "opacity-60 ring-2 ring-primary",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="flex min-w-0 flex-1 cursor-grab touch-none items-start gap-1 text-left active:cursor-grabbing disabled:cursor-default sm:items-center"
        title="Arrastra sobre una escena para cambiar el destino"
      >
        <GripVertical className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground sm:mt-0" />
        <span className="min-w-0 break-words">
          <span className="font-medium">{label}</span>{" "}
          <span className="text-muted-foreground">→ {destination}</span>
        </span>
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
