import { trpc } from "@/lib/trpc";
import { requireSupabaseAuth, supabase } from "@/lib/supabase";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type PasswordCredentials = {
  email: string;
  password: string;
};

type AuthUser = {
  id: string;
  name: string | null;
  email: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  authStatus: AuthStatus;
  error: Error | null;
  isAuthenticated: boolean;
  login: (credentials: PasswordCredentials) => Promise<void>;
  signUp: (credentials: PasswordCredentials & { fullName?: string }) => Promise<{ data: { session: Session | null; user: SupabaseUser | null }; error: Error | null }>;

  logout: () => Promise<void>;
  refresh: () => Promise<unknown>;
  authUser: SupabaseUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function authDiagnostic(label: string, details: Record<string, unknown>) {
  if (import.meta.env.DEV) console.info(`[Auth] ${label}`, details);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(() => (supabase ? null : new Error("Supabase Auth is not configured")));

  useEffect(() => {
    if (!supabase) {
      setSessionLoading(false);
      return;
    }

    let mounted = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setSessionLoading(false);
      authDiagnostic("AUTH_EVENT", {
        event,
        hasSession: Boolean(nextSession),
        userId: nextSession?.user?.id ?? null,
      });

      if (event === "SIGNED_OUT" || !nextSession) {
        utils.auth.me.setData(undefined, null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        void utils.auth.me.invalidate();
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error);
      setSession(data.session);
      setSessionLoading(false);
      authDiagnostic("GET_SESSION", {
        hasSession: Boolean(data.session),
        userId: data.session?.user?.id ?? null,
        error: error?.message ?? null,
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [utils]);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(session) && !sessionLoading,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const login = useCallback(async ({ email, password }: PasswordCredentials) => {
    const client = requireSupabaseAuth(supabase);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    authDiagnostic("SIGN_IN", {
      success: !error,
      hasSession: Boolean(data.session),
      userId: data.user?.id ?? null,
      error: error?.message ?? null,
    });
    if (error) throw error;
    if (data.session) setSession(data.session);
  }, []);

  const signUp = useCallback(async ({ email, password, fullName }: PasswordCredentials & { fullName?: string }) => {
    const client = requireSupabaseAuth(supabase);
    const result = await client.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    authDiagnostic("SIGN_UP", {
      success: !result.error,
      hasSession: Boolean(result.data.session),
      userId: result.data.user?.id ?? null,
      error: result.error?.message ?? null,
    });
    if (!result.error && result.data.session) setSession(result.data.session);
    return result;
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    utils.auth.me.setData(undefined, null);
  }, [utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? null;
    const authStatus: AuthStatus = sessionLoading ? "loading" : session ? "authenticated" : "unauthenticated";
    const value: AuthContextValue = {
      user,
      session,
      supabaseUser: session?.user ?? null,
      loading: sessionLoading,
      authStatus,
      error: authError ?? (meQuery.error ? new Error(meQuery.error.message) : null),
      isAuthenticated: Boolean(session),
      login,
      signUp,
      logout,
      refresh: () => meQuery.refetch(),
      authUser: session?.user ?? null,
    };
    return value;
  }, [authError, login, logout, meQuery.data, meQuery.error, meQuery.refetch, session, sessionLoading, signUp]);

  useEffect(() => {
    authDiagnostic("AUTH_STATE", {
      status: state.authStatus,
      userId: state.supabaseUser?.id ?? null,
      hasSession: Boolean(state.session),
    });
  }, [state.authStatus, state.session, state.supabaseUser?.id]);

  return createElement(AuthContext.Provider, { value: state }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
