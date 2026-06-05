export type IconProps = { s?: number }

export const Mic = ({ s = 16 }: IconProps) => (
	<svg
		width={s}
		height={s}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
		<path d="M19 10v2a7 7 0 0 1-14 0v-2" />
		<line x1="12" y1="19" x2="12" y2="23" />
		<line x1="8" y1="23" x2="16" y2="23" />
	</svg>
)

export const Stop = ({ s = 14 }: IconProps) => (
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
		<rect x="3" y="3" width="18" height="18" rx="3" />
	</svg>
)

export const SpeakerOn = ({ s = 15 }: IconProps) => (
	<svg
		width={s}
		height={s}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
		<path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
		<path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
	</svg>
)

export const SpeakerOff = ({ s = 15 }: IconProps) => (
	<svg
		width={s}
		height={s}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
		<line x1="23" y1="9" x2="17" y2="15" />
		<line x1="17" y1="9" x2="23" y2="15" />
	</svg>
)

export const Send = ({ s = 15 }: IconProps) => (
	<svg
		width={s}
		height={s}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<line x1="22" y1="2" x2="11" y2="13" />
		<polygon points="22 2 15 22 11 13 2 9 22 2" />
	</svg>
)

export const Cpu = ({ s = 13 }: IconProps) => (
	<svg
		width={s}
		height={s}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<rect x="4" y="4" width="16" height="16" rx="2" />
		<rect x="9" y="9" width="6" height="6" />
		<line x1="9" y1="1" x2="9" y2="4" />
		<line x1="15" y1="1" x2="15" y2="4" />
		<line x1="9" y1="20" x2="9" y2="23" />
		<line x1="15" y1="20" x2="15" y2="23" />
		<line x1="20" y1="9" x2="23" y2="9" />
		<line x1="20" y1="14" x2="23" y2="14" />
		<line x1="1" y1="9" x2="4" y2="9" />
		<line x1="1" y1="14" x2="4" y2="14" />
	</svg>
)

export const Wifi = ({ s = 13 }: IconProps) => (
	<svg
		width={s}
		height={s}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M5 12.55a11 11 0 0 1 14.08 0" />
		<path d="M1.42 9a16 16 0 0 1 21.16 0" />
		<path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
		<line x1="12" y1="20" x2="12.01" y2="20" />
	</svg>
)

export const Zap = ({ s = 13 }: IconProps) => (
	<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
		<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
	</svg>
)
