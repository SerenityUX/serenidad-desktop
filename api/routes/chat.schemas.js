// Boundary schemas for /chat routes.
//
// One file colocated with the route module so schemas can move in lockstep
// with route changes. Every body these schemas describe must be considered
// the *only* trusted input — handlers should read from req.validated.body,
// not req.body, after the validate() middleware runs.

const { z } = require("zod");

const UUID = z.string().uuid();

// 1) Free-form prompt text. Capped at 8K to avoid OpenRouter prompt-blow-up
//    or DB row bloat. The chat agent itself trims at 4K when building tool
//    results — this is the outermost cap.
const PROMPT = z.string().max(8000);

// 2) An attachment chip the client sends with a chat message — either an
//    image URL the user uploaded, or a structured ref (frame / character).
//    Use a discriminated union so unknown attachment kinds reject up front.
const Attachment = z.union([
  z.object({ url: z.string().url() }).strict(),
  z
    .object({
      kind: z.literal("ref"),
      type: z.enum(["frame", "character"]),
      sceneIndex: z.number().int().min(1).optional(),
      id: z.string().optional(),
      label: z.string().max(120).optional(),
    })
    .passthrough(), // server attaches additional fields downstream; tolerate.
]);

const ContextRef = z
  .object({
    type: z.enum(["frame", "character"]),
    sceneIndex: z.number().int().min(1).optional(),
    id: z.string().optional(),
    label: z.string().max(120).optional(),
  })
  .passthrough();

// POST /chat/projects/:projectId/messages
const PostMessageBody = z
  .object({
    message: PROMPT.optional().default(""),
    attachments: z.array(Attachment).max(10).optional().default([]),
    contextRefs: z.array(ContextRef).max(12).optional().default([]),
  })
  .superRefine((v, ctx) => {
    // The route already enforces "must have at least one of" — surface that
    // here so a malformed body fails before the SSE handshake opens.
    if (
      !v.message.trim() &&
      v.attachments.length === 0 &&
      v.contextRefs.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide message, attachments, or contextRefs",
      });
    }
  });

// POST /chat/projects/:projectId/messages/runs/:runId/resolve
const ResolveBody = z.object({
  decisions: z
    .array(
      z
        .object({
          toolCallId: z.string().min(1),
          action: z.enum(["approve", "skip"]),
          overrides: z
            .object({
              prompt: PROMPT.optional(),
              modelId: z.string().optional(),
            })
            .strict()
            .optional(),
        })
        .strict(),
    )
    .max(50),
});

// Common params.
const ProjectIdParams = z.object({ projectId: UUID });
const ProjectIdRunIdParams = z.object({ projectId: UUID, runId: UUID });

module.exports = {
  PostMessageBody,
  ResolveBody,
  ProjectIdParams,
  ProjectIdRunIdParams,
};
