export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Non-secret values to put back into the form after a failed submit. */
  values?: Record<string, string>;
  /** Machine-readable outcome for UI branches, e.g. "unverified". */
  code?: string;
  /** Where the client should navigate after success. */
  redirectTo?: string;
};

export const initialFormState: FormState = { status: "idle" };
