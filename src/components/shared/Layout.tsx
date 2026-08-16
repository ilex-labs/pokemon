import { Link, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-page font-sans text-body">
      <header className="border-b border-edge">
        <div className="page-shell px-4 py-2.5 md:py-3">
          <Link
            to="/"
            className="text-sm font-medium text-bright no-underline hover:text-body"
          >
            Ilex Labs — Pokémon
          </Link>
        </div>
      </header>

      <main className="page-shell min-w-0 flex-1 px-4 py-4 md:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-edge">
        <div className="page-shell px-4 py-4 text-meta text-muted">
          Unofficial and unaffiliated with Nintendo, Creatures Inc., Game Freak, or
          The Pokémon Company. Pokémon and Pokémon character names are trademarks of
          Nintendo, Creatures Inc., and Game Freak.
        </div>
      </footer>
    </div>
  )
}
