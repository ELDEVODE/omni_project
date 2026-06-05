import type { ReactNode } from 'react'
import { ArcReactor } from '../components/ArcReactor.tsx'
import { Panel, PanelBar } from '../components/Panel.tsx'

type PlaceholderProps = {
	title: string
	subtitle: string
	children?: ReactNode
}

export function Placeholder({ title, subtitle, children }: PlaceholderProps) {
	return (
		<Panel>
			<PanelBar label={title.toUpperCase()} />
			<div
				style={{
					padding: '40px 20px',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					gap: 16,
					textAlign: 'center',
				}}
			>
				<ArcReactor size={56} />
				<div>
					<p
						className="hud-title"
						style={{
							fontSize: 'clamp(14px, 3vw, 18px)',
							color: 'rgba(0,212,255,0.6)',
							fontWeight: 600,
							marginBottom: 6,
						}}
					>
						{title}
					</p>
					<p
						className="hud-label"
						style={{ opacity: 0.4, fontSize: 'clamp(9px, 2vw, 11px)' }}
					>
						{subtitle}
					</p>
				</div>
				{children}
			</div>
		</Panel>
	)
}
