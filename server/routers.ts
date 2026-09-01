import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import {
  claimLead,
  createLead,
  deleteLead,
  getLeadById,
  getLeadWithClaimer,
  listLeads,
  updateLead,
} from "./db.js";

const leadFields = {
  name: z.string().trim().min(1, "Name is required").max(160),
  contact: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").max(320).optional().or(z.literal("")),
  address: z.string().trim().max(1000).optional().or(z.literal("")),
  type: z.string().trim().max(96).optional().or(z.literal("")),
  demoLink: z.string().trim().url("Enter a valid demo link").max(512).optional().or(z.literal("")),
};

const leadInput = z.object(leadFields);
const leadIdInput = z.object({ id: z.string().uuid("Lead id must be a UUID") });

async function assertLeadAccess(id: string, userId: string) {
  const existing = await getLeadById(id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
  }
  if (existing.claimed_by && existing.claimed_by !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This lead is locked to the claiming agent",
    });
  }
  return existing;
}

function requireAccessToken(accessToken: string | null): string {
  if (!accessToken) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Supabase access token is required" });
  }
  return accessToken;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
  }),

  leads: router({
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            type: z.string().optional(),
            claimStatus: z.enum(["all", "claimed", "unclaimed"]).default("all"),
          })
          .optional(),
      )
      .query(({ input }) => listLeads(input)),

    create: protectedProcedure
      .input(leadInput)
      .mutation(async ({ input, ctx }) => createLead(ctx.user.id, input)),

    update: protectedProcedure
      .input(leadInput.extend({ id: z.string().uuid("Lead id must be a UUID") }))
      .mutation(async ({ input, ctx }) => {
        await assertLeadAccess(input.id, ctx.user.id);
        const { id, ...fields } = input;
        return updateLead(id, fields);
      }),

    remove: protectedProcedure
      .input(leadIdInput)
      .mutation(async ({ input, ctx }) => {
        await assertLeadAccess(input.id, ctx.user.id);
        await deleteLead(input.id);
        return { success: true } as const;
      }),

    claim: protectedProcedure
      .input(leadIdInput)
      .mutation(async ({ input, ctx }) => {
        const existing = await getLeadById(input.id);
        if (!existing) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
        }
        if (existing.claimed_by) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This lead has already been claimed",
          });
        }

        const claimed = await claimLead(requireAccessToken(ctx.accessToken), input.id);
        if (!claimed) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This lead was claimed by another agent just now",
          });
        }
        return getLeadWithClaimer(input.id);
      }),
  }),
});

export type AppRouter = typeof appRouter;
