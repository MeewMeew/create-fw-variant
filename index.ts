#!/usr/bin/env node
/* eslint-disable import/no-extraneous-dependencies */

import { DownloadError, createApp } from './create-app'
import { TemplateType, templates } from './templates'
import { basename, resolve } from 'node:path'
import { bold, cyan, green, red, yellow } from 'picocolors'

import { Command } from 'commander'
import Conf from 'conf'
import type { InitialReturnValue } from 'prompts'
import type { PackageManager } from './helpers/get-pkg-manager'
import { existsSync } from 'node:fs'
import { getPkgManager } from './helpers/get-pkg-manager'
import { isFolderEmpty } from './helpers/is-folder-empty'
import packageJson from './package.json'
import prompts from 'prompts'
import updateCheck from 'update-check'
import { validateNpmName } from './helpers/validate-pkg'

let projectPath: string = ''

const handleSigTerm = () => process.exit(0)
const conf = new Conf({ projectName: 'create-n15' })

process.on('SIGINT', handleSigTerm)
process.on('SIGTERM', handleSigTerm)

const onPromptState = (state: {
  value: InitialReturnValue
  aborted: boolean
  exited: boolean
}) => {
  if (state.aborted) {
    // If we don't re-enable the terminal cursor before exiting
    // the program, the cursor will remain hidden
    process.stdout.write('\x1B[?25h')
    process.stdout.write('\n')
    process.exit(1)
  }
}

const program = new Command(packageJson.name)
  .version(
    packageJson.version,
    '-v, --version',
    'Output the current version of create-n15.'
  )
  .argument('[directory]')
  .usage('[directory] [options]')
  .helpOption('-h, --help', 'Display this help message.')
  .option(
    '--use-npm',
    'Explicitly tell the CLI to bootstrap the application using npm.'
  )
  .option(
    '--use-pnpm',
    'Explicitly tell the CLI to bootstrap the application using pnpm.'
  )
  .option(
    '--use-yarn',
    'Explicitly tell the CLI to bootstrap the application using Yarn.'
  )
  .option(
    '--use-bun',
    'Explicitly tell the CLI to bootstrap the application using Bun.'
  )
  .option(
    '--skip-install',
    'Explicitly tell the CLI to skip installing packages.'
  )
  .option('--disable-git', `Skip initializing a git repository.`)
  .action((name) => {
    // Commander does not implicitly support negated options. When they are used
    // by the user they will be interpreted as the positional argument (name) in
    // the action handler. See https://github.com/tj/commander.js/pull/1355
    if (name && !name.startsWith('--no-')) {
      projectPath = name
    }
  })
  .allowUnknownOption()
  .parse(process.argv)

const opts = program.opts()

const packageManager: PackageManager = !!opts.useNpm
  ? 'npm'
  : !!opts.usePnpm
    ? 'pnpm'
    : !!opts.useYarn
      ? 'yarn'
      : !!opts.useBun
        ? 'bun'
        : getPkgManager()

async function run(): Promise<void> {

  if (typeof projectPath === 'string') {
    projectPath = projectPath.trim()
  }

  if (!projectPath) {
    const res = await prompts({
      onState: onPromptState,
      type: 'text',
      name: 'path',
      message: 'What is your project named?',
      initial: 'my-app',
      validate: (name) => {
        const validation = validateNpmName(basename(resolve(name)))
        if (validation.valid) {
          return true
        }
        return 'Invalid project name: ' + validation.problems[0]
      },
    })

    if (typeof res.path === 'string') {
      projectPath = res.path.trim()
    }
  }

  if (!projectPath) {
    console.log(
      '\nPlease specify the project directory:\n' +
      `  ${cyan(opts.name())} ${green('<project-directory>')}\n` +
      'For example:\n' +
      `  ${cyan(opts.name())} ${green('my-next-app')}\n\n` +
      `Run ${cyan(`${opts.name()} --help`)} to see all options.`
    )
    process.exit(1)
  }

  const appPath = resolve(projectPath)
  const appName = basename(appPath)

  const validation = validateNpmName(appName)
  if (!validation.valid) {
    console.error(
      `Could not create a project called ${red(
        `"${appName}"`
      )} because of npm naming restrictions:`
    )

    validation.problems.forEach((p) =>
      console.error(`    ${red(bold('*'))} ${p}`)
    )
    process.exit(1)
  }

  if (existsSync(appPath) && !isFolderEmpty(appPath, appName)) {
    process.exit(1)
  }

  {
    const res = await prompts({
      type: "select",
      name: "template",
      message: "Select a template:",
      choices: templates,
      initial: 0,
    })

    if (res.template) {
      conf.set('template', res.template)
    }
  }

  {
    const res = await prompts({
      type: "select",
      name: "packageManager",
      message: "Select a package manager:",
      choices: [
        { title: "npm", value: "npm" },
        { title: "pnpm", value: "pnpm" },
        { title: "yarn", value: "yarn" },
        { title: "bun", value: "bun" },
      ],
      initial: 0,
    })

    if (res.packageManager) {
      conf.set('packageManager', res.packageManager)
    }
  }

  {
    const res = await prompts({
      type: "confirm",
      name: "disableGit",
      message: "Initialize a git repository?",
      initial: true,
    })

    if (res.disableGit) {
      conf.set('disableGit', !res.disableGit)
    }
  }

  {
    const res = await prompts({
      type: "confirm",
      name: "skipInstall",
      message: "Install dependencies?",
      initial: true,
    })

    if (res.skipInstall) {
      conf.set('skipInstall', !res.skipInstall)
    }
  }

  try {
    await createApp({
      appPath,
      packageManager: conf.get('packageManager') as PackageManager,
      skipInstall: conf.get('skipInstall') as boolean || false,
      disableGit: conf.get('disableGit') as boolean || false,
      template: conf.get('template') as TemplateType || '15-shadcn',
    })
  } catch (reason) {
    if (!(reason instanceof DownloadError)) {
      throw reason
    }

    await createApp({
      appPath,
      packageManager: conf.get('packageManager') as PackageManager,
      skipInstall: conf.get('skipInstall') as boolean || false,
      disableGit: conf.get('disableGit') as boolean || false,
      template: conf.get('template') as TemplateType || '15-shadcn',
    })
  }
}

const update = updateCheck(packageJson).catch(() => null)

async function notifyUpdate(): Promise<void> {
  try {
    if ((await update)?.latest) {
      const global = {
        npm: 'npm i -g',
        yarn: 'yarn global add',
        pnpm: 'pnpm add -g',
        bun: 'bun add -g',
      }
      const updateMessage = `${global[conf.get('packageManager') as PackageManager]} create-n15`
      console.log(
        yellow(bold('A new version of `create-n15` is available!')) +
        '\n' +
        'You can update by running: ' +
        cyan(updateMessage) +
        '\n'
      )
    }
    process.exit(0)
  } catch {
    // ignore error
  }
}

async function exit(reason: { command?: string }) {
  console.log()
  console.log('Aborting installation.')
  if (reason.command) {
    console.log(`  ${cyan(reason.command)} has failed.`)
  } else {
    console.log(
      red('Unexpected error. Please report it as a bug:') + '\n',
      reason
    )
  }
  console.log()
  await notifyUpdate()
  process.exit(1)
}

run().then(notifyUpdate).catch(exit)