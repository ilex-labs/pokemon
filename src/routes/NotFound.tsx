import { Link } from 'react-router-dom'
import PageTitle from '../components/shared/PageTitle'

export default function NotFound() {
  return (
    <div>
      <PageTitle className="mb-2">Page not found</PageTitle>
      <p className="mb-6 text-sm text-body">
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
