const express = require("express");
const multer = require("multer");
const { fal } = require("@fal-ai/client");
const {
  FAL_IMAGE_MODELS,
  DEFAULT_MODEL_ID,
  resolveModelOrDefault,
} = require("../lib/falModels");
const { PROJECT_STYLES, isValidStyleLabel, resolveStyleSuffix } = require("../lib/styles");
const { generateFalImage } = require("../lib/falImage");
const { applyCharacterPrompt } = require("../lib/characterPrompt");
const { extractMentionedCharacters, findUnmentionedCharacters } = require("../lib/mentions");
const {
  transcribeAudio,
  synthesizeSpeech,
  getFalCredentials,
} = require("../lib/voicePrompt");
const { emit } = require("../lib/realtime");
const { validate } = require("../lib/validate");
const {
  PostMessageBody,
  ResolveBody,
  ProjectIdParams,
  ProjectIdRunIdParams,
} = require("./chat.schemas");

const VOICE_TOKEN_COST = 1;
const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (s) => typeof s === "string" && UUID_RE.test(s);

// Sonnet via OpenRouter. Prompt caching (system + tools) is enabled below
// via cache_control breakpoints — keeps the steady-state cost close to
// Flash while getting much better tool routing.
const CHAT_MODEL = "anthropic/claude-sonnet-4.5";

const SYSTEM_PROMPT = `You are CoCreate, a creative collaborator inside an anime storyboard editor. You can read and modify the storyboard with tools. When the user asks you to "make N frames", "implement", "build out the storyboard", USE THE TOOLS — don't ask the user to do it manually.

# Always-on workflow

Before any tool call that touches scenes or characters, ORIENT YOURSELF first:
  1. Call \`list_scenes\` AND \`list_characters\` whenever you start a new task or you don't already know the current state from this turn. This is cheap and the only way to avoid duplicate scenes / misnamed characters / forgetting voicelines that already exist.
  2. After orienting, decide between EDIT and ADD:
     - User asked to revise / iterate / fix / adjust → EDIT existing scenes via \`set_scene\` (or \`edit_scene_prompt\`).
     - User asked for a fresh storyboard or new beats that don't exist yet → \`delete_empty_scenes\` first, then \`add_scene\` for each new beat.
     - Ambiguous? Briefly ask which they want before mutating.
  3. Never blindly \`add_scene\` when scenes with similar content already exist — you'll stack duplicates. \`list_scenes\` returns \`totalScenes\` indirectly via the size of the array; \`add_scene\`'s response also returns \`totalScenes\`.

# Characters

\`create_character\` is idempotent — if the name already exists you get back the existing character with \`alreadyExisted: true\` instead of an error. Just call it whenever you introduce a name; you don't need to guard with \`list_characters\`. Use \`update_character\` to revise a bio, \`regenerate_character_portrait\` to redo a portrait, \`delete_character\` only when the user explicitly asks.

NEVER claim in your reply that you "created" or "added" a character unless you actually called \`create_character\` in this turn and saw a successful result.

# Scene prompts — the @ rule (CRITICAL)

Every named character that APPEARS or SPEAKS in a scene MUST be prefixed with \`@\` in the scene's prompt. The \`@\` is the binding signal: without it the diffusion model has no portrait reference and the character's identity drifts scene-to-scene.

  - Right: "@Cook Ding pauses, knife poised, looking toward @Lord Wenhui with a calm smile."
  - Wrong: "Cook Ding pauses, knife poised, looking toward Lord Wenhui."

Multi-word names work — keep the space: "@Lord Smith". Mention order = slot order; first @-mention is Character1, etc.

Tool results from \`add_scene\`, \`edit_scene_prompt\`, and \`set_scene\` include a \`warning\` and \`unmentionedCharacters\` field when the prompt mentions a known character without \`@\`. If you see that warning, call \`set_scene\` immediately with the corrected prompt — don't wait for the user to ask.

# What goes in a prompt vs other fields

Scene prompts are VISUAL ONLY: action, environment, camera angle, lighting, mood, expression. Never include:
  - Spoken dialogue (use the \`voiceline\` arg).
  - On-screen text (use the \`caption\` arg; defaults to voiceline).
  - The project's visual style ("Ghibli style", "anime", "Miyazaki") — that's auto-appended from the project's Visual Style property. Use \`set_project_style\` only if the user explicitly asks to change it.
  - Re-descriptions of a character's appearance — the reference portrait carries identity. Describe what they're DOING, not what they look like.

# Editing scenes

Prefer \`set_scene\` over the older \`edit_scene_prompt\` + \`set_scene_voiceline\` + \`set_scene_model\` triplet — it patches all fields in one call. Only fields you pass are changed; others stay as-is.

# Generating images

\`generate_scene\` proposes an image generation; the user approves before tokens are spent. You can propose multiple in one turn — each becomes its own approval card. Don't generate without being asked, and don't redo generations that already exist (\`list_scenes\` returns \`generated: true\` and \`result\` URL when art is present) unless the user requests it.

# Tone

Keep replies concise. Markdown is fine. Don't recite a list of every action you took unless the user asks — the tool-call pills already show that.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_scenes",
      description:
        "List all storyboard scenes in this project with index, prompt, current model, references, and the result image URL.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_characters",
      description: "List all characters defined in this project.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_models",
      description: "List the available image generation models.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_scene_prompt",
      description: "Replace the prompt text of a scene (1-based index).",
      parameters: {
        type: "object",
        properties: {
          sceneIndex: { type: "integer", minimum: 1 },
          prompt: { type: "string" },
        },
        required: ["sceneIndex", "prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_scene_model",
      description:
        "Set the image generation model for a scene. Use list_models to discover valid IDs.",
      parameters: {
        type: "object",
        properties: {
          sceneIndex: { type: "integer", minimum: 1 },
          modelId: { type: "string" },
        },
        required: ["sceneIndex", "modelId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_styles",
      description: "List the catalogued visual styles available for this project.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "set_project_style",
      description:
        "Set the project's visual style. The label is appended to every future generation prompt to keep the storyboard visually consistent.",
      parameters: {
        type: "object",
        properties: { label: { type: "string" } },
        required: ["label"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_scene",
      description:
        "Append a new scene (frame) to the end of the storyboard. Optionally seed it with a prompt, model, and/or a voiceline (the spoken dialogue + caption for the scene). Pass voiceline here to avoid a separate set_scene_voiceline call when you already know the line.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string" },
          modelId: { type: "string" },
          voiceline: {
            type: "string",
            description:
              "Spoken dialogue for the scene (e.g. \"I won't let you go\"). Mirrored to the on-screen caption unless `caption` is provided.",
          },
          caption: {
            type: "string",
            description: "On-screen caption text. Defaults to `voiceline` if omitted.",
          },
          speaker: {
            type: "string",
            description: "Optional speaker name (typically the @-mentioned character). Used for TTS voice selection.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_scene",
      description: "Delete a scene by 1-based index.",
      parameters: {
        type: "object",
        properties: { sceneIndex: { type: "integer", minimum: 1 } },
        required: ["sceneIndex"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_reference_to_scene",
      description:
        "Add a reference image to a scene. Pass exactly one of: characterId (to use that character's portrait), sourceSceneIndex (to use that scene's existing image), or imageUrl.",
      parameters: {
        type: "object",
        properties: {
          sceneIndex: { type: "integer", minimum: 1 },
          characterId: { type: "string" },
          sourceSceneIndex: { type: "integer", minimum: 1 },
          imageUrl: { type: "string" },
        },
        required: ["sceneIndex"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_character",
      description:
        "Create a new project character with a generated portrait. Use this whenever the user invents a character (\"add a character named Kirito who...\") so they can be @-mentioned in scene prompts and bound to scenes for consistency. The portrait is auto-generated from name+description unless skipPortrait is true.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          skipPortrait: { type: "boolean" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_character",
      description:
        "Update an existing character's name and/or description. Pass characterId or characterName to identify them.",
      parameters: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          characterName: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "regenerate_character_portrait",
      description:
        "Regenerate a character's portrait image based on their current (or updated) name and description. Use when the user asks to redo, refresh, change the look, etc.",
      parameters: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          characterName: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_character",
      description:
        "Permanently delete a project character. Use when the user explicitly asks to remove or delete a character. Pass exactly one of characterId or characterName.",
      parameters: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          characterName: { type: "string" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_empty_scenes",
      description:
        "Delete all scenes that have NO generated image yet (the still-empty placeholders the project starts with). Use this BEFORE add_scene when the user asks for a multi-scene plan, so the new storyboard doesn't sit awkwardly after the seed empty frames. Scenes that already have a generated image are preserved by default — pass `includeGenerated: true` only when the user explicitly asks to wipe everything.",
      parameters: {
        type: "object",
        properties: {
          includeGenerated: {
            type: "boolean",
            description:
              "If true, also delete scenes that already have generations. Off by default — only set when the user explicitly says to remove existing artwork.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_scene_voiceline",
      description:
        "Set the spoken voiceline (and matching on-screen caption) for a scene. Use this when a character speaks in the scene. The `voiceline` is what the character actually SAYS in their own words (e.g. \"I won't let you go\") — NOT a description of speaking. The same text is mirrored to the on-screen caption by default; pass a different `caption` only if the displayed text should differ from the spoken line. In the SCENE PROMPT itself, describe the action with @Name (e.g. \"@Remy speaks at the dinner table, hand on the wine glass\") — never put dialogue in the image-generation prompt, since the diffusion model can't render it. Not every scene needs a voiceline; only call this when the user wants spoken dialogue in a scene.",
      parameters: {
        type: "object",
        properties: {
          sceneIndex: { type: "integer", minimum: 1 },
          voiceline: {
            type: "string",
            description: "What the character actually says aloud.",
          },
          caption: {
            type: "string",
            description: "On-screen caption text. Defaults to `voiceline` if omitted.",
          },
          speaker: {
            type: "string",
            description: "Optional speaker name (typically the @-mentioned character). Used for TTS voice selection.",
          },
        },
        required: ["sceneIndex", "voiceline"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_scene",
      description:
        "Update one or more fields of an existing scene in a single call. Pass sceneIndex plus any subset of: prompt, voiceline, caption, modelId, speaker. Only the fields you provide are changed; others stay as-is. PREFER THIS over edit_scene_prompt + set_scene_voiceline + set_scene_model when iterating on a scene — it's one tool call instead of three. Same rules: scene prompts are visual descriptions only (action, environment, camera, mood) with @Name for any character that appears or speaks; voicelines/captions hold the actual dialogue text.",
      parameters: {
        type: "object",
        properties: {
          sceneIndex: { type: "integer", minimum: 1 },
          prompt: {
            type: "string",
            description:
              "Visual description of the scene. MUST include @Name for every character appearing or speaking in this scene. Never put spoken dialogue here.",
          },
          voiceline: {
            type: "string",
            description:
              "Spoken dialogue (what the character actually says aloud). Pass empty string to clear.",
          },
          caption: {
            type: "string",
            description:
              "On-screen caption text. Defaults to `voiceline` when voiceline is set and caption is omitted. Pass empty string to clear.",
          },
          modelId: { type: "string" },
          speaker: {
            type: "string",
            description:
              "Speaker name for TTS (typically the @-mentioned character). Pass empty string to clear.",
          },
        },
        required: ["sceneIndex"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_scene",
      description:
        "Propose generating the image for a scene. The server will pause and ask the user to approve before spending tokens. Pass sceneIndex (1-based). Optionally include `prompt` to override the scene's stored prompt for this generation, and `modelId` to override its stored model. After approval the server runs the generation and returns the result image URL; on skip it returns {skipped:true}. Use this when the user asks to render, draw, or generate a scene image.",
      parameters: {
        type: "object",
        properties: {
          sceneIndex: { type: "integer", minimum: 1 },
          prompt: { type: "string" },
          modelId: { type: "string" },
        },
        required: ["sceneIndex"],
      },
    },
  },
];

function getOpenRouterKey() {
  const raw =
    process.env.OPEN_ROUTER_API_TOKEN ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_TOKEN ||
    "";
  const trimmed = String(raw).trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return "";
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

async function getProjectIfAccessible(pool, projectId, user) {
  const userId = typeof user === "string" ? user : user?.id;
  const isAdmin = typeof user === "object" && user?.role === "admin";
  const r = await pool.query(
    `SELECT p.id, p.name, p.owner_id, p.frame_ids, p.style, p.width, p.height
     FROM projects p
     WHERE p.id = $1
       AND (
         $3
         OR p.owner_id = $2
         OR EXISTS (
           SELECT 1 FROM invites i
           WHERE i.project_id = p.id AND i.sent_to = $2
         )
       )`,
    [projectId, userId, isAdmin],
  );
  return r.rows[0] || null;
}

async function loadOrderedFrames(pool, project) {
  const ids = Array.isArray(project.frame_ids) ? project.frame_ids : [];
  if (ids.length === 0) return [];
  const r = await pool.query(
    `SELECT id, prompt, result, reference_urls, character_ids, model, meta, created_at
     FROM frames WHERE project_id = $1`,
    [project.id],
  );
  const byId = new Map(r.rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function resolveCharacter(pool, projectId, { characterId, characterName }) {
  if (characterId && isUuid(characterId)) {
    const r = await pool.query(
      `SELECT id, name, description, image_url FROM characters WHERE id = $1 AND project_id = $2`,
      [characterId, projectId],
    );
    return r.rows[0] || null;
  }
  if (characterName && typeof characterName === "string") {
    const r = await pool.query(
      `SELECT id, name, description, image_url FROM characters
        WHERE project_id = $1 AND lower(name) = lower($2)
        LIMIT 1`,
      [projectId, characterName.trim()],
    );
    return r.rows[0] || null;
  }
  return null;
}

async function loadCharactersOrderedFromIds(pool, projectId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const r = await pool.query(
    `SELECT id, name, description, image_url
       FROM characters
      WHERE project_id = $1 AND id = ANY($2::uuid[])`,
    [projectId, ids],
  );
  const byId = new Map(r.rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function loadCharacters(pool, projectId) {
  const r = await pool.query(
    `SELECT id, name, description, image_url FROM characters WHERE project_id = $1 ORDER BY created_at ASC`,
    [projectId],
  );
  return r.rows;
}

async function ensureChat(pool, projectId) {
  const existing = await pool.query(
    `SELECT id FROM chats WHERE project_id = $1`,
    [projectId],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const ins = await pool.query(
    `INSERT INTO chats (project_id) VALUES ($1)
     ON CONFLICT (project_id) DO UPDATE SET project_id = EXCLUDED.project_id
     RETURNING id`,
    [projectId],
  );
  return ins.rows[0].id;
}

const MESSAGE_SELECT = `
  SELECT m.id,
         m.chat_id,
         m.sent_by,
         m.role,
         m.message_contents,
         m.attachments,
         m.created_at,
         u.name AS sender_name,
         u.profile_picture AS sender_profile_picture,
         u.email AS sender_email
  FROM chat_messages m
  LEFT JOIN users u ON u.id = m.sent_by
