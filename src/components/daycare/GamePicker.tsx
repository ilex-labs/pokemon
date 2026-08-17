import type { GameOption } from '../../data/loadGame'

type GamePickerProps = {
  options: GameOption[]
  value: string
  onChange: (gameId: string) => void
}

export default function GamePicker({
  options,
  value,
  onChange,
}: GamePickerProps) {
  return (
    <label className="block min-w-0">
      <span className="label-caps mb-1.5 block">Game</span>
      <select
        className="select-ui"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.displayName}
          </option>
        ))}
      </select>
    </label>
  )
}
