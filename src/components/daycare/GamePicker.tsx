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
    <label className="block">
      <span className="mb-1 block text-sm text-bright">Game</span>
      <select
        className="w-full rounded border border-edge bg-raised px-3 py-2 text-bright"
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
