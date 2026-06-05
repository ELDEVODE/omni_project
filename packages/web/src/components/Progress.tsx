// HUD-styled progress primitives used across the dashboard panels.
// Provides: <Spinner />, <Bar />, <Elapsed />, and <Stepper />.

import { useEffect, useState } from 'react'

// ---------------------------------------------------------------------------
// Spinner — CSS-only animated ring in the cyan HUD accent color. We avoid the
// old three-dot "thinking" pattern here because we want a real rotating
// indicator that signals "this is doing work" rather than "thinking".

interface SpinnerProps {
	size?: number
	color?: string
	label?: string
}

export function Spinner({
	size = 14,
	color = 'var(--hud-cyan, #00d4ff)',
	label,
}: SpinnerProps) {
	return (
		<span
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 8,
				fontFamily: 'var(--font-hud)',
				fontSize: 11,
				letterSpacing: '0.1em',
				color: 'rgba(0, 212, 255, 0.7)',
			}}
		>
			<span
				className="hud-spinner"
				style={{
					width: size,
					height: size,
					border: `1.5px solid ${color}33`,
					borderTopColor: color,
					borderRadius: '50%',
					display: 'inline-block',
				}}
			/>
			{label ? <span>{label}</span> : null}
		</span>
	)
}

// ---------------------------------------------------------------------------
// Bar — thin horizontal progress bar. `percent` is 0..100 (clamped). When
// `percent` is `null` the bar shows an indeterminate sweep animation.

interface BarProps {
	percent: number | null
	label?: string
	right?: React.ReactNode
	color?: string
	height?: number
}

export function Bar({
	percent,
	label,
	right,
	color = '#00d4ff',
	height = 4,
}: BarProps) {
	const clamped = percent === null ? null : Math.max(0, Math.min(100, percent))
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 6,
				fontFamily: 'var(--font-hud)',
				fontSize: 10,
				letterSpacing: '0.08em',
			}}
		>
			{(label || right) && (
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						color: 'rgba(0, 212, 255, 0.6)',
					}}
				>
					<span>{label ?? ''}</span>
					{right ? <span style={{ opacity: 0.85 }}>{right}</span> : null}
				</div>
			)}
			<div
				style={{
					position: 'relative',
					height,
					background: 'rgba(0, 212, 255, 0.08)',
					border: '1px solid rgba(0, 212, 255, 0.18)',
					overflow: 'hidden',
				}}
			>
				{clamped === null ? (
					<div
						className="hud-bar-sweep"
						style={{ background: color, height: '100%' }}
					/>
				) : (
					<div
						style={{
							width: `${clamped}%`,
							height: '100%',
							background: `linear-gradient(90deg, ${color}aa, ${color})`,
							transition: 'width 200ms ease',
						}}
					/>
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------
// Elapsed — `MM:SS` counter that updates every second. Pass `from` as a Date
// or epoch ms; pass `paused` to stop the tick and freeze the displayed value.

interface ElapsedProps {
	from: Date | number
	paused?: boolean
	prefix?: string
}

export function Elapsed({ from, paused = false, prefix = '' }: ElapsedProps) {
	const startMs = typeof from === 'number' ? from : from.getTime()
	const [now, setNow] = useState(Date.now())
	useEffect(() => {
		if (paused) return
		const t = setInterval(() => setNow(Date.now()), 250)
		return () => clearInterval(t)
	}, [paused])
	const secs = Math.max(0, Math.floor((now - startMs) / 1000))
	const m = Math.floor(secs / 60)
	const s = secs % 60
	const text = `${m}:${String(s).padStart(2, '0')}`
	return (
		<span
			style={{
				fontFamily: 'var(--font-hud)',
				fontSize: 10,
				letterSpacing: '0.08em',
				color: 'rgba(0, 212, 255, 0.5)',
				fontVariantNumeric: 'tabular-nums',
			}}
		>
			{prefix}
			{text}
		</span>
	)
}

// ---------------------------------------------------------------------------
// Stepper — vertical checklist. Each step has status `pending` / `active` /
// `done` / `failed`. Used by panels with multi-phase work (voice, models, etc).

export type StepStatus = 'pending' | 'active' | 'done' | 'failed'

export interface Step {
	label: string
	finalLabel?: string
	status: StepStatus
}

interface StepperProps {
	steps: Step[]
}

export function Stepper({ steps }: StepperProps) {
	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				gap: 6,
				fontFamily: 'var(--font-hud)',
				fontSize: 11,
				letterSpacing: '0.08em',
			}}
		>
			{steps.map((s, i) => {
				const color =
					s.status === 'done'
						? 'rgba(0, 255, 159, 0.85)'
						: s.status === 'failed'
							? 'rgba(255, 45, 85, 0.85)'
							: s.status === 'active'
								? 'rgba(0, 212, 255, 0.95)'
								: 'rgba(0, 212, 255, 0.3)'
				const glyph =
					s.status === 'done'
						? '✓'
						: s.status === 'failed'
							? '✗'
							: s.status === 'active'
								? '◉'
								: '·'
				return (
					<div
						key={`${s.label}-${i}`}
						style={{ display: 'flex', alignItems: 'center', gap: 10, color }}
					>
						<span
							style={{
								display: 'inline-block',
								width: 12,
								textAlign: 'center',
								fontWeight: 600,
							}}
						>
							{s.status === 'active' ? (
								<span
									className="hud-spinner"
									style={{ display: 'inline-block' }}
								>
									{glyph}
								</span>
							) : (
								glyph
							)}
						</span>
						<span>{s.finalLabel ?? s.label}</span>
					</div>
				)
			})}
		</div>
	)
}
