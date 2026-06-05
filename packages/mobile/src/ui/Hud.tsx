// Reusable HUD-style primitives. Mirrors the look of the dashboard
// (`packages/web/src/styles/hud.css`) so the phone feels like part of
// the same family.

import type { ReactNode } from 'react'
import {
	StyleSheet,
	Text,
	type TextProps,
	View,
	type ViewProps,
} from 'react-native'

export const colors = {
	bg: '#020a12',
	panel: 'rgba(0, 30, 60, 0.55)',
	border: 'rgba(0, 212, 255, 0.25)',
	cyan: '#00d4ff',
	cyanDim: 'rgba(0, 212, 255, 0.6)',
	text: '#dff4ff',
	textDim: 'rgba(223, 244, 255, 0.55)',
	ok: '#28e07a',
	warn: '#f4b73c',
	err: '#ff5a5a',
} as const

export function Panel({
	children,
	style,
	...rest
}: ViewProps & { children?: ReactNode }) {
	return (
		<View style={[styles.panel, style]} {...rest}>
			{children}
		</View>
	)
}

export function HudLabel({
	children,
	style,
	...rest
}: TextProps & { children?: ReactNode }) {
	return (
		<Text style={[styles.label, style]} {...rest}>
			{children}
		</Text>
	)
}

export function HudTitle({
	children,
	style,
	...rest
}: TextProps & { children?: ReactNode }) {
	return (
		<Text style={[styles.title, style]} {...rest}>
			{children}
		</Text>
	)
}

export function HudBody({
	children,
	style,
	...rest
}: TextProps & { children?: ReactNode }) {
	return (
		<Text style={[styles.body, style]} {...rest}>
			{children}
		</Text>
	)
}

export function StatusDot({
	status,
}: { status: 'ok' | 'warn' | 'err' | 'idle' }) {
	const bg =
		status === 'ok'
			? colors.ok
			: status === 'warn'
				? colors.warn
				: status === 'err'
					? colors.err
					: '#444'
	return <View style={[styles.dot, { backgroundColor: bg }]} />
}

const styles = StyleSheet.create({
	panel: {
		backgroundColor: colors.panel,
		borderColor: colors.border,
		borderWidth: 1,
		borderRadius: 6,
		padding: 12,
	},
	title: {
		color: colors.cyan,
		fontSize: 18,
		fontWeight: '700',
		letterSpacing: 1,
	},
	label: {
		color: colors.cyanDim,
		fontSize: 10,
		letterSpacing: 1.5,
		textTransform: 'uppercase',
	},
	body: {
		color: colors.text,
		fontSize: 14,
		lineHeight: 20,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
})