`;

// Tool execution. `actorId` is the human user driving the agent — every event
// emitted from here carries source='agent' and actor_id=user so undo lands
// on that user's stack.
async function runTool(pool, project, name, args, ctx = {}) {
  const { actorId = null } = ctx;
  const emitOpts = { source: "agent", actorId };
  const sceneAt = async (index) => {
    const frames = await loadOrderedFrames(pool, project);
    if (!Number.isInteger(index) || index < 1 || index > frames.length) {
      return null;
    }
    return frames[index - 1];
  };

  switch (name) {
    case "list_scenes": {
      const frames = await loadOrderedFrames(pool, project);
      return frames.map((f, i) => {
        const meta = (f.meta && typeof f.meta === "object") ? f.meta : {};
        const captionSettings =
          meta.captionSettings && typeof meta.captionSettings === "object"
            ? meta.captionSettings
            : {};
        return {
          index: i + 1,
          frameId: f.id,
          prompt: f.prompt || "",
          model: f.model || null,
          references: Array.isArray(f.reference_urls) ? f.reference_urls : [],
          characterIds: Array.isArray(f.character_ids) ? f.character_ids : [],
          // Surface dialogue/caption state so the agent can iterate on
          // existing scenes instead of duplicating a voiceline it set on a
          // prior turn or rewriting one already authored manually.
          voiceline: meta.voiceline || "",
          caption: captionSettings.caption || "",
          speaker: meta.speaker || "",
          generated: Boolean(f.result),
          result: f.result || null,
          kind: meta.kind === "video" ? "video" : "image",
        };
      });
    }
    case "list_characters": {
      const list = await loadCharacters(pool, project.id);
      return list.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || "",
        imageUrl: c.image_url || null,
      }));
    }
    case "list_models": {
      return FAL_IMAGE_MODELS.map((m) => ({
        id: m.id,
        label: m.label,
        costTokens: m.costCents,
        supportsReferences: m.supportsReferences,
      }));
    }
    case "edit_scene_prompt": {
      const f = await sceneAt(args?.sceneIndex);
      if (!f) return { error: "Scene not found" };
      const prevPrompt = f.prompt || "";
      const nextPrompt = String(args.prompt || "");
      await pool.query(
        `UPDATE frames SET prompt = $1 WHERE id = $2 AND project_id = $3`,
        [nextPrompt, f.id, project.id],
      );
      await emit(
        pool,
        project.id,
        "frame.updated",
        { id: f.id, fields: { prompt: nextPrompt } },
        {
          ...emitOpts,
          inverse: {
            kind: "frame.updated",
            payload: { id: f.id, fields: { prompt: prevPrompt } },
          },
        },
      );
      // Surface bare-name occurrences so the agent immediately sees if it
      // forgot the @ prefix. Same warning shape used by add_scene/set_scene.
      const projChars = await loadCharacters(pool, project.id);
      const unmentioned = findUnmentionedCharacters(nextPrompt, projChars);
      const result = { ok: true, sceneIndex: args.sceneIndex, prompt: nextPrompt };
      if (unmentioned.length) {
        result.warning = `Prompt mentions ${unmentioned
          .map((n) => `"${n}"`)
          .join(", ")} without @ — call set_scene with the @-prefixed prompt so the character's portrait is bound to this scene.`;
        result.unmentionedCharacters = unmentioned;
      }
      return result;
    }
    case "set_scene_model": {
      const f = await sceneAt(args?.sceneIndex);
      if (!f) return { error: "Scene not found" };
      const model = resolveModelOrDefault(args?.modelId);
      if (!model) return { error: "Unknown model id" };
      const prevModel = f.model || null;
      await pool.query(
        `UPDATE frames SET model = $1 WHERE id = $2 AND project_id = $3`,
        [model.id, f.id, project.id],
      );
      await emit(
        pool,
        project.id,
        "frame.updated",
        { id: f.id, fields: { model: model.id } },
        {
          ...emitOpts,
          inverse: {
            kind: "frame.updated",
            payload: { id: f.id, fields: { model: prevModel } },
          },
        },
      );
      return { ok: true, sceneIndex: args.sceneIndex, modelId: model.id };
    }
    case "list_styles": {
      return PROJECT_STYLES.map((s) => ({ id: s.id, label: s.label }));
    }
    case "set_project_style": {
      const label = String(args?.label || "").trim();
      if (!isValidStyleLabel(label)) return { error: "Invalid style label" };
      const prevStyle = project.style || null;
      await pool.query(`UPDATE projects SET style = $1 WHERE id = $2`, [
        label,
        project.id,
      ]);
      project.style = label;
      await emit(
        pool,
        project.id,
        "project.updated",
        { fields: { style: label } },
        {
          ...emitOpts,
          inverse: {
            kind: "project.updated",
            payload: { fields: { style: prevStyle } },
          },
        },
      );
      return { ok: true, style: label };
    }
    case "add_scene": {
      const modelId = args?.modelId
        ? resolveModelOrDefault(args.modelId)?.id || DEFAULT_MODEL_ID
        : DEFAULT_MODEL_ID;
      const prompt = String(args?.prompt || "");
      // Optional voiceline bundling — saves a follow-up set_scene_voiceline
      // call when the agent already knows the dialogue at insert time.
      const voiceline =
        typeof args?.voiceline === "string" && args.voiceline.trim()
          ? args.voiceline.trim()
          : null;
      const speaker =
        typeof args?.speaker === "string" && args.speaker.trim()
          ? args.speaker.trim()
          : null;
      const captionText = voiceline
        ? typeof args?.caption === "string" && args.caption.trim()
          ? args.caption.trim()
          : voiceline
        : null;
      const meta = {};
      if (voiceline) meta.voiceline = voiceline;
      if (speaker) meta.speaker = speaker;
      if (captionText) meta.captionSettings = { caption: captionText };
      const hasMeta = Object.keys(meta).length > 0;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const ins = hasMeta
          ? await client.query(
              `INSERT INTO frames (project_id, prompt, result, model, meta)
               VALUES ($1, $2, NULL, $3, $4::jsonb) RETURNING id`,
              [project.id, prompt, modelId, JSON.stringify(meta)],
            )
          : await client.query(
              `INSERT INTO frames (project_id, prompt, result, model)
               VALUES ($1, $2, NULL, $3) RETURNING id`,
              [project.id, prompt, modelId],
            );
        const newId = ins.rows[0].id;
        await client.query(
          `UPDATE projects
           SET frame_ids = array_append(COALESCE(frame_ids, '{}'::uuid[]), $2::uuid)
           WHERE id = $1`,
          [project.id, newId],
        );
        await client.query("COMMIT");
        // Refresh in-memory project frame_ids so subsequent tool calls in the
        // same agent turn see the new ordering without a DB roundtrip.
        project.frame_ids = [...(project.frame_ids || []), newId];
        const frames = await loadOrderedFrames(pool, project);
        const sceneIndex = frames.findIndex((f) => f.id === newId) + 1;
        await emit(
          pool,
          project.id,
          "frame.created",
          {
            id: newId,
            sceneIndex,
            prompt,
            model: modelId,
            frame_ids: project.frame_ids,
            ...(hasMeta ? { meta } : {}),
          },
          {
            ...emitOpts,
            inverse: { kind: "frame.deleted", payload: { id: newId } },
          },
        );
        const projChars = await loadCharacters(pool, project.id);
        const unmentioned = findUnmentionedCharacters(prompt, projChars);
        // `totalScenes` is the breadcrumb that stops the agent from blindly
        // appending more scenes after re-running. If a project already had
        // 5 scenes and this call returns sceneIndex=6, the agent SEES that
        // and can decide whether to keep adding or to start editing instead.
        return {
          ok: true,
          sceneIndex,
          totalScenes: frames.length,
          frameId: newId,
          prompt,
          modelId,
          ...(voiceline ? { voiceline, caption: captionText, speaker } : {}),
          ...(unmentioned.length
            ? {
                warning: `Prompt mentions ${unmentioned
                  .map((n) => `"${n}"`)
                  .join(", ")} without @ — use set_scene to fix the prompt so the character's portrait gets bound at generation time.`,
                unmentionedCharacters: unmentioned,
              }
            : {}),
        };
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        return { error: String(e.message || "Could not add scene") };
      } finally {
        client.release();
      }
    }
    case "delete_scene": {
      const f = await sceneAt(args?.sceneIndex);
      if (!f) return { error: "Scene not found" };
      const prevOrderIndex = (project.frame_ids || []).indexOf(f.id);
      const snapshot = {
        id: f.id,
        prompt: f.prompt,
        result: f.result,
        model: f.model,
        reference_urls: f.reference_urls,
        meta: f.meta,
      };
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE projects SET frame_ids = array_remove(frame_ids, $2::uuid) WHERE id = $1`,
          [project.id, f.id],
        );
        await client.query(`DELETE FROM frames WHERE id = $1 AND project_id = $2`, [
          f.id,
          project.id,
        ]);
        await client.query("COMMIT");
        project.frame_ids = (project.frame_ids || []).filter((id) => id !== f.id);
        await emit(
          pool,
          project.id,
          "frame.deleted",
          { id: f.id, frame_ids: project.frame_ids },
          {
            ...emitOpts,
            // Restore is best-effort — the client undo handler reinserts via
            // POST /frames so the row is recreated with a fresh id and the
            // event is rebroadcast.
            inverse: {
              kind: "frame.restore",
              payload: { snapshot, atIndex: prevOrderIndex },
            },
          },
        );
        return { ok: true, deletedSceneIndex: args.sceneIndex };
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        return { error: String(e.message || "Could not delete scene") };
      } finally {
        client.release();
      }
    }
    case "add_reference_to_scene": {
      const f = await sceneAt(args?.sceneIndex);
      if (!f) return { error: "Scene not found" };
      let url = null;
      if (args?.characterId) {
        const r = await pool.query(
          `SELECT image_url FROM characters WHERE id = $1 AND project_id = $2`,
          [args.characterId, project.id],
        );
        url = r.rows[0]?.image_url || null;
        if (!url) return { error: "Character has no portrait" };
      } else if (args?.sourceSceneIndex) {
        const src = await sceneAt(args.sourceSceneIndex);
        url = src?.result || null;
        if (!url) return { error: "Source scene has no image" };
      } else if (args?.imageUrl && /^https?:\/\//i.test(args.imageUrl)) {
        url = args.imageUrl;
      } else {
        return { error: "Provide characterId, sourceSceneIndex, or imageUrl" };
      }
      const existing = Array.isArray(f.reference_urls) ? f.reference_urls : [];
      if (existing.includes(url)) {
        return { ok: true, alreadyPresent: true, references: existing };
      }
      const next = [...existing, url];
      await pool.query(
        `UPDATE frames SET reference_urls = $1::text[] WHERE id = $2 AND project_id = $3`,
        [next, f.id, project.id],
      );
      await emit(
        pool,
        project.id,
        "frame.updated",
        { id: f.id, fields: { reference_urls: next } },
        {
          ...emitOpts,
          inverse: {
            kind: "frame.updated",
            payload: { id: f.id, fields: { reference_urls: existing } },
          },
        },
      );
      return { ok: true, sceneIndex: args.sceneIndex, references: next };
    }
    case "set_scene_voiceline": {
      const f = await sceneAt(args?.sceneIndex);
      if (!f) return { error: "Scene not found" };
      const voiceline = String(args?.voiceline ?? "").trim();
      if (!voiceline) return { error: "voiceline is required" };
      const captionText =
        typeof args?.caption === "string" && args.caption.trim()
          ? args.caption.trim()
          : voiceline;
      const speaker =
        typeof args?.speaker === "string" && args.speaker.trim()
          ? args.speaker.trim()
          : undefined;
      // Merge into the frame's existing meta.captionSettings rather than
      // overwriting — keeps font/color/stroke choices the user picked.
      const existingMeta = (f.meta && typeof f.meta === "object") ? f.meta : {};
      const existingCaption =
        existingMeta.captionSettings && typeof existingMeta.captionSettings === "object"
          ? existingMeta.captionSettings
          : {};
      const metaPatch = {
        voiceline,
        ...(speaker ? { speaker } : {}),
        captionSettings: { ...existingCaption, caption: captionText },
      };
      await pool.query(
        `UPDATE frames SET meta = COALESCE(meta, '{}'::jsonb) || $1::jsonb
         WHERE id = $2 AND project_id = $3`,
        [JSON.stringify(metaPatch), f.id, project.id],
      );
      await emit(
        pool,
        project.id,
        "frame.updated",
        { id: f.id, fields: { meta: metaPatch } },
        emitOpts,
      );
      return {
        ok: true,
        sceneIndex: args.sceneIndex,
        voiceline,
        caption: captionText,
        speaker: speaker || null,
      };
    }
    case "set_scene": {
      const f = await sceneAt(args?.sceneIndex);
      if (!f) return { error: "Scene not found" };
      const updates = [];
      const params = [];
      let pi = 1;
      const result = { ok: true, sceneIndex: args.sceneIndex };

      // Prompt — only mutate if explicitly provided (use `in` to allow "" to
      // clear, even though we wouldn't usually want a blank prompt).
      if (typeof args?.prompt === "string") {
        const nextPrompt = args.prompt;
        updates.push(`prompt = $${pi++}`);
        params.push(nextPrompt);
        result.prompt = nextPrompt;
      }

      // Model.
      if (typeof args?.modelId === "string" && args.modelId) {
        const model = resolveModelOrDefault(args.modelId);
        if (!model) return { error: "Unknown model id" };
        updates.push(`model = $${pi++}`);
        params.push(model.id);
        result.modelId = model.id;
      }

      // Meta merge — voiceline / caption / speaker. Pass empty string to
      // clear a field.
      const metaPatch = {};
      const captionMerge = {};
      let touchesMeta = false;
      if (typeof args?.voiceline === "string") {
        metaPatch.voiceline = args.voiceline.trim();
        result.voiceline = metaPatch.voiceline;
        touchesMeta = true;
        // Default the caption to the voiceline when caption arg isn't given
        // and a non-empty voiceline is set.
        if (
          metaPatch.voiceline &&
          (typeof args?.caption !== "string" || !args.caption.trim())
        ) {
          captionMerge.caption = metaPatch.voiceline;
        }
      }
      if (typeof args?.caption === "string") {
        captionMerge.caption = args.caption.trim();
      }
      if (typeof args?.speaker === "string") {
        metaPatch.speaker = args.speaker.trim();
        result.speaker = metaPatch.speaker;
        touchesMeta = true;
      }
      if (Object.keys(captionMerge).length) {
        const existingMeta = (f.meta && typeof f.meta === "object") ? f.meta : {};
        const existingCaption =
          existingMeta.captionSettings && typeof existingMeta.captionSettings === "object"
            ? existingMeta.captionSettings
            : {};
        metaPatch.captionSettings = { ...existingCaption, ...captionMerge };
        result.caption = metaPatch.captionSettings.caption;
        touchesMeta = true;
      }
      if (touchesMeta) {
        updates.push(
          `meta = COALESCE(meta, '{}'::jsonb) || $${pi++}::jsonb`,
        );
        params.push(JSON.stringify(metaPatch));
      }

      if (updates.length === 0) {
        return { error: "Nothing to update — pass at least one of prompt, voiceline, caption, modelId, speaker." };
      }

      params.push(f.id, project.id);
      const idPh = pi++;
      const projPh = pi++;
      await pool.query(
        `UPDATE frames SET ${updates.join(", ")} WHERE id = $${idPh} AND project_id = $${projPh}`,
        params,
      );
      const fields = {};
      if (typeof result.prompt === "string") fields.prompt = result.prompt;
      if (result.modelId) fields.model = result.modelId;
      if (touchesMeta) fields.meta = metaPatch;
      await emit(pool, project.id, "frame.updated", { id: f.id, fields }, emitOpts);

      // Same warning shape as add_scene / edit_scene_prompt — keep the agent
      // self-correcting on missed @-prefixes.
      if (typeof args?.prompt === "string") {
        const projChars = await loadCharacters(pool, project.id);
        const unmentioned = findUnmentionedCharacters(args.prompt, projChars);
        if (unmentioned.length) {
          result.warning = `Prompt mentions ${unmentioned
            .map((n) => `"${n}"`)
            .join(", ")} without @ — call set_scene again with the @-prefixed prompt so the character's portrait is bound at generation time.`;
          result.unmentionedCharacters = unmentioned;
        }
      }
      return result;
    }
    case "create_character": {
      const name = String(args?.name || "").trim();
      const description = String(args?.description || "").trim();
      if (!name) return { error: "name is required" };
      // Reject duplicates so @-mentions in scene prompts always resolve to a
      // single character. Names are matched case-insensitively to keep the
      // mental model simple — "@Hiroshi" and "@hiroshi" are the same person.
      const existing = await pool.query(
        `SELECT id, name FROM characters WHERE project_id = $1 AND lower(name) = lower($2) LIMIT 1`,
        [project.id, name],
      );
      if (existing.rows[0]) {
        // Idempotent: return the existing character so the agent keeps
        // moving without a misleading "failed" toast in the UI. Previous
        // error-on-dup behavior made the agent think it had to invent a new
        // name and burned tool-call budget for nothing.
        const r = await pool.query(
          `SELECT id, name, description, image_url FROM characters WHERE id = $1`,
          [existing.rows[0].id],
        );
        const c = r.rows[0];
        return {
          ok: true,
          alreadyExisted: true,
          character: {
            id: c.id,
            name: c.name,
            description: c.description || "",
            imageUrl: c.image_url || null,
          },
          portraitGenerated: false,
        };
      }
      const skipPortrait = Boolean(args?.skipPortrait);
      let imageUrl = null;
      if (!skipPortrait) {
        try {
          const styleSuffix = resolveStyleSuffix(project.style);
          const portraitPrompt = [
            `Anime-style character portrait of ${name}.`,
            description,
            "Front-facing centered bust shot, clean neutral background, even lighting, full face visible, full color, high detail.",
            styleSuffix ? `${styleSuffix}.` : "",
          ]
            .filter(Boolean)
            .join(" ");
          const out = await generateFalImage({
            prompt: portraitPrompt,
            width: 768,
            height: 1024,
          });
          imageUrl = out.url;
        } catch (e) {
          // Don't block character creation on a portrait failure — the row
          // is still useful and the user can regenerate later.
          console.warn("[chat] portrait gen failed:", e.message);
        }
      }
      let ins;
      try {
        ins = await pool.query(
          `INSERT INTO characters (project_id, created_by, name, description, image_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, project_id, created_by, name, description, image_url, created_at`,
          [project.id, actorId, name, description, imageUrl],
        );
      } catch (e) {
        // Race-safe idempotency: a concurrent create_character could have
        // raced past our pre-check above. The DB's UNIQUE INDEX on
        // (project_id, lower(name)) catches it; treat it as the same
        // alreadyExisted return path.
        if (e?.code === "23505") {
          const r = await pool.query(
            `SELECT id, name, description, image_url
              FROM characters
              WHERE project_id = $1 AND lower(name) = lower($2)
              LIMIT 1`,
            [project.id, name],
          );
          const c = r.rows[0];
          if (c) {
            return {
              ok: true,
              alreadyExisted: true,
              character: {
                id: c.id,
                name: c.name,
                description: c.description || "",
                imageUrl: c.image_url || null,
              },
              portraitGenerated: false,
            };
          }
        }
        throw e;
      }
      const character = ins.rows[0];
      return {
        ok: true,
        character: {
          id: character.id,
          name: character.name,
          description: character.description || "",
          imageUrl: character.image_url || null,
        },
        portraitGenerated: Boolean(imageUrl),
      };
    }
    case "update_character": {
      const char = await resolveCharacter(pool, project.id, args || {});
      if (!char) return { error: "Character not found" };
      const sets = [];
      const vals = [];
      let pi = 1;
      if (typeof args?.name === "string" && args.name.trim()) {
        sets.push(`name = $${pi++}`);
        vals.push(args.name.trim());
      }
      if (typeof args?.description === "string") {
        sets.push(`description = $${pi++}`);
        vals.push(args.description);
      }
      if (sets.length === 0) {
        return { error: "Nothing to update (provide name and/or description)" };
      }
      vals.push(char.id, project.id);
      const u = await pool.query(
        `UPDATE characters SET ${sets.join(", ")}
          WHERE id = $${pi++} AND project_id = $${pi}
          RETURNING id, name, description, image_url`,
        vals,
      );
      const updated = u.rows[0];
      return {
        ok: true,
        character: {
          id: updated.id,
          name: updated.name,
          description: updated.description || "",
          imageUrl: updated.image_url || null,
        },
      };
    }
    case "regenerate_character_portrait": {
      const char = await resolveCharacter(pool, project.id, args || {});
      if (!char) return { error: "Character not found" };
      try {
        const styleSuffix = resolveStyleSuffix(project.style);
        const portraitPrompt = [
          `Anime-style character portrait of ${char.name}.`,
          char.description || "",
          "Centered bust shot, clean background, expressive lighting, full color, high detail.",
          styleSuffix ? `${styleSuffix}.` : "",
        ]
          .filter(Boolean)
          .join(" ");
        const out = await generateFalImage({
          prompt: portraitPrompt,
          width: 768,
          height: 1024,
        });
        const u = await pool.query(
          `UPDATE characters SET image_url = $1
            WHERE id = $2 AND project_id = $3
            RETURNING id, name, description, image_url`,
          [out.url, char.id, project.id],
        );
        const updated = u.rows[0];
        return {
          ok: true,
          character: {
            id: updated.id,
            name: updated.name,
            description: updated.description || "",
            imageUrl: updated.image_url || null,
          },
          regenerated: true,
        };
      } catch (e) {
        return { error: String(e.message || "Portrait generation failed") };
      }
    }
    case "delete_character": {
      const char = await resolveCharacter(pool, project.id, args || {});
      if (!char) return { error: "Character not found" };
      try {
        await pool.query(
          `DELETE FROM characters WHERE id = $1 AND project_id = $2`,
          [char.id, project.id],
        );
      } catch (e) {
        return { error: String(e.message || "Could not delete character") };
      }
      return {
        ok: true,
        deletedCharacterId: char.id,
        deletedCharacterName: char.name,
      };
    }
    case "delete_empty_scenes": {
      const includeGenerated = Boolean(args?.includeGenerated);
      const frames = await loadOrderedFrames(pool, project);
      // "Empty" = no generated image yet. We deliberately preserve frames
      // that have a `result` URL unless the caller explicitly asks for a
      // hard wipe — losing already-rendered art to a chat turn would be a
      // really bad failure mode.
      const toDelete = frames.filter((f) =>
        includeGenerated ? true : !f.result,
      );
      if (toDelete.length === 0) {
        return {
          ok: true,
          deletedSceneCount: 0,
          remainingFrameIds: project.frame_ids || [],
        };
      }
      const deleteIds = toDelete.map((f) => f.id);
      const deleteSet = new Set(deleteIds);
      // Compute the survivor list in JS rather than via a correlated subquery.
      // The previous `unnest(frame_ids) AS id WHERE id <> ALL(...)` form had
      // a column-shadowing bug — Postgres resolved the WHERE's `id` to the
      // outer `projects.id` row, not the unnested element, so frame_ids was
      // re-written to itself unchanged and nothing actually got deleted.
      const survivors = (project.frame_ids || []).filter((id) => !deleteSet.has(id));
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `UPDATE projects SET frame_ids = $1::uuid[] WHERE id = $2`,
          [survivors, project.id],
        );
        await client.query(
          `DELETE FROM frames WHERE id = ANY($1::uuid[]) AND project_id = $2`,
          [deleteIds, project.id],
        );
        await client.query("COMMIT");
        // Refresh in-memory frame_ids so subsequent tool calls in the same
        // agent turn (e.g. add_scene) see the new ordering.
        project.frame_ids = survivors;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        return { error: String(e.message || "Could not delete scenes") };
      } finally {
        client.release();
      }
      return {
        ok: true,
        deletedSceneCount: toDelete.length,
        remainingFrameIds: project.frame_ids,
      };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function buildContextSummary(pool, project, contextRefs) {
  if (!Array.isArray(contextRefs) || contextRefs.length === 0) return "";
  const parts = [];
  for (const ref of contextRefs) {
    if (!ref || typeof ref !== "object") continue;
    if (ref.type === "frame" && Number.isInteger(ref.sceneIndex)) {
      const frames = await loadOrderedFrames(pool, project);
      const f = frames[ref.sceneIndex - 1];
      if (f) {
        parts.push(
          `[FRAME #${ref.sceneIndex}] prompt="${f.prompt || ""}" model="${f.model || ""}" refs=${(f.reference_urls || []).length} image=${f.result || "(none)"}`,
        );
      }
    } else if (ref.type === "character" && ref.id) {
      const r = await pool.query(
        `SELECT id, name, description, image_url FROM characters WHERE id = $1 AND project_id = $2`,
        [ref.id, project.id],
      );
      const c = r.rows[0];
      if (c) {
        parts.push(
          `[CHARACTER ${c.name}] id=${c.id} description="${c.description || ""}" portrait=${c.image_url || "(none)"}`,
        );
      }
    }
  }
  return parts.length
    ? `User has pinned the following items as context:\n${parts.join("\n")}`
    : "";
}

