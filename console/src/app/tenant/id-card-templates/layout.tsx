/**
 * The ID card editor's own chrome: none.
 *
 * Deliberately NOT under `/tenant/settings/`, even though the template list
 * is. In the App Router a nested layout always wraps its parent, so a page
 * there can never escape `TenantShell` and the settings rail - and a design
 * canvas squeezed beside a navigation rail is the thing this route exists to
 * fix. The page renders its own top bar and fills the viewport.
 */
export default function IdCardTemplateEditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-dvh overflow-hidden bg-background">{children}</div>;
}
