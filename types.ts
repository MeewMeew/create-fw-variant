import type { PackageManager } from "./helpers/get-pkg-manager";

export type TemplateType = "15-shadcn"

export interface InstallTemplateArgs {
  appName: string;
  root: string;
  packageManager: PackageManager;
  isOnline: boolean;
  template: TemplateType;
  skipInstall: boolean;
}

export interface Template {
  title: string;
  value: TemplateType;
}

export type InstallTemplate = (args: InstallTemplateArgs) => Promise<{
  hasPackageJson: boolean
}>