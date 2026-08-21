import { trpc } from "@/lib/trpc";
import { requireSupabaseAuth, supabase } from "@/lib/supabase";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type PasswordCredentials = {
  email: string;
  password: string;
};

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
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

    // Read initial session authoritatively
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error);
      setSession(data.session);
      setSessionLoading(false);
    });

    // Single authoritative subscription for all auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setSessionLoading(false);

      if (event === "SIGNED_OUT" || !nextSession) {
        utils.auth.me.setData(undefined, null);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        void utils.auth.me.invalidate();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [utils]);

  // Only run meQuery when session exists and initial session bootstrap is finished
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: Boolean(session) && !sessionLoading,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const login = useCallback(async ({ email, password }: PasswordCredentials) => {
    const client = requireSupabaseAuth(supabase);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async ({ email, password, fullName }: PasswordCredentials & { fullName?: string }) => {
    const client = requireSupabaseAuth(supabase);
    return client.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    utils.auth.me.setData(undefined, null);
  }, [utils]);

  const state = useMemo(() => {
    const user = meQuery.data ?? null;
    const isLoading = sessionLoading;
    const isAuthenticated = Boolean(session);
    const authStatus: AuthStatus = isLoading ? "loading" : isAuthenticated ? "authenticated" : "unauthenticated";

    return {
      user,
      session,
      supabaseUser: session?.user ?? null,
      loading: isLoading,
      authStatus,
      error: authError ?? meQuery.error ?? null,
      isAuthenticated,
    };
  }, [authError, meQuery.data, meQuery.error, session, sessionLoading]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || state.loading || state.isAuthenticated) return;
    if (typeof window === "undefined" || !redirectPath) return;
    if (window.location.pathname !== redirectPath) window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, state.isAuthenticated, state.loading]);

  return {
    ...state,
    login,
    signUp,
    logout,
    refresh: () => meQuery.refetch(),
    authUser: state.supabaseUser as SupabaseUser | null,
  };
}