// Tools are fully static — mark the last one as a cache breakpoint so
// the entire tool block is cached on Anthropic. OpenRouter forwards
// cache_control through to Anthropic for Claude models.
const CACHED_TOOLS = TOOLS.map((t, i) =>
  i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t,
);

async function callOpenRouter({ key, messages }) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cocreate.app",
      "X-Title": "CoCreate Chat",
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      temperature: 0.5,
      max_tokens: 1200,
      tools: CACHED_TOOLS,
      tool_choice: "auto",
      messages,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function buildBaseMessages(pool, project, chatId, excludeMessageId, contextRefs) {
  const history = await pool.query(
    `SELECT role, message_contents
     FROM chat_messages
     WHERE chat_id = $1 AND ($2::uuid IS NULL OR id <> $2)
     ORDER BY created_at DESC
     LIMIT 30`,
    [chatId, excludeMessageId || null],
  );
  const contextSummary = await buildContextSummary(pool, project, contextRefs);
  // The big static system prompt is the cache breakpoint — Anthropic
  // caches everything up to and including the marked content block, so
  // each follow-up turn re-uses it at ~10% of input cost. Project meta
  // and pinned context come AFTER (uncached) since they vary per chat.
  const messages = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
    },
    {
      role: "system",
      content: `Project: ${project.name}\nVisual style (auto-appended to every generation prompt): ${project.style || "Ghibli/Miyazaki"}`,
    },
  ];
  if (contextSummary) messages.push({ role: "system", content: contextSummary });
  messages.push(
    ...history.rows
      .reverse()
      .map((m) => ({ role: m.role, content: m.message_contents })),
  );
  return messages;
}

