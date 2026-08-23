const TEMPLATES = [
  { label: "CSV", href: "templates/template.csv" },
  { label: "JSON", href: "templates/template.json" },
  { label: "Excel", href: "templates/template.xlsx" },
]

export function TemplateDownloads() {
  return (
    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-500">
      <span>Need a template?</span>
      {TEMPLATES.map((template) => (
        <a
          key={template.label}
          href={template.href}
          download
          className="rounded border border-mts-border px-2 py-0.5 font-medium text-gray-400 transition-colors hover:border-mts-border-hover hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent"
        >
          {template.label}
        </a>
      ))}
    </div>
  )
}
