import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
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

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [authError, setAuthError] = useState<Error | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthError(new Error("Supabase Auth is not configured"));
      setSessionLoading(false);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error);
      setSession(data.session);
      setSessionLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoading(false);
      if (!nextSession) utils.auth.me.setData(undefined, null);
      else void utils.auth.me.invalidate();
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
    if (!supabase) throw new Error("Supabase Auth is not configured");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async ({ email, password, fullName }: PasswordCredentials & { fullName?: string }) => {
    if (!supabase) throw new Error("Supabase Auth is not configured");
    return supabase.auth.signUp({
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
    return {
      user,
      session,
      supabaseUser: session?.user ?? null,
      loading: sessionLoading || (Boolean(session) && meQuery.isLoading),
      error: authError ?? meQuery.error ?? null,
      isAuthenticated: Boolean(session && user),
    };
  }, [authError, meQuery.data, meQuery.error, meQuery.isLoading, session, sessionLoading]);

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
