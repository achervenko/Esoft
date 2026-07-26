export function npmScriptArgs(
  script,
  workspace,
  extraArgs = [],
  platform = process.platform,
) {
  return npmArgs([
    'run',
    script,
    '--workspace',
    workspace,
    ...(extraArgs.length === 0 ? [] : ['--', ...extraArgs]),
  ], platform);
}

export function npmArgs(args, _platform = process.platform) {
  return [...args];
}

export function npmCommandName(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}
