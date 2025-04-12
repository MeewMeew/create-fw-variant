import type { PackageManager } from "../helpers/get-pkg-manager";

export type TemplateType = "15-shadcn"

export interface GetTemplateFileArgs {
  template: TemplateType;
  file: string;
}

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

