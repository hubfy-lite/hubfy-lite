import DOMPurify from "dompurify";

/**
 * Sanitizes lesson HTML before rendering it to students (or previewing it
 * in the admin). Shared by both the student-facing `LessonDescriptionTab`
 * and the admin `HtmlPreview` so the in-editor preview is byte-identical
 * to what the student sees.
 *
 * What we allow beyond the DOMPurify defaults:
 *   - <iframe> with the attributes needed by YouTube, Vimeo, Calendly, etc.
 *     Scripts and event handlers stay blocked by the default allowlist.
 *
 * What we strip on top of the defaults:
 *   - All `style` attributes. Authors pasting HTML from Google Docs/Notion/Word
 *     bring inline `font-family`, `font-size`, `color`, etc. that clash with
 *     the platform design system. Removing them lets the `prose` classes on
 *     the wrapper own typography.
 */
export function sanitizeLessonHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: [
      "allow",
      "allowfullscreen",
      "frameborder",
      "scrolling",
      "sandbox",
      "loading",
      "referrerpolicy",
      "srcdoc",
    ],
    FORBID_ATTR: ["style"],
  });
}
