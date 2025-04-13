#!/usr/bin/env node
/* eslint-disable import/no-extraneous-dependencies */

import { DownloadError, createApp } from './create-app'
import { TemplateType, templates } from './template'
import { basename, resolve } from 'node:path'
import { bold, cyan, red, yellow } from 'picocolors'

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
let packageManager = getPkgManager()

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

    conf.set('template', res.template)
  }

  {
    const pkgManagers = [
      { title: "npm", value: "npm" },
      { title: "pnpm", value: "pnpm" },
      { title: "yarn", value: "yarn" },
      { title: "bun", value: "bun" },
    ]

    const res = await prompts({
      type: "select",
      name: "packageManager",
      message: "Select a package manager:",
      choices: pkgManagers,
      initial: pkgManagers.findIndex(pkg => pkg.value === packageManager),
    })

    conf.set('packageManager', res.packageManager)
  }

  {
    const res = await prompts({
      type: "confirm",
      name: "enableGit",
      message: "Initialize a git repository?",
      initial: true,
    })

    conf.set('enableGit', res.enableGit)
  }

  {
    const res = await prompts({
      type: "confirm",
      name: "skipInstall",
      message: "Skip installing dependencies?",
      initial: false,
    })

    conf.set('skipInstall', res.skipInstall)
  }

  const createAppArgs = {
    appPath,
    packageManager: conf.get('packageManager') as PackageManager,
    skipInstall: conf.get('skipInstall') as boolean,
    enableGit: conf.get('enableGit') as boolean,
    template: conf.get('template') as TemplateType,
  }

  try {
    await createApp(createAppArgs)
  } catch (reason) {
    if (!(reason instanceof DownloadError)) {
      throw reason
    }
    await createApp(createAppArgs)
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
      const updateMessage = `${global[conf.get('packageManager') as PackageManager]} create-n15-variant`
      console.log(
        yellow(bold('A new version of `create-n15-variant` is available!')) + '\n'
        // 'You can update by running: ' +
        // cyan(updateMessage) +
        // '\n'
      )
      const res = await prompts({
        type: "confirm",
        name: "updatePackage",
        message: "Would you like to update now?",
        initial: true
      })

      if (res.updatePackage) {

      }
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