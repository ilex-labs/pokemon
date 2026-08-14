import { withNums } from '../../lib/withNums'

type OptionDescriptionProps = {
  text: string
}

/** Plain-language description shown under a selected option. */
export default function OptionDescription({ text }: OptionDescriptionProps) {
  if (!text) return null
  return <p className="mt-1 text-meta text-muted">{withNums(text)}</p>
}
