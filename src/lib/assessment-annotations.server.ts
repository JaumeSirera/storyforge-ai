import {
  ANNOTATION_KINDS,
  type AnnotationKind,
  type SubmissionAnnotation,
} from "./assessments-shared";
import { assessDb } from "./assessments-repo.server";

const COLUMNS =
  "id, submission_id, page_path, page_index, kind, x, y, w, h, correction, comment, created_at, updated_at";

export function mapAnnotation(row: any): SubmissionAnnotation {
  const kind = (ANNOTATION_KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as AnnotationKind)
    : "transcription";
  return {
    id: row.id,
    submissionId: row.submission_id,
    pagePath: row.page_path,
    pageIndex: Number(row.page_index ?? 0),
    kind,
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    w: Number(row.w ?? 0),
    h: Number(row.h ?? 0),
    correction: row.correction ?? "",
    comment: row.comment ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAnnotationsHandler(data: { submissionId: string }, context: any) {
  const { assertSubmissionPermission } = await import("./assessment-roles.server");
  await assertSubmissionPermission(data.submissionId, "view", context);
  const { data: rows, error } = await assessDb(context)
    .from("assessment_annotations")
    .select(COLUMNS)
    .eq("submission_id", data.submissionId)
    .order("page_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return { annotations: (rows ?? []).map(mapAnnotation) };
}

export interface SaveAnnotationInput {
  id?: string;
  submissionId: string;
  pagePath: string;
  pageIndex: number;
  kind: AnnotationKind;
  x: number;
  y: number;
  w: number;
  h: number;
  correction: string;
  comment: string;
}

export async function saveAnnotationHandler(data: SaveAnnotationInput, context: any) {
  // Debe tener permiso de anotación sobre la evaluación de la entrega.
  const { assertSubmissionPermission } = await import("./assessment-roles.server");
  await assertSubmissionPermission(data.submissionId, "annotate", context);

  const payload = {
    submission_id: data.submissionId,
    owner_id: context.userId,
    page_path: data.pagePath,
    page_index: data.pageIndex,
    kind: data.kind,
    x: data.x,
    y: data.y,
    w: data.w,
    h: data.h,
    correction: data.correction,
    comment: data.comment,
  };

  if (data.id) {
    const { data: row, error } = await assessDb(context)
      .from("assessment_annotations")
      .update(payload)
      .eq("id", data.id)
      .select(COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return { annotation: mapAnnotation(row) };
  }

  const { data: row, error } = await assessDb(context)
    .from("assessment_annotations")
    .insert(payload)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return { annotation: mapAnnotation(row) };
}

export async function deleteAnnotationHandler(data: { id: string }, context: any) {
  const { error } = await assessDb(context)
    .from("assessment_annotations")
    .delete()
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