function parseToolArgs(call) {
  try {
    return call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return {};
  }
}

/**
 * Runs the agent loop in-place on `messages` / `toolLog`. Returns either:
 *   { kind: 'done', assistantText }      — final text streamed to the client
 *   { kind: 'paused', pending, assistantTextSoFar }
 *                                         — generate_scene calls awaiting approval
 * Caller is responsible for persisting state (chat_pending_runs row) on pause.
 *
 * `assistantTextSoFar` carries any text the model wrote on prior turns of
 * this same logical reply (e.g. "I've created 8 scenes outlining Hiroshi's
 * journey…" emitted alongside a batch of generate_scene tool calls). On
 * resume, the caller passes it back so we can concatenate the full reply
 * before persisting to chat_messages — otherwise that paragraph would only
 * exist in the live SSE deltas and vanish on the next chat-history load.
 */
async function continueAgent({
  key,
  pool,
  project,
  messages,
  toolLog,
  send,
  actorId,
  assistantTextSoFar = "",
}) {
  let accumText = String(assistantTextSoFar || "");
  const streamPiece = async (piece) => {
    if (!piece) return;
    // Separator between successive assistant turns so the persisted message
    // reads naturally on later chat loads.
    const out = accumText ? `\n\n${piece}` : piece;
    accumText += out;
    const chunks = out.match(/.{1,12}/gs) || [out];
    for (const c of chunks) {
      send("delta", { text: c });
      await new Promise((r) => setTimeout(r, 12));
    }
  };

  for (let iter = 0; iter < 6; iter++) {
    const data = await callOpenRouter({ key, messages });
    const choice = data?.choices?.[0]?.message;
    if (!choice) throw new Error("No choice from model");
    const toolCalls = Array.isArray(choice.tool_calls) ? choice.tool_calls : [];
    messages.push({
      role: "assistant",
      content: choice.content || "",
      ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
    });

    // Stream any text the model produced on this turn — including text that
    // accompanies tool calls. Persisting the cumulative content keeps the
    // chat history complete across pause/resume cycles.
    const turnContent = String(choice.content || "").trim();
    if (turnContent) await streamPiece(turnContent);

    if (toolCalls.length === 0) {
      const assistantText = accumText.trim() || "(no response)";
      return { kind: "done", assistantText };
    }

    // Run all auto-execute tools first, then collect generate_scene calls and
    // pause if any remain. The model can mix tools (e.g. add_scene followed by
    // generate_scene) in a single turn — that becomes "do the prep then ask
    // before spending tokens".
    const pendingGenerate = [];
    for (const call of toolCalls) {
      const fnName = call?.function?.name || "";
      const args = parseToolArgs(call);
      if (fnName === "generate_scene") {
        pendingGenerate.push({ tool_call_id: call.id, name: fnName, args });
        continue;
      }
      const result = await runTool(pool, project, fnName, args, { actorId }).catch((e) => ({
        error: String(e.message || e),
      }));
      const entry = { name: fnName, args, result };
      toolLog.push(entry);
      send("tool_call", entry);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result).slice(0, 4000),
      });
    }

    if (pendingGenerate.length > 0) {
      const frames = await loadOrderedFrames(pool, project);
      const enriched = pendingGenerate.map((p) => {
        const idx = Number.isInteger(p.args?.sceneIndex) ? p.args.sceneIndex : null;
        const frame = idx && idx >= 1 && idx <= frames.length ? frames[idx - 1] : null;
        return {
          ...p,
          preview: frame
            ? {
                sceneIndex: idx,
                frameId: frame.id,
                prompt: p.args?.prompt || frame.prompt || "",
                modelId: p.args?.modelId || frame.model || DEFAULT_MODEL_ID,
                referenceUrls: Array.isArray(frame.reference_urls) ? frame.reference_urls : [],
                currentImage: frame.result || null,
              }
            : { sceneIndex: idx, error: "Scene not found" },
        };
      });
      return { kind: "paused", pending: enriched, assistantTextSoFar: accumText };
    }
  }
  // Iteration cap — finish with whatever we accumulated.
  const assistantText = accumText.trim() || "(reached iteration limit)";
  if (!accumText) send("delta", { text: assistantText });
  return { kind: "done", assistantText };
}

