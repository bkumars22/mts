import { Link } from "react-router-dom"

export function Header() {
  return (
    <header className="border-b border-mts-border px-6 py-5">
      <div className="mx-auto flex max-w-4xl items-center justify-between">
        <Link to="/" className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent">
          <h1 className="text-lg font-bold tracking-tight text-mts-text">MTS</h1>
          <p className="text-xs text-mts-faint">Metric Trust Score</p>
        </Link>
        <Link
          to="/help"
          className="text-xs font-medium text-mts-muted transition-colors hover:text-mts-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent rounded"
        >
          Help
        </Link>
      </div>
    </header>
  )
}
