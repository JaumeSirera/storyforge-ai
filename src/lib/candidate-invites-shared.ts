export interface InviteEmailLog {
  id: string;
  candidateId: string;
  recipient: string;
  status: "pending" | "sent" | "failed" | "suppressed";
  attempts: number;
  errorMessage: string | null;
  lastAttemptAt: string | null;
  updatedAt: string;
}
