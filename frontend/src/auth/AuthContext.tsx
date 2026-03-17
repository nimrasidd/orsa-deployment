import * as React from "react";
import { getMe, login as apiLogin, type UserOut } from "../api/auth";
import { getStoredToken, setStoredToken } from "./storage";

type AuthState = {
  user: UserOut | null;
  token: string | null;
  loading: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setToken: (token: string | null) => void;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null,
    token: getStoredToken(),
    loading: true,
  });

  React.useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }
    getMe(token)
      .then((user) => {
        setState({ user, token, loading: false });
      })
      .catch(() => {
        setStoredToken(null);
        setState({ user: null, token: null, loading: false });
      });
  }, []);

  const login = React.useCallback(async (email: string, password: string) => {
    const { access_token, user } = await apiLogin(email, password);
    setStoredToken(access_token);
    setState({ user, token: access_token, loading: false });
  }, []);

  const logout = React.useCallback(() => {
    setStoredToken(null);
    setState({ user: null, token: null, loading: false });
  }, []);

  const setToken = React.useCallback((token: string | null) => {
    setStoredToken(token);
    if (!token) {
      setState({ user: null, token: null, loading: false });
      return;
    }
    getMe(token)
      .then((user) => setState({ user, token, loading: false }))
      .catch(() => setState({ user: null, token: null, loading: false }));
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, login, logout, setToken }),
    [state, login, logout, setToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
