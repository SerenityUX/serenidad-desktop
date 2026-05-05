/**
 * Vercel Edge Function: serves `/project/:id` with project-specific OG /
 * Twitter / title meta tags injected into the static index.html.
 *
 * Why: link-preview crawlers (iMessage, Twitter, Slack, Facebook) don't run
 * JavaScript, so the client-side `useDocumentMeta` hook never fires for
 * them — they only see the default tags from the static HTML. This function
 * sits in front of `/project/:id`, fetches a public preview from the API,
 * and rewrites the meta tags before returning the same HTML the SPA needs.
 *
 * Required API surface:
 *   GET ${SERENIDAD_API_URL}/projects/:id/public-preview
 *   → 200 { name, description?, thumbnailUrl? }   (no auth required)
 *   → 404 if the project doesn't exist
 *   The endpoint should only return non-sensitive fields safe for public
 *   share-card preview.
 *
 * Failure-safe: any error fetching project metadata (404, network, JSON
 * parse) falls through to the default OG tags. Real users see the SPA;
 * crawlers see the generic Kōdan card. Never returns 500 to a visitor.
 */

export const config = {
  runtime: 'edge',
};

const API_BASE =
  process.env.SERENIDAD_API_URL || 'https://api.serenidad.click';

const HTML_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

function escapeAttr(s) {
  return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Replace a meta tag's `content` attribute, regardless of attribute order.
 * Match shape: `<meta name="x" content="..."` or `<meta property="x" content="..."`.
 */
function replaceMetaContent(html, attrName, attrValue, newContent) {
  const safeValue = attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<meta\\s+${attrName}="${safeValue}"\\s+content=")[^"]*(")`,
    'i',
  );
  return html.replace(re, `$1${escapeAttr(newContent)}$2`);
}

function replaceTitle(html, newTitle) {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(newTitle)}</title>`);
}

export default async function handler(req) {
  const reqUrl = new URL(req.url);

  // Pull `:id` from the rewritten path. Vercel rewrites pass the original
  // path through; we also accept `?id=` for direct testing.
  const fromPath = reqUrl.pathname.match(/^\/project\/([^/?#]+)/);
  const id = fromPath
    ? decodeURIComponent(fromPath[1])
    : reqUrl.searchParams.get('id') || '';

  // Always fetch the static index.html the build emitted. We're behind a
  // rewrite so a same-origin GET to `/index.html` returns the SPA shell.
  const htmlRes = await fetch(new URL('/index.html', reqUrl.origin), {
    headers: { 'User-Agent': 'kodan-edge-meta' },
  });
  if (!htmlRes.ok) {
    // Fail open: if for some reason the static HTML isn't available, fall
    // back to a minimal shell rather than 500.
    return new Response('<!doctype html><title>CoCreate Cafe</title>', {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  let html = await htmlRes.text();

  if (id) {
    try {
      const apiRes = await fetch(
        `${API_BASE}/projects/${encodeURIComponent(id)}/public-preview`,
        { headers: { Accept: 'application/json' } },
      );
      if (apiRes.ok) {
        const data = await apiRes.json();
        const name = data?.name || '';
        if (name) {
          const title = `${name} — CoCreate Cafe`;
          const desc =
            data?.description ||
            `Storyboard for "${name}" on CoCreate Cafe.`;
          const image = data?.thumbnailUrl || `${reqUrl.origin}/icon-512.png`;

          html = replaceTitle(html, title);
          html = replaceMetaContent(html, 'name', 'description', desc);
          html = replaceMetaContent(html, 'property', 'og:title', title);
          html = replaceMetaContent(html, 'property', 'og:description', desc);
          html = replaceMetaContent(html, 'property', 'og:image', image);
          html = replaceMetaContent(html, 'name', 'twitter:title', title);
          html = replaceMetaContent(html, 'name', 'twitter:description', desc);
          html = replaceMetaContent(html, 'name', 'twitter:image', image);
        }
      }
    } catch {
      // Network/JSON failure — silently fall through to default tags.
    }
  }

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short cache so updates to project name/thumbnail show up quickly,
      // but s-maxage lets Vercel serve from edge cache for repeat hits.
      'Cache-Control':
        'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
