# Pokémon Tools (Ilex Labs)

Static planners and checklists for egg daycare and postgame progress. Hosted at [ilex-labs.com/pokemon/](https://ilex-labs.com/pokemon/).

## Tools

- **Daycare Planner** (`/daycare`) — project planner, inheritance rules, hatch routing
- **Postgame Checklist** (`/postgame`) — scoped postgame checklist generator

Shiny & Marks and Tera Matchups tools are planned later.

## License

Split licensing:

- **Code** (everything outside `data/`): [MIT](./LICENSE)
- **Dataset** (`data/` and self-written descriptions): [CC BY-NC-SA 4.0](./data/LICENSE)

## Develop

```bash
npm install
npm run dev
```

Preview the production build (subpath `/pokemon/`):

```bash
npm run build
npm run preview
```

Then open `http://localhost:4173/pokemon/`.
