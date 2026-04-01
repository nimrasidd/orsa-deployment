import { apiFetch } from "./http";
import type { UserOut } from "./auth";

export type UserListOut = {
  id: string;
  email: string;
  name: string;
  company_id: string | null;
  company_name: string | null;
  created_at: string | null;
};

export async function listSettingsUsers(): Promise<UserListOut[]> {
  return apiFetch<UserListOut[]>("/settings/users");
}

export async function createSettingsUser(input: {
  email: string;
  password: string;
  name: string;
  company_id: string;
}): Promise<UserOut> {
  return apiFetch<UserOut>("/settings/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function updateUserCompany(userId: string, company_id: string): Promise<UserListOut> {
  return apiFetch<UserListOut>(`/settings/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ company_id }),
  });
}
