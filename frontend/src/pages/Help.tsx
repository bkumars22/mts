import { Link } from "react-router-dom"
import { Header } from "../components/Header"
import { Card } from "../ui/Card"
import { TrustScoreBadge } from "../ui/Badge"

export default function Help() {
  return (
    <div className="min-h-screen bg-mts-bg text-gray-100">
      <Header />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mts-accent rounded"
        >
          <span aria-hidden="true">&larr;</span> Back to Dashboard
        </Link>

        <h1 className="mt-6 text-2xl font-bold text-white">How MTS works</h1>
        <p className="mt-2 text-gray-400">
          MTS checks whether the metrics on your dashboard are backed by enough good data to
          trust - not just what the number is.
        </p>

        <Card className="mt-8 p-6">
          <h2 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
            1. Upload a file
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Drag and drop, or click to browse for a <strong className="text-gray-200">CSV</strong>
            , <strong className="text-gray-200">JSON</strong>, or{" "}
            <strong className="text-gray-200">Excel</strong> file. Each row needs a{" "}
            <code className="rounded bg-mts-bg px-1 py-0.5 font-mono text-xs">timestamp</code>,{" "}
            <code className="rounded bg-mts-bg px-1 py-0.5 font-mono text-xs">metric_name</code>,
            and <code className="rounded bg-mts-bg px-1 py-0.5 font-mono text-xs">value</code>.
            An optional{" "}
            <code className="rounded bg-mts-bg px-1 py-0.5 font-mono text-xs">sample_size</code>{" "}
            column enables the sample size check. No file ever leaves your browser - everything
            runs locally. Don&apos;t have a file handy? Download a template or try one of the four
            examples from the main screen.
          </p>
        </Card>

        <Card className="mt-4 p-6">
          <h2 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
            2. MTS runs three checks
          </h2>
          <ul className="mt-3 space-y-3 text-sm text-gray-400">
            <li>
              <strong className="text-gray-200">Completeness</strong> - is data reporting at the
              expected frequency for that metric, or is there a coverage gap?
            </li>
            <li>
              <strong className="text-gray-200">Sample size adequacy</strong> - is a given
              reading backed by enough samples, or far below the historical norm?
            </li>
            <li>
              <strong className="text-gray-200">Outlier influence</strong> - are one or two
              extreme values skewing the metric's average?
            </li>
          </ul>
        </Card>

        <Card className="mt-4 p-6">
          <h2 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
            3. Read the trust score
          </h2>
          <div className="mt-3 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <TrustScoreBadge score="HIGH" />
              <span className="text-sm text-gray-400">all three checks passed</span>
            </div>
            <div className="flex items-center gap-2">
              <TrustScoreBadge score="MEDIUM" />
              <span className="text-sm text-gray-400">one check flagged something</span>
            </div>
            <div className="flex items-center gap-2">
              <TrustScoreBadge score="LOW" />
              <span className="text-sm text-gray-400">two or more checks flagged</span>
            </div>
          </div>
          <p className="mt-3 text-sm text-gray-400">
            Every score below HIGH always comes with the specific formula-backed reason - never
            just a bare label.
          </p>
        </Card>

        <Card className="mt-4 p-6">
          <h2 className="text-sm font-semibold tracking-wide text-gray-300 uppercase">
            4. Share the results
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Once analyzed, use <strong className="text-gray-200">Download CSV</strong> or{" "}
            <strong className="text-gray-200">Download PDF Report</strong> to save the results
            and share them with your team.
          </p>
        </Card>
      </main>
    </div>
  )
}
