export function createSpawnConfig(
  command,
  args,
  platform = process.platform,
  comSpec = process.env.ComSpec ?? 'cmd.exe',
) {
  const normalizedCommand = command.toLowerCase();

  if (
    platform === 'win32' &&
    (normalizedCommand.endsWith('.cmd') ||
      normalizedCommand.endsWith('.bat'))
  ) {
    assertSafeCmdPart(command);
    args.forEach(assertSafeCmdPart);

    return {
      args: ['/d', '/s', '/c', `"${quoteCmdCommand([command, ...args])}"`],
      command: comSpec,
      windowsVerbatimArguments: true,
    };
  }

  return { args, command, windowsVerbatimArguments: false };
}

function assertSafeCmdPart(value) {
  if (/[!%"\r\n]/.test(String(value))) {
    throw new TypeError(
      'Windows batch command arguments must not contain %, !, ", CR or LF',
    );
  }
}

function quoteCmdCommand(parts) {
  return parts.map(quoteCmdArgument).join(' ');
}

function quoteCmdArgument(value) {
  return `"${String(value)}"`;
}
