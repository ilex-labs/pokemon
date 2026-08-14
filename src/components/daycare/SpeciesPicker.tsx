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
      <span className="label-caps mb-1.5 block">Species</span>
      <select
        className="w-full rounded border border-edge bg-raised px-3 py-2 text-sm text-bright"
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