/**
 * Server-side image generation triggered by an approved generate_scene tool.
 * Mirrors the debit/refund + frame update flow from
 * /projects/:id/frames/:fid/generate-image, but routed through the chat
 * agent's tool-result protocol. Returns a JSON-safe object suitable for the
 * tool result content and the client tool_call event.
 */
async function runGenerateScene({ pool, project, args, user }) {
  const sceneIndex = Number.isInteger(args?.sceneIndex) ? args.sceneIndex : null;
  if (!sceneIndex || sceneIndex < 1) return { error: "sceneIndex required" };

  const frames = await loadOrderedFrames(pool, project);
  const frame = frames[sceneIndex - 1];
  if (!frame) return { error: "Scene not found", sceneIndex };

  const promptText = String(args?.prompt || frame.prompt || "").trim();
  if (!promptText) return { error: "Scene has no prompt to generate from", sceneIndex };

  const requestedModelId = String(args?.modelId || "").trim() || frame.model || DEFAULT_MODEL_ID;
  const model = resolveModelOrDefault(requestedModelId);
  if (!model) return { error: "Unknown model id", sceneIndex };

  const tokenCost = Math.max(1, Math.ceil(model.costCents));
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    const debitClient = await pool.connect();
    try {
      await debitClient.query("BEGIN");
      const bal = await debitClient.query(
        `SELECT tokens FROM users WHERE id = $1 FOR UPDATE`,
        [user.id],
      );
      const current = bal.rows[0]?.tokens ?? 0;
      if (current < tokenCost) {
        await debitClient.query("ROLLBACK");
        return { error: "Insufficient tokens", required: tokenCost, tokens: current };
      }
      await debitClient.query(
        `INSERT INTO transactions (user_id, delta, name, notes, frame_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, -tokenCost, "Image generation", `chat ${model.id} frame ${frame.id}`, frame.id],
      );
      await debitClient.query("COMMIT");
    } catch (e) {
      await debitClient.query("ROLLBACK").catch(() => {});
      debitClient.release();
      return { error: "Could not debit tokens" };
    }
    debitClient.release();
  }

  const refund = async (notes) => {
    if (isAdmin) return;
    try {
      await pool.query(
        `INSERT INTO transactions (user_id, delta, name, notes, frame_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenCost, "Refund", String(notes || "").slice(0, 480), frame.id],
      );
    } catch (e) {
      console.error(e);
    }
  };

  // `@Name` mentions in the prompt ARE the binding — derive the slot order
  // from mention order, no separate bound list.
  const projectChars = (
    await pool.query(
      `SELECT id, name, description, image_url FROM characters WHERE project_id = $1`,
      [project.id],
    )
  ).rows;
  const charactersOrdered = extractMentionedCharacters(promptText, projectChars);
  const rewritten = applyCharacterPrompt({
    prompt: promptText,
    characters: charactersOrdered,
    manualReferenceUrls: Array.isArray(frame.reference_urls) ? frame.reference_urls : [],
  });

  const styleSuffix = resolveStyleSuffix(project.style);
  const finalPrompt =
    styleSuffix && !rewritten.prompt.toLowerCase().includes(styleSuffix.toLowerCase())
      ? `${rewritten.prompt}, ${styleSuffix}.`
      : rewritten.prompt;

  let imageUrl;
  try {
    const out = await generateFalImage({
      modelId: model.id,
      prompt: finalPrompt,
      width: project.width,
      height: project.height,
      referenceUrls: rewritten.referenceUrls,
    });
    imageUrl = out.url;
  } catch (e) {
    await refund(e.message || "fal failed");
    return { error: String(e.message || "Image generation failed"), sceneIndex };
  }
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    await refund("Invalid image URL from provider");
    return { error: "Invalid image URL from provider", sceneIndex };
  }

  const prevFrame = {
    prompt: frame.prompt || "",
    result: frame.result || null,
    model: frame.model || null,
  };
  try {
    await pool.query(
      `UPDATE frames SET prompt = $1, result = $2, model = $3 WHERE id = $4 AND project_id = $5`,
      [promptText, imageUrl, model.id, frame.id, project.id],
    );
    await pool.query(`UPDATE projects SET thumbnail = $1 WHERE id = $2`, [imageUrl, project.id]);
    await emit(
      pool,
      project.id,
      "frame.updated",
      { id: frame.id, fields: { prompt: promptText, result: imageUrl, model: model.id } },
      {
        source: "agent",
        actorId: user?.id || null,
        inverse: {
          kind: "frame.updated",
          payload: { id: frame.id, fields: prevFrame },
        },
      },
    );
  } catch (e) {
    await refund(e.message || "save failed");
    return { error: "Could not save frame", sceneIndex };
  }

  return {
    ok: true,
    sceneIndex,
    frameId: frame.id,
    imageUrl,
    modelId: model.id,
    tokenCost,
  };
}

