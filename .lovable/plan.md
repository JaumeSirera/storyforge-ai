
## Qué cambia

Hoy, tras enviar un comentario, el selector solo ofrece **FIN** o **saltar a otra escena**. Vamos a ampliarlo con dos destinos nuevos:

1. **FIN** — termina la simulación (siempre disponible).
2. **Ir a otra escena** — como ahora (lista de escenas).
3. **Continuar con el vídeo** — no salta de escena; se cierra el comentario y el vídeo sigue reproduciéndose. Las preguntas/comentarios posteriores de la misma escena podrán dispararse en su momento (por tiempo o al final del clip).
4. **Ir a otra pregunta o comentario** — dentro de la misma escena, salta a la pregunta/comentario indicado y lo muestra de inmediato (ignorando su trigger).

Esto permite encadenar varios comentarios, pasar de un comentario a una pregunta, o simplemente dejar continuar el vídeo tras el comentario.

## Cambios técnicos

**Modelo (`src/lib/story-types.ts`)**
- `Choice.nextKind?: "end" | "scene" | "continue" | "question"` (opcional; compat: si falta, se deduce de `next`: `null` → `end`, string → `scene`).
- `Choice.nextQuestionId?: string` — id de la pregunta destino cuando `nextKind === "question"`.

**Validador (`src/lib/simulations.functions.ts`)**
- Ampliar el schema Zod de `Choice` para aceptar los dos nuevos campos opcionales.

**Editor (`app.simulations.$id.edit.tsx`)**
- En el bloque `kind === "comment"`, reemplazar el selector actual por un selector de "Tipo de destino" con las 4 opciones + un segundo selector contextual:
  - `end` → nada más.
  - `scene` → lista de escenas.
  - `continue` → nada más.
  - `question` → lista de preguntas/comentarios de la **misma escena** (excluyendo la actual), mostrando "Comentario/Pregunta N — extracto del texto".
- Guardar `nextKind`, `next` (nodeId cuando aplica) y `nextQuestionId`.

**Reproducción (`StoryPreview.tsx` y `app.sessions.$id.tsx`)**
- Añadir estado `answeredQuestionIds: Set<string>` por escena (se resetea al cambiar de nodo).
- `activeQuestion` local que además filtre las ya contestadas y respete un `forcedQuestionId` cuando venimos de `nextKind === "question"`.
- Al elegir/enviar:
  - `end` → mismo comportamiento que hoy con `next = null`.
  - `scene` → salta a `next` (nodo).
  - `continue` → marca la pregunta como contestada, cierra la UI y reanuda el vídeo (sin cambiar de nodo, sin marcar `ended`).
  - `question` → marca la pregunta como contestada y activa la pregunta indicada con `questionReady = true`.

**Backend (`src/lib/sessions.functions.ts`, `submitAnswer`)**
- Reproducir la misma lógica de destino en el servidor: calcular `nextId` según `choice.nextKind`; en `continue` y `question` NO se cambia `current_node_id` ni se completa la sesión; se devuelve `stayInScene: true` y, en `question`, `forcedQuestionId`.
- Mantener respuesta compatible (`nextNodeId`, `completed`) para el cliente actual.

## Fuera de alcance

- Solo se toca el destino de los **comentarios**. Las preguntas normales y los enlaces `goto` no cambian su selector.
- No se toca la generación con IA ni el modelo de escenas.
