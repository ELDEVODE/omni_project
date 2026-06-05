import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type HostConfig, loadConfig } from './config.ts'
import { log } from './log.ts'
import { loadQVACConfig } from './qvac/config.ts'
import { QVACProvider } from './qvac/provider.ts'
import { ModelRegistry } from './qvac/registry.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const PEM_CANDIDATES = [
	path.resolve(__dirname, '../localhost+1.pem'),
	path.resolve(__dirname, '../localhost+1-key.pem'),
	path.resolve(process.cwd(), 'localhost+1.pem'),
	path.resolve(process.cwd(), 'localhost+1-key.pem'),
	path.resolve(__dirname, '../../localhost+1.pem'),
	path.resolve(__dirname, '../../localhost+1-key.pem'),
]

function loadSslOptions(): { key: string; cert: string } | null {
	const certPath = PEM_CANDIDATES.find(
		(p) => p.endsWith('.pem') && fs.existsSync(p),
	)
	const keyPath = PEM_CANDIDATES.find(
		(p) => p.endsWith('-key.pem') && fs.existsSync(p),
	)
	if (!certPath || !keyPath) {
		log.warn('No TLS certs found — falling back to HTTP (development only)')
		return null
	}
	return {
		key: fs.readFileSync(keyPath, 'utf8'),
		cert: fs.readFileSync(certPath, 'utf8'),
	}
}

function checkRequestAuth(req: Request, secret: string | null): boolean {
	if (!secret) return true
	const url = new URL(req.url)
	const tokenParam = url.searchParams.get('token')
	if (tokenParam) return tokenParam === secret
	const auth = req.headers.get('authorization')
	if (auth?.startsWith('Bearer ')) {
		return auth.slice(7) === secret
	}
	return false
}

function unauthorizedResponse(): Response {
	return new Response(JSON.stringify({ error: 'unauthorized' }), {
		status: 401,
		headers: {
			'Content-Type': 'application/json',
			'WWW-Authenticate': 'Bearer realm="omni-mesh"',
			'Access-Control-Allow-Origin': '*',
		},
	})
}

function handleHealth(provider: QVACProvider): Response {
	return Response.json(
		{
			ok: true,
			service: 'omni-host',
			qvac: {
				provider: provider.ready,
				publicKey: provider.publicKey,
				loadedModels: provider.loadedModels,
			},
		},
		{ headers: { 'Access-Control-Allow-Origin': '*' } },
	)
}

const DASHBOARD_DIR = path.resolve(__dirname, '../../../web/dist')

function serveDashboard(req: Request): Response {
	const url = new URL(req.url)
	let filePath = url.pathname === '/' ? '/index.html' : url.pathname
	filePath = path.join(DASHBOARD_DIR, filePath)

	if (!filePath.startsWith(DASHBOARD_DIR)) {
		return new Response('Forbidden', { status: 403 })
	}

	if (!fs.existsSync(filePath)) {
		filePath = path.join(DASHBOARD_DIR, 'index.html')
	}

	const ext = path.extname(filePath)
	const contentType =
		ext === '.html'
			? 'text/html'
			: ext === '.js'
				? 'application/javascript'
				: ext === '.css'
					? 'text/css'
					: ext === '.json'
						? 'application/json'
						: ext === '.png'
							? 'image/png'
							: ext === '.svg'
								? 'image/svg+xml'
								: ext === '.ico'
									? 'image/x-icon'
									: ext === '.webmanifest'
										? 'application/manifest+json'
										: 'application/octet-stream'

	return new Response(fs.readFileSync(filePath), {
		headers: {
			'Content-Type': contentType,
			'Access-Control-Allow-Origin': '*',
		},
	})
}

