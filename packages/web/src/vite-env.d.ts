/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_HOST_URL?: string
	readonly VITE_PROTOCOL_VERSION?: string
}

interface ImportMeta {
	readonly env: ImportMetaEnv
}