module.exports = function createChatRouter(pool, requireAuth) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AUDIO_BYTES },
  });
  router.use(requireAuth);

  router.get(
    "/projects/:projectId/messages",
    validate({ params: ProjectIdParams }),
    async (req, res) => {
      const { projectId } = req.validated.params;
      const proj = await getProjectIfAccessible(pool, projectId, req.user);
      if (!proj) return res.status(404).json({ error: "Project not found" });

      const chatId = await ensureChat(pool, projectId);
      const r = await pool.query(
        `${MESSAGE_SELECT} WHERE m.chat_id = $1 ORDER BY m.created_at ASC LIMIT 500`,
        [chatId],
      );
      res.json({ chatId, messages: r.rows });
    },
  );

  router.post(
    "/projects/:projectId/messages",
    validate({ params: ProjectIdParams, body: PostMessageBody }),
    async (req, res) => {
      const { projectId } = req.validated.params;
      const proj = await getProjectIfAccessible(pool, projectId, req.user);
      if (!proj) return res.status(404).json({ error: "Project not found" });

      const text = String(req.validated.body.message || "").trim();
      const attachments = req.validated.body.attachments;
      const contextRefs = req.validated.body.contextRefs;

      const key = getOpenRouterKey();
      if (!key) return res.status(500).json({ error: "LLM not configured" });

    const chatId = await ensureChat(pool, projectId);

    // Persist user message first. Store contextRefs in attachments JSON
    // alongside any image attachments so the UI can re-render the chips.
    const storedAttachments = [
      ...attachments.map((a) => (typeof a === "string" ? { url: a } : a)),
      ...contextRefs.map((r) => ({ kind: "ref", ...r })),
    ];
    const userInsert = await pool.query(
      `INSERT INTO chat_messages (chat_id, sent_by, role, message_contents, attachments)
       VALUES ($1, $2, 'user', $3, $4::jsonb)
       RETURNING id, chat_id, sent_by, role, message_contents, attachments, created_at`,
      [chatId, req.user.id, text, JSON.stringify(storedAttachments)],
    );
    const userMsgId = userInsert.rows[0].id;
    const userMsgEnriched = {
      ...userInsert.rows[0],
      sender_name: req.user.name,
      sender_profile_picture: req.user.profile_picture,
      sender_email: req.user.email,
    };
    // Fan out to peers right away — they see "Alice sent: …" without waiting
    // for the assistant reply.
    await emit(pool, projectId, "chat.message_created", { message: userMsgEnriched }, {
      source: "user",
      actorId: req.user.id,
    });
    const baseMessages = await buildBaseMessages(pool, proj, chatId, userMsgId, contextRefs);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let socketClosed = false;
    req.on("close", () => {
      socketClosed = true;
    });

    // `send` writes to BOTH the live SSE socket and the project realtime bus.
    // The agent loop runs to completion server-side regardless of whether
    // this socket stays open — a refreshing client picks up the in-flight
    // state via /active-run + subscribeProject.
    const send = (event, data) => {
      if (!socketClosed) {
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          /* socket gone */
        }
      }
      emit(
        pool,
        projectId,
        "chat.agent_step",
        { type: event, ...data },
        { source: "agent", actorId: req.user.id },
      ).catch(() => {});
    };

    send("user_message", userMsgEnriched);

    const messages = [...baseMessages, { role: "user", content: text || "(no text)" }];
    const toolLog = [];
    let outcome;
    try {
      outcome = await continueAgent({
        key,
        pool,
        project: proj,
        messages,
        toolLog,
        send,
        actorId: req.user.id,
      });
    } catch (err) {
      console.error("[chat] agent failed:", err);
      send("error", { message: String(err.message || "agent failed") });
      if (!socketClosed) res.end();
      return;
    }

    if (outcome.kind === "paused") {
      // Persist in-flight conversation so the resolve endpoint can pick up.
      const ins = await pool.query(
        `INSERT INTO chat_pending_runs (chat_id, project_id, user_id, state)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
        [
          chatId,
          proj.id,
          req.user.id,
          JSON.stringify({
            messages,
            toolLog,
            pending: outcome.pending,
            assistantTextSoFar: outcome.assistantTextSoFar || "",
          }),
        ],
      );
      for (const p of outcome.pending) {
        send("tool_pending", { tool_call_id: p.tool_call_id, name: p.name, args: p.args, preview: p.preview, runId: ins.rows[0].id });
      }
      send("paused", { runId: ins.rows[0].id });
      if (!socketClosed) res.end();
      return;
    }

    const assistantInsert = await pool.query(
      `INSERT INTO chat_messages (chat_id, sent_by, role, message_contents, attachments)
       VALUES ($1, NULL, 'assistant', $2, $3::jsonb)
       RETURNING id, chat_id, sent_by, role, message_contents, attachments, created_at`,
      [
        chatId,
        outcome.assistantText,
        JSON.stringify(toolLog.map((t) => ({ kind: "tool_call", ...t }))),
      ],
    );
    await emit(pool, projectId, "chat.message_created", {
      message: assistantInsert.rows[0],
    }, { source: "agent", actorId: req.user.id });
    send("done", assistantInsert.rows[0]);
    if (!socketClosed) res.end();
  });

  // Active pending run for this user in this project. Used after a refresh:
  // the client rehydrates `approvalRun` from this so an in-flight approval
  // list (including currently running generations) reappears even though the
  // SSE socket from the original POST is long gone. Live updates after that
  // come through subscribeProject/chat.agent_step.
  router.get(
    "/projects/:projectId/active-run",
    validate({ params: ProjectIdParams }),
    async (req, res) => {
    const { projectId } = req.validated.params;
    const proj = await getProjectIfAccessible(pool, projectId, req.user);
    if (!proj) return res.status(404).json({ error: "Project not found" });
    const r = await pool.query(
      `SELECT id, state, created_at FROM chat_pending_runs
       WHERE project_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [projectId, req.user.id],
    );
    const row = r.rows[0];
    if (!row) return res.json({ run: null });
    res.json({
      run: {
        id: row.id,
        items: Array.isArray(row.state?.pending) ? row.state.pending : [],
        createdAt: row.created_at,
      },
    });
  });

  // Cancel a pending run. Drops the row so any /resolve retry returns 404,
  // and emits a `chat.agent_step` cancel event so all subscribed clients
  // clear their approval cards. Already-running fal generations on the
  // server may still complete (we can't recall a fal job mid-flight), but
  // any subsequent agent loop continuation tied to this run is short-
  // circuited because the row's gone.
  router.post(
    "/projects/:projectId/messages/runs/:runId/cancel",
    validate({ params: ProjectIdRunIdParams }),
    async (req, res) => {
    const { projectId, runId } = req.validated.params;
    const proj = await getProjectIfAccessible(pool, projectId, req.user);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const r = await pool.query(
      `DELETE FROM chat_pending_runs
        WHERE id = $1 AND project_id = $2 AND user_id = $3
        RETURNING id`,
      [runId, projectId, req.user.id],
    );
    if (r.rows.length === 0) {
      // Already gone — treat cancel as idempotent so the client UI clears
      // either way.
      await emit(
        pool,
        projectId,
        "chat.agent_step",
        { type: "cancelled", runId },
        { source: "agent", actorId: req.user.id },
      ).catch(() => {});
      return res.json({ ok: true, alreadyGone: true });
    }
    await emit(
      pool,
      projectId,
      "chat.agent_step",
      { type: "cancelled", runId },
      { source: "agent", actorId: req.user.id },
    ).catch(() => {});
    return res.json({ ok: true });
  });

  // Resolve a paused run. Approved generations run in parallel; each one
  // emits realtime events as it progresses, so a client that refreshed
  // mid-run picks up live updates via subscribeProject + active-run rehydrate.
  // The HTTP response is a best-effort live tail (SSE) — the actual work
  // continues on the server even if this socket dies.
  router.post(
    "/projects/:projectId/messages/runs/:runId/resolve",
    validate({ params: ProjectIdRunIdParams, body: ResolveBody }),
    async (req, res) => {
    const { projectId, runId } = req.validated.params;
    const proj = await getProjectIfAccessible(pool, projectId, req.user);
    if (!proj) return res.status(404).json({ error: "Project not found" });

    const key = getOpenRouterKey();
    if (!key) return res.status(500).json({ error: "LLM not configured" });

    const runRow = await pool.query(
      `SELECT id, chat_id, project_id, user_id, state FROM chat_pending_runs
       WHERE id = $1 AND project_id = $2 AND user_id = $3`,
      [runId, projectId, req.user.id],
    );
    if (runRow.rows.length === 0) {
      return res.status(404).json({ error: "Pending run not found" });
    }
    const { state, chat_id: chatId } = runRow.rows[0];
    const messages = Array.isArray(state.messages) ? [...state.messages] : [];
    const toolLog = Array.isArray(state.toolLog) ? [...state.toolLog] : [];
    const pending = Array.isArray(state.pending) ? state.pending : [];
    const assistantTextSoFar = String(state.assistantTextSoFar || "");

    const decisions = req.validated.body.decisions;
    const decisionByCallId = new Map();
    for (const d of decisions) {
      if (d && typeof d.toolCallId === "string") {
        decisionByCallId.set(d.toolCallId, d);
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let socketClosed = false;
    req.on("close", () => {
      socketClosed = true;
    });

    // `send` writes to BOTH the client's SSE socket (live tail, best-effort)
    // AND the project realtime bus (durable — survives refresh / disconnect).
    // Anything worth showing in the chat UI flows through here.
    const send = (event, data) => {
      if (!socketClosed) {
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          /* socket gone */
        }
      }
      emit(
        pool,
        projectId,
        "chat.agent_step",
        { type: event, runId, ...data },
        { source: "agent", actorId: req.user.id },
      ).catch(() => {});
    };

    const persistItems = (items) =>
      pool
        .query(
          `UPDATE chat_pending_runs SET state = jsonb_set(state, '{pending}', $1::jsonb) WHERE id = $2`,
          [JSON.stringify(items), runId],
        )
        .catch(() => {});

    // Mark each item up front: approved → 'running', otherwise → 'skipped'.
    // Mutated in place as parallel tasks settle so /active-run reflects the
    // current view.
    const items = pending.map((p) => {
      const d = decisionByCallId.get(p.tool_call_id);
      return { ...p, status: d?.action === "approve" ? "running" : "skipped" };
    });
    await persistItems(items);
    for (const it of items) {
      if (it.status === "running") {
        send("tool_progress", { tool_call_id: it.tool_call_id, status: "running", args: it.args });
      }
    }

    // Run all approved generations IN PARALLEL. Each task fires its own
    // tool_call when it settles — results stream in independently as they
    // finish, not in lockstep.
    const tasks = items.map(async (it) => {
      if (it.status === "running") {
        const decision = decisionByCallId.get(it.tool_call_id);
        const overrides =
          decision?.overrides && typeof decision.overrides === "object" ? decision.overrides : {};
        const mergedArgs = { ...it.args, ...overrides };
        const result = await runGenerateScene({
          pool,
          project: proj,
          args: mergedArgs,
          user: req.user,
        }).catch((e) => ({ error: String(e.message || e) }));
        it.status = result && result.error ? "error" : "done";
        it.result = result;
        await persistItems(items);
        const entry = {
          name: "generate_scene",
          args: it.args,
          result,
          status: it.status,
          tool_call_id: it.tool_call_id,
        };
        send("tool_call", entry);
        return entry;
      }
      const result = { skipped: true, sceneIndex: it.args?.sceneIndex || null };
      it.result = result;
      const entry = {
        name: "generate_scene",
        args: it.args,
        result,
        status: "skipped",
        tool_call_id: it.tool_call_id,
      };
      send("tool_call", entry);
      return entry;
    });
    const settled = await Promise.all(tasks);

    // Append tool results to the LLM transcript in original (deterministic)
    // order so the model sees results matched to the calls it made.
    for (let i = 0; i < items.length; i++) {
      const entry = settled[i];
      toolLog.push(entry);
      messages.push({
        role: "tool",
        tool_call_id: entry.tool_call_id,
        content: JSON.stringify(entry.result).slice(0, 4000),
      });
    }

    // DELETE returning lets us tell the difference between "we cleaned up
    // ourselves" and "someone /cancel-ed us mid-Promise.all". In the cancel
    // case, skip continuing the agent — the user explicitly bailed.
    const delRes = await pool
      .query(`DELETE FROM chat_pending_runs WHERE id = $1 RETURNING id`, [runId])
      .catch(() => ({ rows: [] }));
    if (delRes.rows.length === 0) {
      send("cancelled", { runId });
      if (!socketClosed) res.end();
      return;
    }

    let outcome;
    try {
      outcome = await continueAgent({
        key,
        pool,
        project: proj,
        messages,
        toolLog,
        send,
        actorId: req.user.id,
        assistantTextSoFar,
      });
    } catch (err) {
      console.error("[chat] resume failed:", err);
      send("error", { message: String(err.message || "resume failed") });
      if (!socketClosed) res.end();
      return;
    }

    if (outcome.kind === "paused") {
      const ins = await pool.query(
        `INSERT INTO chat_pending_runs (chat_id, project_id, user_id, state)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
        [
          chatId,
          proj.id,
          req.user.id,
          JSON.stringify({
            messages,
            toolLog,
            pending: outcome.pending,
            assistantTextSoFar: outcome.assistantTextSoFar || "",
          }),
        ],
      );
      for (const p of outcome.pending) {
        send("tool_pending", { tool_call_id: p.tool_call_id, name: p.name, args: p.args, preview: p.preview });
      }
      send("paused", { runId: ins.rows[0].id });
      if (!socketClosed) res.end();
      return;
    }

    const assistantInsert = await pool.query(
      `INSERT INTO chat_messages (chat_id, sent_by, role, message_contents, attachments)
       VALUES ($1, NULL, 'assistant', $2, $3::jsonb)
       RETURNING id, chat_id, sent_by, role, message_contents, attachments, created_at`,
      [
        chatId,
        outcome.assistantText,
        JSON.stringify(toolLog.map((t) => ({ kind: "tool_call", ...t }))),
      ],
    );
    await emit(pool, projectId, "chat.message_created", {
      message: assistantInsert.rows[0],
    }, { source: "agent", actorId: req.user.id });
    send("done", assistantInsert.rows[0]);
    if (!socketClosed) res.end();
  });

  // Voice → chat. Records audio on the client, transcribed here, then routed
  // through the same agent loop as text chat. The active frame (when the user
  // is editing a single scene) is included as a context ref; in storyboard
  // mode (the 3×2 grid) the client omits the frame ref.
  router.post(
    "/projects/:projectId/voice",
    (req, res, next) => {
      upload.single("audio")(req, res, (err) => {
        if (err) {
          return res.status(400).json({ error: err.message || "Upload failed" });
        }
        next();
      });
    },
    async (req, res) => {
      const { projectId } = req.params;
      if (!isUuid(projectId)) return res.status(400).json({ error: "Invalid id" });
      const proj = await getProjectIfAccessible(pool, projectId, req.user);
      if (!proj) return res.status(404).json({ error: "Project not found" });
      if (!req.file?.buffer) return res.status(400).json({ error: "Missing audio file" });

      const key = getOpenRouterKey();
      if (!key) return res.status(500).json({ error: "LLM not configured" });

      let contextRefs = [];
      if (req.body?.contextRefs) {
        try {
          const parsed = JSON.parse(req.body.contextRefs);
          if (Array.isArray(parsed)) contextRefs = parsed.slice(0, 12);
        } catch {
          /* ignore */
        }
      }

      // Charge tokens upfront so we can return a clean 402 before the SSE stream opens.
      const debitClient = await pool.connect();
      try {
        await debitClient.query("BEGIN");
        const bal = await debitClient.query(
          `SELECT tokens FROM users WHERE id = $1 FOR UPDATE`,
          [req.user.id],
        );
        const current = bal.rows[0]?.tokens ?? 0;
        if (current < VOICE_TOKEN_COST) {
          await debitClient.query("ROLLBACK");
          debitClient.release();
          return res.status(402).json({
            error: "Insufficient tokens",
            tokens: current,
            required: VOICE_TOKEN_COST,
          });
        }
        await debitClient.query(
          `INSERT INTO transactions (user_id, delta, name, notes)
           VALUES ($1, $2, $3, $4)`,
          [req.user.id, -VOICE_TOKEN_COST, "Voice chat", "voice → chat"],
        );
        await debitClient.query("COMMIT");
      } catch (e) {
        await debitClient.query("ROLLBACK").catch(() => {});
        debitClient.release();
        console.error(e);
        return res.status(500).json({ error: "Could not debit tokens" });
      }
      debitClient.release();

      const refundTokens = async (notes) => {
        try {
          await pool.query(
            `INSERT INTO transactions (user_id, delta, name, notes)
             VALUES ($1, $2, $3, $4)`,
            [
              req.user.id,
              VOICE_TOKEN_COST,
              "Refund",
              `voice chat: ${String(notes || "").slice(0, 480)}`,
            ],
          );
        } catch (e) {
          console.error(e);
        }
      };

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      let closed = false;
      req.on("close", () => {
        closed = true;
      });
      const send = (event, data) => {
        if (closed) return;
        try {
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch {
          /* connection gone */
        }
      };

      const falKey = getFalCredentials();
      if (falKey) fal.config({ credentials: falKey });

      let transcript;
      try {
        transcript = await transcribeAudio({
          buffer: req.file.buffer,
          contentType: req.file.mimetype,
        });
      } catch (e) {
        console.error("STT failed:", e);
        await refundTokens(e.message || "stt failed");
        send("error", { message: e.message || "Transcription failed" });
        return res.end();
      }
      const text = String(transcript || "").trim();
      if (!text) {
        await refundTokens("empty transcript");
        send("error", { message: "Empty transcript" });
        return res.end();
      }
      send("transcript", { text });

      const chatId = await ensureChat(pool, projectId);
      const storedAttachments = [
        { kind: "voice" },
        ...contextRefs.map((r) => ({ kind: "ref", ...r })),
      ];
      const userInsert = await pool.query(
        `INSERT INTO chat_messages (chat_id, sent_by, role, message_contents, attachments)
         VALUES ($1, $2, 'user', $3, $4::jsonb)
         RETURNING id, chat_id, sent_by, role, message_contents, attachments, created_at`,
        [chatId, req.user.id, text, JSON.stringify(storedAttachments)],
      );
      const userMsgId = userInsert.rows[0].id;
      const enrichedVoiceUser = {
        ...userInsert.rows[0],
        sender_name: req.user.name,
        sender_profile_picture: req.user.profile_picture,
        sender_email: req.user.email,
      };
      send("user_message", enrichedVoiceUser);
      await emit(pool, projectId, "chat.message_created", { message: enrichedVoiceUser }, {
        source: "user",
        actorId: req.user.id,
      });

      const baseMessages = await buildBaseMessages(
        pool,
        proj,
        chatId,
        userMsgId,
        contextRefs,
      );
      // Voice replies are spoken aloud — nudge the model to be terse and
      // avoid markdown that doesn't survive TTS.
      baseMessages.push({
        role: "system",
        content:
          "The user is speaking via voice and will hear your reply through TTS. Keep responses to 1–2 short sentences. Avoid markdown, lists, and code blocks.",
      });

      const messages = [...baseMessages, { role: "user", content: text || "(no text)" }];
      const toolLog = [];
      let outcome;
      try {
        outcome = await continueAgent({
          key,
          pool,
          project: proj,
          messages,
          toolLog,
          send,
          actorId: req.user.id,
        });
      } catch (err) {
        console.error("[chat:voice] agent failed:", err);
        send("error", { message: String(err.message || "agent failed") });
        return res.end();
      }

      let assistantText;
      if (outcome.kind === "paused") {
        for (const p of outcome.pending) {
          const result = { skipped: true, sceneIndex: p.args?.sceneIndex || null };
          toolLog.push({ name: "generate_scene", args: p.args, result, status: "skipped", tool_call_id: p.tool_call_id });
          send("tool_call", { name: "generate_scene", args: p.args, result, status: "skipped" });
          messages.push({ role: "tool", tool_call_id: p.tool_call_id, content: JSON.stringify(result) });
        }
        try {
          const tail = await continueAgent({ key, pool, project: proj, messages, toolLog, send, actorId: req.user.id });
          assistantText = tail.kind === "done" ? tail.assistantText : "Approve generations from the chat panel.";
        } catch {
          assistantText = "Approve generations from the chat panel.";
        }
      } else {
        assistantText = outcome.assistantText;
      }

      const assistantInsert = await pool.query(
        `INSERT INTO chat_messages (chat_id, sent_by, role, message_contents, attachments)
         VALUES ($1, NULL, 'assistant', $2, $3::jsonb)
         RETURNING id, chat_id, sent_by, role, message_contents, attachments, created_at`,
        [
          chatId,
          assistantText,
          JSON.stringify(toolLog.map((t) => ({ kind: "tool_call", ...t }))),
        ],
      );
      await emit(pool, projectId, "chat.message_created", {
        message: assistantInsert.rows[0],
      }, { source: "agent", actorId: req.user.id });

      if (falKey && assistantText) {
        try {
          const audioUrl = await synthesizeSpeech(assistantText);
          if (audioUrl) send("response_audio", { url: audioUrl });
        } catch (e) {
          console.warn("TTS failed:", e.message);
        }
      }

      send("done", assistantInsert.rows[0]);
      res.end();
    },
  );

  return router;
};
