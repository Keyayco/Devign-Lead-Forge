import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/lib/supabase";

export function AuthPanel() {
  const { login, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const isConfigured = Boolean(supabase);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      if (mode === "signin") {
        await login({ email, password });
        toast.success("Welcome back");
      } else {
        const { data } = await signUp({ email, password, fullName });
        if (data.session) {
          toast.success("Account created");
        } else {
          setNotice("Account created. Check your email to confirm the account, then sign in.");
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  };

  const isSignUp = mode === "signup";

  return (
    <div className="min-h-screen bg-[#f6f7f9] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="hidden rounded-[2rem] bg-slate-950 p-10 text-white shadow-[0_24px_70px_-32px_rgba(15,23,42,0.6)] lg:block">
          <div className="mb-12 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-bold ring-1 ring-white/15">DL</div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Devign Lead Forge</p>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.05em]">A secure queue for focused agents.</h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-300">Use your team account to manage prospects, claim work, and keep ownership clear from first contact to close.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-300"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Password-protected team workspace</div>
        </div>

        <div className="mx-auto w-full max-w-md rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)] sm:p-10">
          <div className="mb-8 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-bold text-white">DL</div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Team access</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">{isSignUp ? "Create your account" : "Welcome back"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{isSignUp ? "Set up a password-protected agent account." : "Sign in to open the shared lead queue."}</p>

          {!isConfigured && (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-bold">Supabase Auth keys missing</p>
              <p className="mt-1 text-xs leading-5">Please configure <code className="font-mono font-semibold">VITE_SUPABASE_URL</code> and <code className="font-mono font-semibold">VITE_SUPABASE_PUBLISHABLE_KEY</code> in your Vercel project environment variables and trigger a redeploy.</p>
            </div>
          )}

          <form onSubmit={submit} className="mt-8 space-y-4">
            {isSignUp && <div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor="full-name">Full name</label><Input id="full-name" value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Alex Morgan" autoComplete="name" required className="h-11 rounded-xl border-slate-200 bg-slate-50/60" /></div>}
            <div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor="auth-email">Email</label><Input id="auth-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" autoComplete="email" required className="h-11 rounded-xl border-slate-200 bg-slate-50/60" /></div>
            <div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor="auth-password">Password</label><Input id="auth-password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 6 characters" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={6} required className="h-11 rounded-xl border-slate-200 bg-slate-50/60" /></div>
            {notice && <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm leading-5 text-emerald-800">{notice}</p>}
            <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl bg-slate-950 font-semibold text-white hover:bg-slate-800">{pending ? "Working..." : isSignUp ? "Create account" : "Sign in"}</Button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500"><LockKeyhole className="h-3.5 w-3.5" /> Passwords are managed by Supabase Auth.</div>
          <button type="button" onClick={() => { setMode(isSignUp ? "signin" : "signup"); setNotice(null); }} className="mt-6 w-full text-center text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950">{isSignUp ? "Already have an account? Sign in" : "Need an account? Create one"}</button>
        </div>
      </div>
    </div>
  );
}
