import type { CSSProperties, ReactNode } from 'react'

type PanelProps = {
	className?: string
	style?: CSSProperties
	children: ReactNode
}

export function Panel({ className = '', style, children }: PanelProps) {
	return (
		<div className={`hud-panel ${className}`} style={style}>
			<div className="hud-br">{children}</div>
		</div>
	)
}

type PanelBarProps = {
	label: string
	right?: ReactNode
}

export function PanelBar({ label, right }: PanelBarProps) {
	return (
		<div
			style={{
				padding: '10px 14px',
				borderBottom: '1px solid rgba(0,212,255,0.12)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 8,
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
				<div style={{ display: 'flex', gap: 5 }}>
					{[
						'rgba(255,45,85,0.6)',
						'rgba(255,159,0,0.6)',
						'rgba(0,255,159,0.6)',
					].map((c) => (
						<div
							key={c}
							style={{
								width: 7,
								height: 7,
								borderRadius: '50%',
								background: c,
							}}
						/>
					))}
				</div>
				<span className="hud-label">{label}</span>
			</div>
			{right}
		</div>
	)
}