export async function startHost(
	config: Partial<HostConfig> = {},
): Promise<void> {
	const cfg: HostConfig = loadConfig(config)
	const state = { secret: cfg.secret }
	const qvacCfg = loadQVACConfig()

	log.info('Initializing OmniMesh host…', {
		port: cfg.port,
		meshName: cfg.meshName,
	})

	const seed = crypto.randomBytes(32).toString('hex')

	const provider = new QVACProvider()
	await provider.start({
		seed,
		firewall: { mode: 'allow', allowEmpty: true },
		swarmRelays: qvacCfg.swarmRelays,
		cacheDirectory: qvacCfg.cacheDirectory,
		loggerLevel: qvacCfg.loggerLevel,
	})

	const registry = new ModelRegistry(provider.getSDK())

	const openaiPort = cfg.openaiPort ?? 11434
	let openaiServer: ReturnType<typeof spawn> | null = null
	const openaiUrl = `http://127.0.0.1:${openaiPort}`

	try {
		openaiServer = spawn(
			'qvac',
			['serve', 'openai', '--port', String(openaiPort), '--cors'],
			{
				stdio: ['ignore', 'pipe', 'pipe'],
				env: {
					...process.env,
					QVAC_CONFIG_PATH: path.resolve(process.cwd(), 'qvac.config.json'),
				},
			},
		)
		openaiServer.stdout?.on('data', (d) =>
			log.debug(`[qvac-serve] ${d.toString().trim()}`),
		)
		openaiServer.stderr?.on('data', (d) =>
			log.debug(`[qvac-serve] ${d.toString().trim()}`),
		)
		await new Promise((resolve) => setTimeout(resolve, 2000))
		log.info(`OpenAI-compat server started on ${openaiUrl}`)
	} catch (err) {
		log.warn(`Failed to start qvac serve openai: ${(err as Error).message}`)
	}

	const sslOptions = loadSslOptions()

	const server = Bun.serve({
		port: cfg.port,
		hostname: cfg.host,
		tls: sslOptions ?? undefined,
		idleTimeout: 255,
		async fetch(req) {
			const url = new URL(req.url)

			if (req.method === 'OPTIONS') {
				return new Response(null, {
					status: 200,
					headers: {
						'Access-Control-Allow-Origin': '*',
						'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
						'Access-Control-Allow-Headers': 'Content-Type, Authorization',
					},
				})
			}

			if (url.pathname === '/api/health') {
				return handleHealth(provider)
			}
			if (url.pathname === '/api/auth/status') {
				return Response.json({ required: Boolean(state.secret) })
			}
			if (
				url.pathname === '/api/admin/rotate-secret' &&
				req.method === 'POST'
			) {
				if (!checkRequestAuth(req, state.secret)) {
					return unauthorizedResponse()
				}
				const newSecret = crypto.randomBytes(24).toString('base64url')
				state.secret = newSecret
				process.env.OMNI_SECRET = newSecret
				log.warn('Secret rotated. Existing peers must re-pair.')
				return Response.json({ ok: true, secret: newSecret })
			}
			if (state.secret && !checkRequestAuth(req, state.secret)) {
				return unauthorizedResponse()
			}
			if (url.pathname === '/api/models' && req.method === 'GET') {
				const models = await registry.list()
				return Response.json(
					{ models, version: 1 },
					{ headers: { 'Access-Control-Allow-Origin': '*' } },
				)
			}
			if (url.pathname === '/api/qvac/provider' && req.method === 'GET') {
				return Response.json(
					{
						publicKey: provider.publicKey,
						loadedModels: provider.loadedModels,
						ready: provider.ready,
					},
					{ headers: { 'Access-Control-Allow-Origin': '*' } },
				)
			}

			return serveDashboard(req)
		},
	})

	const proto = sslOptions ? 'https' : 'http'
	const baseUrl = `${proto}://${cfg.host}:${cfg.port}`
	const displayUrl = state.secret ? `${baseUrl}?token=${state.secret}` : baseUrl

	log.info(`🚀 OmniMesh host online — ${displayUrl}`)
	log.info(
		`🛰  QVAC provider — ${provider.publicKey || 'not running (install @qvac/sdk)'}`,
	)
	log.info(`🤖 OpenAI-compat endpoint on ${openaiUrl}`)
	if (cfg.publicHost) {
		log.info(
			`🌐 Public URL: ${proto}://${cfg.publicHost}?token=${state.secret ?? ''}`,
		)
		log.info(
			`   Workers can join via: omni join ${provider.publicKey} --secret=<token>`,
		)
	}

	process.on('SIGINT', async () => {
		log.info('Shutting down...')
		openaiServer?.kill()
		await provider.stop()
		server.stop()
		process.exit(0)
	})
}

const isMain =
	import.meta.url === `file://${process.argv[1]}` ||
	process.argv[1]?.endsWith('index.ts') ||
	process.argv[1]?.endsWith('index.js')

if (isMain) {
	startHost().catch((err) => {
		log.error('Host failed to start', { error: (err as Error).message })
		process.exit(1)
	})
}

void loadQVACConfig
