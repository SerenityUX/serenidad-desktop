import { useEffect } from 'react';

/**
 * Imperatively update the document title + OG/Twitter meta tags from React.
 *
 * Limit: this only mutates the live DOM, so in-tab title and favicon update
 * correctly, but link previews (iMessage / Slack / Twitter) hit the static
 * HTML before any JS runs and won't see these values. Real share previews
 * need server-rendered HTML (a Vercel Edge Function on `/project/:id`) —
 * see deployment notes.
 */
function setMeta(selector, attr, value) {
  if (!value) return;
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export default function useDocumentMeta({ title, description, image } = {}) {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;
    if (description) {
      setMeta('meta[name="description"]', 'content', description);
      setMeta('meta[property="og:description"]', 'content', description);
      setMeta('meta[name="twitter:description"]', 'content', description);
    }
    if (title) {
      setMeta('meta[property="og:title"]', 'content', title);
      setMeta('meta[name="twitter:title"]', 'content', title);
    }
    if (image) {
      setMeta('meta[property="og:image"]', 'content', image);
      setMeta('meta[name="twitter:image"]', 'content', image);
    }
    return () => {
      document.title = prevTitle;
    };
  }, [title, description, image]);
}
