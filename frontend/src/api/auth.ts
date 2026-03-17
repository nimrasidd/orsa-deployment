import { apiFetch } from "./http";

export type UserOut = {
  id: string;
  email: string;
  name: string;
  company_id: string;
  company_name: string | null;
};

export type LoginOut = {
  access_token: string;
  token_type: string;
  user: UserOut;
};

export async function login(email: string, password: string): Promise<LoginOut> {
  return apiFetch<LoginOut>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  company_id: string;
}): Promise<UserOut> {
  return apiFetch<UserOut>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function getMe(token: string): Promise<UserOut> {
  return apiFetch<UserOut>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
