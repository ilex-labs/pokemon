import { Link } from 'react-router-dom'

const tools = [
  {
    to: '/daycare',
    title: 'Daycare Planner',
    description: 'Plan egg pairs, inheritance, and hatch routes for a target spread.',
  },
  {
    to: '/postgame',
    title: 'Postgame Checklist',
    description: 'Generate a scoped checklist of postgame content for a game.',
  },
]

export default function Home() {
  return (
    <div>
      <h1 className="mb-2 text-2xl text-bright">Pokémon Tools</h1>
      <p className="mb-6 text-body">
        Static planners and checklists for egg daycare and postgame progress.
      </p>

      <ul className="list-none space-y-4 p-0">
        {tools.map((tool) => (
          <li key={tool.to}>
            <Link
              to={tool.to}
              className="block rounded border border-edge bg-surface px-4 py-3 text-bright no-underline hover:border-accent"
            >
              <span className="block font-medium">{tool.title}</span>
              <span className="mt-1 block text-sm text-body">{tool.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
