import type { CSSProperties } from 'react'

type Props = {
	size?: number
	style?: CSSProperties
}

export function ArcReactor({ size = 44, style }: Props) {
	return (
		<div
			className="arc-reactor"
			style={{ width: size, height: size, ...style }}
		>
			<div className="arc-ring arc-ring-1" />
			<div className="arc-ring arc-ring-2" />
			<div className="arc-core" />
		</div>
	)
}
