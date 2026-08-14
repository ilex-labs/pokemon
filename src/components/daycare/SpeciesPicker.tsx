type SpeciesPickerProps = {
  speciesNames: string[]
  value: string
  onChange: (species: string) => void
}

export default function SpeciesPicker({
  speciesNames,
  value,
  onChange,
}: SpeciesPickerProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-bright">Species</span>
      <select
        className="w-full rounded border border-edge bg-raised px-3 py-2 text-bright"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {speciesNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  )
}
