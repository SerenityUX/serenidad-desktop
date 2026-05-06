// Test stubs for the two external services chat.js depends on:
//
//   1. OpenRouter — replace globalThis.fetch with a programmable script.
//      Each test pushes "next response" objects onto a queue; the chat
//      agent's callOpenRouter() dequeues them in order. Lets us drive the
//      agent through specific tool-call sequences deterministically.
//
//   2. fal.ai (image generation) — patch require.cache for ../lib/falImage
//      so chat.js's `generateFalImage` import resolves to a fixture that
//      returns a fake URL without touching the network.
//
// IMPORTANT: stubFalImage must run BEFORE chat.js is required in the test
// process, since require() resolves once. The createApp() helper in
// integration.test.js does this.

const path = require("path");

let fetchQueue = [];
const realFetch = globalThis.fetch;

function installFetchStub() {
  globalThis.fetch = async (url, opts) => {
    const u = String(url || "");
    if (u.includes("openrouter.ai/api/v1/chat/completions")) {
      const next = fetchQueue.shift();
      if (!next) {
        throw new Error(
          "Test stub: no queued OpenRouter response — push one with stubs.queueOpenRouterResponse() before triggering the agent.",
        );
      }
      return new Response(JSON.stringify(next), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (typeof realFetch === "function") return realFetch(url, opts);
    throw new Error(`Test stub: unmocked fetch call: ${u}`);
  };
}

function uninstallFetchStub() {
  globalThis.fetch = realFetch;
  fetchQueue = [];
}

/**
 * Push a fake OpenRouter response. `toolCalls` is an array of
 * { name, args } objects that get formatted into the OpenAI tool_calls
 * shape. `content` is the assistant's text reply on this turn.
 */
function queueOpenRouterResponse({ content = "", toolCalls = [] } = {}) {
  fetchQueue.push({
    choices: [
      {
        message: {
          role: "assistant",
          content,
          tool_calls: toolCalls.length
            ? toolCalls.map((tc, i) => ({
                id: tc.id || `call_${Date.now()}_${i}`,
                type: "function",
                function: {
                  name: tc.name,
                  arguments: JSON.stringify(tc.args || {}),
                },
              }))
            : undefined,
        },
      },
    ],
  });
}

function fetchQueueRemaining() {
  return fetchQueue.length;
}

let falStubInstalled = false;
let falCallCount = 0;
function stubFalImage() {
  if (falStubInstalled) return;
  const falPath = path.resolve(__dirname, "..", "lib", "falImage.js");
  require.cache[falPath] = {
    id: falPath,
    filename: falPath,
    loaded: true,
    exports: {
      generateFalImage: async ({ width = 1280, height = 720 } = {}) => {
        falCallCount += 1;
        return {
          url: `https://test.fal/fake-image-${falCallCount}-${width}x${height}.png`,
          width,
          height,
        };
      },
    },
  };
  falStubInstalled = true;
}

function falCalls() {
  return falCallCount;
}
function resetFalCalls() {
  falCallCount = 0;
}

module.exports = {
  installFetchStub,
  uninstallFetchStub,
  queueOpenRouterResponse,
  fetchQueueRemaining,
  stubFalImage,
  falCalls,
  resetFalCalls,
};
