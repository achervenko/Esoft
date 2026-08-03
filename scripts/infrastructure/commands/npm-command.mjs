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
  return [...args];
}

export function npmCommandName(platform = process.platform) {
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

export function createNpmInvocation(options = {}) {
  const execPath = options.execPath ?? process.execPath;
  const npmExecPath = Object.hasOwn(options, 'npmExecPath')
    ? options.npmExecPath
    : process.env.npm_execpath;
  const platform = options.platform ?? process.platform;

  if (typeof npmExecPath === 'string' && npmExecPath.trim() !== '') {
    return {
      command: execPath,
      argsPrefix: [npmExecPath],
    };
  }

  return {
    command: npmCommandName(platform),
    argsPrefix: [],
  };
}
