/* eslint-disable import/no-extraneous-dependencies */

import { basename, dirname, join, resolve } from 'node:path'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { cyan, green, red } from 'picocolors'
import { getTemplateFile, installTemplate } from './templates'

import type { PackageManager } from './helpers/get-pkg-manager'
import type { TemplateType } from './templates'
import { getOnline } from './helpers/is-online'
import { install } from './helpers/install'
import { isFolderEmpty } from './helpers/is-folder-empty'
import { isWriteable } from './helpers/is-writeable'
import retry from 'async-retry'
import { tryGitInit } from './helpers/git'

export class DownloadError extends Error { }

export async function createApp({
  appPath,
  packageManager,
  skipInstall,
  disableGit,
  template,
}: {
  appPath: string
  packageManager: PackageManager
  skipInstall: boolean
  disableGit?: boolean,
  template: TemplateType
}): Promise<void> {
  const root = resolve(appPath)

  if (!(await isWriteable(dirname(root)))) {
    console.error(
      'The application path is not writable, please check folder permissions and try again.'
    )
    console.error(
      'It is likely you do not have write permissions for this folder.'
    )
    process.exit(1)
  }

  const appName = basename(root)

  mkdirSync(root, { recursive: true })
  if (!isFolderEmpty(root, appName)) {
    process.exit(1)
  }

  const useYarn = packageManager === 'yarn'
  const isOnline = !useYarn || (await getOnline())
  const originalDirectory = process.cwd()

  console.log(`Creating a new Next.js app in ${green(root)}.`)
  console.log()

  process.chdir(root)

  let hasPackageJson = false

  await installTemplate({
    appName,
    root,
    packageManager,
    isOnline,
    template,
    skipInstall,
  })

  if (disableGit) {
    console.log('Skipping git initialization.')
    console.log()
  } else if (tryGitInit(root)) {
    console.log('Initialized a git repository.')
    console.log()
  }

  let cdpath: string
  if (join(originalDirectory, appName) === appPath) {
    cdpath = appName
  } else {
    cdpath = appPath
  }

  console.log(green('Success!'))

  if (hasPackageJson) {
    console.log('Inside that directory, you can run several commands:')
    console.log()
    console.log(cyan(`  ${packageManager} ${useYarn ? '' : 'run '}dev`))
    console.log('    Starts the development server.')
    console.log()
    console.log(cyan(`  ${packageManager} ${useYarn ? '' : 'run '}build`))
    console.log('    Builds the app for production.')
    console.log()
    console.log(cyan(`  ${packageManager} start`))
    console.log('    Runs the built app in production mode.')
    console.log()
    console.log('We suggest that you begin by typing:')
    console.log()
    console.log(cyan('  cd'), cdpath)
    console.log(`  ${cyan(`${packageManager} ${useYarn ? '' : 'run '}dev`)}`)
  }
  console.log()
}