import { apiFetch } from "./http";

export type AccessRequestPayload = {
  name: string;
  email: string;
  organization: string;
  message?: string;
  /** Honeypot — leave empty. */
  website?: string;
};

export function submitAccessRequest(body: AccessRequestPayload) {
  return apiFetch<{ ok: boolean }>("/access-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: body.name,
      email: body.email,
      organization: body.organization,
      message: body.message ?? "",
      website: body.website ?? "",
    }),
  });
}
