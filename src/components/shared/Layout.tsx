import { Link, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-page text-body">
      <header className="border-b border-edge px-4 py-3">
        <Link to="/" className="text-bright no-underline hover:text-accent-hover">
          Ilex Labs — Pokémon
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-edge px-4 py-4 text-sm text-muted">
        Unofficial and unaffiliated with Nintendo, Creatures Inc., Game Freak, or
        The Pokémon Company. Pokémon and Pokémon character names are trademarks of
        Nintendo, Creatures Inc., and Game Freak.
      </footer>
    </div>
  )
}
