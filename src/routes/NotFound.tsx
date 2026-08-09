import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div>
      <h1 className="mb-2 text-2xl text-bright">Page not found</h1>
      <p className="mb-6 text-body">
        That path doesn&apos;t match any tool on this site.
      </p>
      <Link
        to="/"
        className="inline-block rounded bg-accent px-3 py-2 text-sm text-on-accent no-underline hover:bg-accent-hover"
      >
        Back to home
      </Link>
    </div>
  )
}
