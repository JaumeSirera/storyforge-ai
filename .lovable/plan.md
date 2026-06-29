
## Objetivo

1. **Numeración estable**: cada escena tiene un orden manual persistente (1..N). El badge "Escena N" usa ese orden en editor, preview, sesión y selectores.
2. **Varios vídeos por escena**: cada escena puede tener una lista de clips con etiqueta; durante la reproducción el usuario elige cuál ver mediante pestañas.

## Cambios en el modelo (`src/lib/story-types.ts`)

- `StoryNode.order?: number` — entero. Si falta, se calcula al cargar (índice de inserción).
- `StoryNode.videos?: Array<{ id: string; label: string; source: VideoSource }>` — opcional, nuevo.
- `StoryNode.video` se mantiene por compatibilidad (legacy). Al guardar: si hay `videos`, ese campo manda; si no, se serializa `video` como antes. Al cargar: si solo hay `video`, se proyecta a `videos = [{ id, label: "Clip 1", source: video }]` en memoria para la UI.

No requiere migración SQL: el árbol vive en JSON dentro de `simulations.story`.

## Reordenación de escenas

- Nueva utilidad `src/lib/scene-order.ts` reescrita: `computeSceneOrder(story)` devuelve `Map<id, number>` ordenando por `node.order` ascendente (fallback: orden de inserción en `Object.keys`). Se elimina el BFS para numeración.
- BFS sigue disponible aparte (`computeReachability`) solo para validar ramas rotas, no para numerar.

## Editor (`app.simulations.$id.edit.tsx`)

- Instalar `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` (vía `bun add`).
- Lista de escenas envuelta en `<DndContext><SortableContext>`. Cada acordeón es `useSortable` con asa de arrastre (icono `GripVertical`) en la cabecera.
- Al soltar, recalculo `order` 1..N y marco el formulario como sucio.
- Dentro de cada escena, nueva sección "Vídeos de la escena":
  - Lista de clips con: etiqueta (input corto), tipo (select youtube/vimeo/mp4/none), URL, inicio/fin opcionales, botón eliminar.
  - Botón "Añadir vídeo".
  - Si la escena venía con `video` legacy y sin `videos`, al primer cambio se migra a `videos[0]`.

## Reproductor (`src/components/VideoPlayer.tsx`)

- Acepta `videos?: Array<{id,label,source}>` además de `video` (compat).
- Si hay 2+ clips: muestra `<Tabs>` con la etiqueta de cada uno encima del iframe/video; el iframe se re-monta al cambiar.
- Si hay 1 clip o ninguno: se comporta como hoy.

## Preview y sesión

- `StoryPreview.tsx` y `app.sessions.$id.tsx`: pasan `node.videos ?? [{...node.video}]` al VideoPlayer. El badge "Escena N" usa el nuevo `computeSceneOrder`.

## Backend (`src/lib/simulations.functions.ts`)

- El validador Zod del árbol acepta `order` y `videos` (ambos opcionales). El normalizador rellena `order` por índice si falta, y deja `videos` tal cual.
- `createFallbackStory` y la generación de IA siguen escribiendo `video` único; eso queda compatible.

## Detalles técnicos

```text
StoryNode {
  id, title, narrative, order?,
  video: VideoSource,            // legacy, mantenido
  videos?: [{ id, label, source: VideoSource }],
  question?, isEnding?, endingType?
}
```

- El selector de "siguiente escena" y "escena de inicio" sigue mostrando "Escena N — título" pero ahora N viene del orden manual.
- Drag & drop con teclado accesible (PointerSensor + KeyboardSensor de dnd-kit).

## Fuera de alcance

- No se cambia la generación con IA (la IA seguirá produciendo `video` único; el usuario añade clips extra desde el editor).
- No se introduce reproducción secuencial automática de varios clips (queda como mejora futura).
