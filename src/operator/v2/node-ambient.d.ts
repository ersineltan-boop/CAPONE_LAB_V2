declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function existsSync(path: string): boolean;
  export function writeFileSync(path: string, data: string, encoding: string): void;
}

declare module "node:path" {
  export function resolve(...parts: string[]): string;
}

declare module "node:child_process" {
  export function execFileSync(
    file: string,
    args?: readonly string[],
    options?: Record<string, unknown>,
  ): string;
}

declare const process: {
  platform: string;
  cwd(): string;
  env: Record<string, string | undefined>;
};
