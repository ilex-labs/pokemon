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
        className="select-ui"
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
