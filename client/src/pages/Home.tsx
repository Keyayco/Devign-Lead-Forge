import DashboardLayout from "@/components/DashboardLayout";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Filter,
  Link2,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type StatusValue = "finessing" | "sold" | "cold" | "pipeline";

type LeadFormState = {
  name: string;
  contact: string;
  email: string;
  address: string;
  type: string;
  demoLink: string;
  notes: string;
  status: StatusValue;
};

const emptyForm: LeadFormState = {
  name: "",
  contact: "",
  email: "",
  address: "",
  type: "",
  demoLink: "",
  notes: "",
  status: "finessing",
};

const typeSuggestions = ["SaaS", "Agency", "E-commerce", "Services", "Other"];
const statusOptions = [
  { value: "finessing", label: "Finessing", detail: "Currently working / on standby" },
  { value: "sold", label: "Sold", detail: "Closed successfully" },
  { value: "cold", label: "Cold", detail: "No response / not interested" },
  { value: "pipeline", label: "Pipeline customer", detail: "Returning customer" },
] as const;

export default function Home() {
  return (
    <DashboardLayout>
      <LeadWorkspace />
    </DashboardLayout>
  );
}

function LeadWorkspace() {
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [claimStatus, setClaimStatus] = useState<"all" | "claimed" | "unclaimed">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusValue>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [form, setForm] = useState<LeadFormState>(emptyForm);
  const [deleteLeadId, setDeleteLeadId] = useState<string | null>(null);

  const queryInput = useMemo(
    () => ({ search: search.trim() || undefined, type: typeFilter, claimStatus, status: statusFilter }),
    [search, typeFilter, claimStatus, statusFilter],
  );
  const leadsQuery = trpc.leads.list.useQuery(queryInput, {
    enabled: isAuthenticated,
  });
  const utils = trpc.useUtils();

  const createMutation = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead added to the queue");
      setFormOpen(false);
      setForm(emptyForm);
      void utils.leads.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      toast.success("Lead details updated");
      setFormOpen(false);
      setEditingLeadId(null);
      setForm(emptyForm);
      void utils.leads.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const claimMutation = trpc.leads.claim.useMutation({
    onSuccess: () => {
      toast.success("Lead claimed — it is now locked to you");
      void utils.leads.list.invalidate();
    },
    onError: error => {
      toast.error(error.message);
      void utils.leads.list.invalidate();
    },
  });
  const deleteMutation = trpc.leads.remove.useMutation({
    onSuccess: () => {
      toast.success("Lead removed");
      setDeleteLeadId(null);
      void utils.leads.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const leads = leadsQuery.data ?? [];
  const stats = useMemo(() => {
    const claimed = leads.filter(lead => lead.claimedByUserId !== null).length;
    const mine = leads.filter(lead => lead.claimedByUserId === user?.id).length;
    return { total: leads.length, claimed, unclaimed: leads.length - claimed, mine };
  }, [leads, user?.id]);
  const types = useMemo(() => {
    const values = new Set(leads.map(lead => lead.type));
    return Array.from(new Set([...typeSuggestions, ...Array.from(values)])).sort();
  }, [leads]);

  const openCreate = () => {
    setEditingLeadId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (lead: (typeof leads)[number]) => {
    setEditingLeadId(lead.id);
    setForm({
      name: lead.name,
      contact: lead.contact,
      email: lead.email,
      address: lead.address,
      type: lead.type,
      demoLink: lead.demoLink,
      notes: lead.notes,
      status: lead.status,
    });
    setFormOpen(true);
  };

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (editingLeadId) {
      updateMutation.mutate({ id: editingLeadId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const deleteTarget = leads.find(lead => lead.id === deleteLeadId);

  return (
    <div className="min-h-screen px-3 py-4 sm:px-7 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]" />
              Live workspace
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">Leads, in motion.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">A focused queue for your team to organize prospects, share context, and move the right conversations forward.</p>
          </div>
          <Button onClick={openCreate} className="h-11 w-full rounded-xl bg-slate-950 px-5 font-semibold text-white sm:w-auto shadow-[0_8px_18px_-10px_rgba(15,23,42,0.7)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:translate-y-0">
            <Plus className="mr-2 h-4 w-4" />
            Add lead
          </Button>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-2 sm:mb-7 sm:gap-3 xl:grid-cols-4" aria-label="Lead summary">
          <StatCard label="Total leads" value={stats.total} detail="in your current view" icon={<Users className="h-4 w-4" />} tone="dark" />
          <StatCard label="Unclaimed" value={stats.unclaimed} detail="ready for an agent" icon={<CircleAlert className="h-4 w-4" />} tone="warm" />
          <StatCard label="Claimed" value={stats.claimed} detail="locked to an owner" icon={<LockKeyhole className="h-4 w-4" />} tone="blue" />
          <StatCard label="Claimed by you" value={stats.mine} detail="your active queue" icon={<UserRound className="h-4 w-4" />} tone="green" />
        </section>

        <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-[0_20px_60px_-38px_rgba(15,23,42,0.42)]">
          <CardContent className="p-0">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:gap-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-slate-950">Lead queue</h2>
                <p className="mt-1 text-sm text-slate-400">Search, filter, and claim work without stepping on another agent’s queue.</p>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-400 sm:justify-start">
                <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 sm:inline-flex">{stats.total} visible</span>
                <Button variant="outline" size="icon" onClick={() => void leadsQuery.refetch()} className="h-9 w-9 rounded-xl border-slate-200 bg-white" aria-label="Refresh leads">
                  <RefreshCw className={`h-4 w-4 ${leadsQuery.isFetching ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/60 p-3 sm:p-5 lg:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by lead name..." className="h-10 rounded-xl border-slate-200 bg-white pl-10 text-sm shadow-none focus-visible:ring-slate-950" aria-label="Search leads by name" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="Clear search"><X className="h-4 w-4" /></button>}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="relative min-w-[170px]">
                  <SlidersHorizontal className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10" aria-label="Filter by lead type">
                    <option value="all">All types</option>
                    {types.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </label>
                <label className="relative min-w-[180px]">
                  <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <select value={claimStatus} onChange={event => setClaimStatus(event.target.value as typeof claimStatus)} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10" aria-label="Filter by claim status">
                    <option value="all">All claim status</option>
                    <option value="unclaimed">Unclaimed</option>
                    <option value="claimed">Claimed</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </label>
                <label className="relative min-w-[180px]">
                  <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as "all" | StatusValue)} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10" aria-label="Filter by lead status">
                    <option value="all">All lead status</option>
                    {statusOptions.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </label>
              </div>
            </div>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-white">
                  <tr className="border-b border-slate-100 text-left">
                    <TableHeader> Name </TableHeader>
                    <TableHeader> Contact </TableHeader>
                    <TableHeader> Email </TableHeader>
                    <TableHeader> Address </TableHeader>
                    <TableHeader> Type </TableHeader>
                    <TableHeader> Demo Link </TableHeader>
                    <TableHeader> Notes </TableHeader>
                    <TableHeader> Status </TableHeader>
                    <TableHeader> Claim status </TableHeader>
                    <TableHeader><span className="sr-only">Actions</span></TableHeader>
                  </tr>
                </thead>
                <tbody>
                  {leadsQuery.isLoading ? (
                    <LoadingRows />
                  ) : leadsQuery.isError ? (
                    <tr><td colSpan={10} className="p-12 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><CircleAlert className="mb-3 h-6 w-6 text-red-500" /><p className="font-semibold text-slate-800">Couldn’t load the queue</p><p className="mt-1 text-sm text-slate-400">Refresh the page and try again.</p></div></td></tr>
                  ) : leads.length === 0 ? (
                    <tr><td colSpan={10} className="p-14 text-center"><div className="mx-auto flex max-w-sm flex-col items-center"><div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><Search className="h-5 w-5 text-slate-400" /></div><p className="font-semibold text-slate-800">No leads match this view</p><p className="mt-1 text-sm text-slate-400">Try adjusting your filters or add a new lead to get started.</p></div></td></tr>
                  ) : (
                    leads.map(lead => {
                      const isMine = lead.claimedByUserId === user?.id;
                      const isLocked = lead.claimedByUserId !== null;
                      const claimedName = lead.claimedByName || lead.claimedByEmail || "Another agent";
                      return (
                        <tr key={lead.id} className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                          <td className="px-5 py-4 align-top"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">{initials(lead.name)}</div><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{lead.name}</p><p className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Lead #{String(lead.id).padStart(4, "0")}</p></div></div></td>
                          <td className="px-5 py-4 align-top text-slate-600">{lead.contact}</td>
                          <td className="max-w-[230px] truncate px-5 py-4 align-top text-slate-600" title={lead.email}>{lead.email}</td>
                          <td className="max-w-[230px] truncate px-5 py-4 align-top text-slate-500" title={lead.address}>{lead.address}</td>
                          <td className="px-5 py-4 align-top"><Badge variant="secondary" className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">{lead.type}</Badge></td>
                          <td className="px-5 py-4 align-top">{lead.demoLink ? <a href={lead.demoLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 transition-colors hover:text-slate-950 hover:decoration-slate-950"><Link2 className="h-3.5 w-3.5" />View demo<ArrowUpRight className="h-3 w-3" /></a> : <span className="text-slate-300">—</span>}</td>
                          <td className="max-w-[240px] truncate px-5 py-4 align-top text-slate-500" title={lead.notes}>{lead.notes || <span className="text-slate-300">—</span>}</td>
                          <td className="px-5 py-4 align-top"><StatusBadge status={lead.status} /> </td>
                          <td className="px-5 py-4 align-top">
                            {isLocked ? <div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${isMine ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}><LockKeyhole className="h-3.5 w-3.5" /></span><div><p className={`text-xs font-bold ${isMine ? "text-emerald-700" : "text-amber-700"}`}>{isMine ? "Claimed by you" : "Locked"}</p><p className="mt-0.5 max-w-[145px] truncate text-[11px] text-slate-400" title={claimedName}>{isMine ? "Your active lead" : claimedName}</p></div></div> : <Button onClick={() => claimMutation.mutate({ id: lead.id })} disabled={claimMutation.isPending} variant="outline" className="h-9 rounded-xl border-emerald-200 bg-emerald-50/50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"><Check className="mr-1.5 h-3.5 w-3.5" />Claim lead</Button>}
                          </td>
                          <td className="px-5 py-4 align-top">{isLocked && !isMine ? <div className="flex items-center justify-end gap-2 text-xs font-semibold text-slate-400" title={`Locked to ${claimedName}`}><LockKeyhole className="h-3.5 w-3.5" />Locked</div> : <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100"><Button onClick={() => openEdit(lead)} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={`Edit ${lead.name}`}><Pencil className="h-3.5 w-3.5" /></Button><Button onClick={() => setDeleteLeadId(lead.id)} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${lead.name}`}><Trash2 className="h-3.5 w-3.5" /></Button></div>}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 sm:hidden">
              {leadsQuery.isLoading ? <LoadingCards /> : leadsQuery.isError ? <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-center"><CircleAlert className="mx-auto mb-2 h-5 w-5 text-red-500" /><p className="text-sm font-semibold text-red-800">Couldn’t load the queue</p><p className="mt-1 text-xs text-red-700/70">Refresh the page and try again.</p></div> : leads.length === 0 ? <div className="rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center"><Search className="mx-auto mb-2 h-5 w-5 text-slate-400" /><p className="text-sm font-semibold text-slate-800">No leads match this view</p><p className="mt-1 text-xs text-slate-400">Add a new lead to get started.</p></div> : leads.map(lead => <MobileLeadCard key={lead.id} lead={lead} userId={user?.id} onEdit={() => openEdit(lead)} onDelete={() => setDeleteLeadId(lead.id)} onClaim={() => claimMutation.mutate({ id: lead.id })} claimPending={claimMutation.isPending} />)}
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6"><span>Claims are identity-locked and protected for the owning agent.</span><span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600"><CircleCheck className="h-3.5 w-3.5" />Team-ready</span></div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl border-slate-200 p-0 sm:w-full sm:max-w-2xl">
          <form onSubmit={submitForm}>
            <DialogHeader className="border-b border-slate-100 px-4 py-4 text-left sm:px-6 sm:py-5"><DialogTitle className="text-xl tracking-tight text-slate-950">{editingLeadId ? "Edit lead" : "Add a new lead"}</DialogTitle><DialogDescription className="mt-1">Keep the details crisp so the next agent can take action quickly.</DialogDescription></DialogHeader>
            <div className="grid gap-4 px-4 py-5 sm:gap-5 sm:px-6 sm:py-6 sm:grid-cols-2">
              <Field label="Name" value={form.name} onChange={value => setForm({ ...form, name: value })} placeholder="Acme Corporation" required />
              <Field label="Contact" value={form.contact} onChange={value => setForm({ ...form, contact: value })} placeholder="Jordan Lee · +1 555 0100" />
              <Field label="Email" type="email" value={form.email} onChange={value => setForm({ ...form, email: value })} placeholder="jordan@acme.com" />
              <Field label="Type" value={form.type} onChange={value => setForm({ ...form, type: value })} placeholder="SaaS" list="lead-types" />
              <div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor="status">Status</label><select id="status" value={form.status} onChange={event => setForm({ ...form, status: event.target.value as LeadFormState["status"] })} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm text-slate-700 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10">{statusOptions.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor="address">Address <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></label><Textarea id="address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} placeholder="Street, city, region" className="min-h-20 resize-none rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-slate-950 sm:min-h-24" /></div>
              <div className="sm:col-span-2"><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor="notes">Notes <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span></label><Textarea id="notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Add context, next steps, or follow-up details" className="min-h-24 resize-y rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-slate-950" /></div>
              <div className="sm:col-span-2"><Field label="Demo Link" type="url" value={form.demoLink} onChange={value => setForm({ ...form, demoLink: value })} placeholder="https://example.com/demo" /><p className="mt-2 text-xs text-slate-400">Optional. Add a full URL when a demo is available.</p></div>
              <datalist id="lead-types">{typeSuggestions.map(type => <option key={type} value={type} />)}</datalist>
            </div>
            <DialogFooter className="flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-end sm:px-6"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="w-full rounded-xl border-slate-200 sm:w-auto">Cancel</Button><Button type="submit" disabled={isSaving} className="w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800 sm:w-auto">{isSaving ? "Saving..." : editingLeadId ? "Save changes" : "Add lead"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteLeadId !== null} onOpenChange={open => !open && setDeleteLeadId(null)}>
        <AlertDialogContent className="rounded-2xl border-slate-200">
          <AlertDialogHeader><AlertDialogTitle>Delete {deleteTarget?.name ?? "this lead"}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the lead from the shared queue. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel className="rounded-xl border-slate-200">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteLeadId && deleteMutation.mutate({ id: deleteLeadId })} className="rounded-xl bg-red-600 text-white hover:bg-red-700">Delete lead</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: "dark" | "warm" | "blue" | "green" }) {
  const tones = { dark: "bg-slate-950 text-white", warm: "bg-[#fffaf2] text-slate-900 border-amber-100", blue: "bg-[#f5f8ff] text-slate-900 border-blue-100", green: "bg-[#f2fbf6] text-slate-900 border-emerald-100" };
  const iconTones = { dark: "bg-white/10 text-slate-200", warm: "bg-amber-100 text-amber-700", blue: "bg-blue-100 text-blue-700", green: "bg-emerald-100 text-emerald-700" };
  return <div className={`rounded-2xl border p-3 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.4)] sm:p-5 ${tones[tone]}`}><div className="flex items-start justify-between"><p className={`text-xs font-bold uppercase tracking-[0.16em] ${tone === "dark" ? "text-slate-400" : "text-slate-400"}`}>{label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconTones[tone]}`}>{icon}</span></div><p className="mt-4 text-2xl font-semibold tracking-[-0.05em] sm:mt-5 sm:text-3xl">{value}</p><p className={`mt-1 text-xs ${tone === "dark" ? "text-slate-400" : "text-slate-400"}`}>{detail}</p></div>;
}

type MobileLead = {
  id: string;
  name: string;
  contact: string;
  email: string;
  address: string;
  type: string;
  demoLink: string;
  notes: string;
  status: StatusValue;
  claimedByUserId: string | null;
  claimedByName: string | null;
  claimedByEmail: string | null;
};

function LoadingCards() {
  return <>{[1, 2].map(item => <div key={item} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}</>;
}

function MobileLeadCard({ lead, userId, onEdit, onDelete, onClaim, claimPending }: { lead: MobileLead; userId?: string; onEdit: () => void; onDelete: () => void; onClaim: () => void; claimPending: boolean }) {
  const isMine = lead.claimedByUserId === userId;
  const isLocked = lead.claimedByUserId !== null;
  const claimedName = lead.claimedByName || lead.claimedByEmail || "Another agent";
  return <article className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.5)]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">{initials(lead.name)}</div><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-slate-900">{lead.name}</h3><p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">Lead #{String(lead.id).padStart(4, "0")}</p></div></div><StatusBadge status={lead.status} />
      <div className="flex shrink-0 items-center gap-1"><Button onClick={onEdit} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={`Edit ${lead.name}`}><Pencil className="h-3.5 w-3.5" /></Button><Button onClick={onDelete} variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Delete ${lead.name}`}><Trash2 className="h-3.5 w-3.5" /></Button></div>
    </div>
    <div className="mt-4 grid gap-2 text-xs text-slate-600"><div className="flex gap-2"><span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Contact</span><span className="min-w-0 break-words">{lead.contact || "—"}</span></div><div className="flex gap-2"><span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Email</span><span className="min-w-0 break-all">{lead.email || "—"}</span></div><div className="flex gap-2"><span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Type</span><span>{lead.type || "—"}</span></div><div className="flex gap-2"><span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Address</span><span className="min-w-0 break-words">{lead.address || "—"}</span></div><div className="flex gap-2"><span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Notes</span><span className="min-w-0 break-words">{lead.notes || "—"}</span></div>{lead.demoLink && <div className="flex gap-2"><span className="w-20 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Demo</span><a href={lead.demoLink} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 break-all font-semibold text-slate-700 underline underline-offset-4"><Link2 className="h-3.5 w-3.5 shrink-0" />Open demo<ArrowUpRight className="h-3 w-3 shrink-0" /></a></div>}</div>
    <div className="mt-4 border-t border-slate-100 pt-3">{isLocked ? <div className={`flex items-center gap-2 text-xs font-bold ${isMine ? "text-emerald-700" : "text-amber-700"}`}><LockKeyhole className="h-3.5 w-3.5" />{isMine ? "Claimed by you" : `Locked to ${claimedName}`}</div> : <Button onClick={onClaim} disabled={claimPending} variant="outline" className="h-9 w-full rounded-xl border-emerald-200 bg-emerald-50/50 text-xs font-bold text-emerald-700 hover:bg-emerald-100"><Check className="mr-1.5 h-3.5 w-3.5" />Claim lead</Button>}</div>
  </article>;
}

function StatusBadge({ status }: { status: "finessing" | "sold" | "cold" | "pipeline" }) {
  const option = statusOptions.find(item => item.value === status) ?? statusOptions[0];
  const tones = { finessing: "bg-blue-50 text-blue-700 ring-blue-100", sold: "bg-emerald-50 text-emerald-700 ring-emerald-100", cold: "bg-slate-100 text-slate-600 ring-slate-200", pipeline: "bg-violet-50 text-violet-700 ring-violet-100" };
  return <Badge variant="secondary" className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset ${tones[status]}`} title={option.detail}>{option.label}</Badge>;
}

function TableHeader({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{children}</th>;
}

function LoadingRows() {
  return <>{[1, 2, 3, 4].map(row => <tr key={row} className="border-b border-slate-100"><td colSpan={10} className="px-5 py-4"><div className="h-10 animate-pulse rounded-xl bg-slate-100" /></td></tr>)}</>;
}

function Field({ label, value, onChange, placeholder, type = "text", required, list }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; required?: boolean; list?: string }) {
  return <div><label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500" htmlFor={`field-${label}`}>{label}{required ? <span className="ml-1 text-red-500" aria-hidden="true">*</span> : <span className="ml-1 font-medium normal-case tracking-normal text-slate-400">(optional)</span>}</label><Input id={`field-${label}`} type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} required={required} list={list} className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus-visible:ring-slate-950" /></div>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}
