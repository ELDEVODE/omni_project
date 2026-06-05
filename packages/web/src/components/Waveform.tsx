type Props = { height?: number }

export function Waveform({ height = 24 }: Props) {
	return (
		<div style={{ display: 'flex', gap: 3, alignItems: 'center', height }}>
			{[1, 2, 3, 4, 5].map((i) => (
				<div key={i} className="wave-bar" style={{ height }} />
			))}
		</div>
	)
}
