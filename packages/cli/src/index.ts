import { doctorCommand } from './commands/doctor.ts'
import { hostCommand } from './commands/host.ts'
import { installCommand } from './commands/install.ts'
import { joinCommand } from './commands/join.ts'
import { modelsCommand } from './commands/models.ts'
import { rotateSecretCommand } from './commands/rotate-secret.ts'
import { type Command, runCli } from './router.ts'
import { BANNER } from './ui/banner.ts'

const commands: Command[] = [
	hostCommand,
	joinCommand,
	doctorCommand,
	installCommand,
	modelsCommand,
	rotateSecretCommand,
]

const argv = process.argv.slice(2)

const normalizedArgv = argv.length > 0 && (argv[0] === '--help' || argv[0] === '-h')
	? ['help', ...argv.slice(1)]
	: argv

if (
	normalizedArgv.length === 0 ||
	normalizedArgv[0] === 'help'
) {
	// eslint-disable-next-line no-console
	console.log(BANNER)
}

runCli(commands, normalizedArgv).then((code) => {
	if (code !== 0) process.exit(code)
})
