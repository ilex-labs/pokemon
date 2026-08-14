import { Link } from 'react-router-dom'
import PageTitle from '../components/shared/PageTitle'

const tools = [
  {
    to: '/daycare',
    title: 'Daycare Planner',
    description:
      'Work out which parents you need, how inheritance works in this game, and how to hatch the target faster.',
  },
  {
    to: '/postgame',
    title: 'Postgame Checklist',
    description:
      'Cut the postgame down to what still matters for your save — without digging through a wiki checklist.',
  },
]

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[65ch] pt-6 sm:pt-10 lg:mx-0 lg:pt-14">
      <PageTitle className="mb-4">Pokémon Tools</PageTitle>
      <p className="mb-10 text-base text-body sm:mb-12">
        The games leave a lot unexplained — inheritance, hatching, what still
        matters after the credits. These tools spell that out for the game
        you&apos;re playing.
      </p>

      <ul className="list-none border-t border-edge p-0">
        {tools.map((tool) => (
          <li key={tool.to} className="border-b border-edge">
            <Link to={tool.to} className="group block py-4 no-underline">
              <span className="block text-base font-medium text-bright transition-colors group-hover:text-body group-focus-visible:text-body">
                {tool.title}
              </span>
              <span className="mt-1 block text-sm text-body">
                {tool.description}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
