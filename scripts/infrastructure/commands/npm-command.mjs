export function npmScriptArgs(
  script,
  workspace,
  extraArgs = [],
  platform = process.platform,
) {
  return npmArgs(
    [
      'run',
      script,
      '--workspace',
      workspace,
      ...(extraArgs.length === 0 ? [] : ['--', ...extraArgs]),
    ],
    platform,
  );
}

export function npmArgs(args, _platform = process.platform) {
  const npmExecPath = process.env.npm_execpath;

  return npmExecPath ? [npmExecPath, ...args] : [...args];
}

export function npmCommandName(platform = process.platform) {
  if (process.env.npm_execpath) {
    return process.execPath;
  }

  return platform === 'win32' ? 'npm.cmd' : 'npm';
}
