export function Thinking() {
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				padding: '12px 0',
			}}
		>
			<div style={{ display: 'flex', gap: 5 }}>
				<div className="think-dot" />
				<div className="think-dot" />
				<div className="think-dot" />
			</div>
			<span
				style={{
					fontFamily: 'var(--font-hud)',
					fontSize: 11,
					color: 'rgba(0,212,255,0.45)',
					letterSpacing: '0.1em',
				}}
			>
				PROCESSING QUERY...
			</span>
		</div>
	)
}
