import { failure, success } from '../result.mjs';
import {
  formatError,
  redactSensitiveText,
} from '../security/redaction.mjs';

export async function getPostgresServiceState(
  serviceName,
  { platform = process.platform, runCommand, timeoutMs = 10_000 },
) {
  const platformFailure = checkWindowsPlatform(platform);

  if (platformFailure) {
    return platformFailure;
  }

  if (!serviceName) {
    return failure('POSTGRES_SERVICE_NAME_MISSING', 'POSTGRES_SERVICE_NAME is not set');
  }

  let result;

  try {
    result = await runCommand('sc.exe', ['query', serviceName], {
      timeoutMs,
    });
  } catch (error) {
    return failure(
      'POSTGRES_SERVICE_CHECK_FAILED',
      `Unable to query Windows service ${serviceName}`,
      {
        error: formatError(error),
      },
    );
  }

  if (!result.ok) {
    return classifyServiceQueryFailure(serviceName, result);
  }

  const stateMatch = result.stdout.match(/STATE\s*:\s*\d+\s+([A-Z_]+)/);

  if (!stateMatch) {
    return failure(
      'POSTGRES_SERVICE_STATE_UNKNOWN',
      `Unable to parse Windows service state for ${serviceName}`,
      { stdout: redactSensitiveText(result.stdout) },
    );
  }

  return success('POSTGRES_SERVICE_STATE_READ', 'Windows service state was read', {
    serviceName,
    state: stateMatch[1],
  });
}

export async function startPostgresService(
  serviceName,
  { platform = process.platform, runCommand, timeoutMs = 20_000 },
) {
  const platformFailure = checkWindowsPlatform(platform);

  if (platformFailure) {
    return platformFailure;
  }

  if (!serviceName) {
    return failure(
      'POSTGRES_SERVICE_NAME_MISSING',
      'POSTGRES_SERVICE_NAME is required to start Windows service',
    );
  }

  let result;

  try {
    result = await runCommand('sc.exe', ['start', serviceName], {
      timeoutMs,
    });
  } catch (error) {
    return failure(
      'POSTGRES_SERVICE_START_FAILED',
      `Unable to start Windows service ${serviceName}`,
      {
        error: formatError(error),
      },
    );
  }

  if (!result.ok) {
    if (result.timedOut) {
      return failure(
        'POSTGRES_SERVICE_START_TIMEOUT',
        `Timed out while starting Windows service ${serviceName}`,
        commandDetails(result),
      );
    }

    const accessDenied = isWindowsAccessDenied(result);

    return failure(
      accessDenied
        ? 'POSTGRES_SERVICE_START_ACCESS_DENIED'
        : 'POSTGRES_SERVICE_START_FAILED',
      accessDenied
        ? 'Unable to start Windows service without administrator privileges'
        : `Unable to start Windows service ${serviceName}`,
      commandDetails(result),
    );
  }

  return success(
    'POSTGRES_SERVICE_START_REQUESTED',
    'Windows service start was requested',
    {
      serviceName,
    },
  );
}

export async function stopPostgresService(
  serviceName,
  { platform = process.platform, runCommand, timeoutMs = 20_000 },
) {
  const platformFailure = checkWindowsPlatform(platform);

  if (platformFailure) {
    return platformFailure;
  }

  if (!serviceName) {
    return failure(
      'POSTGRES_SERVICE_NAME_MISSING',
      'POSTGRES_SERVICE_NAME is required to stop Windows service',
    );
  }

  let result;

  try {
    result = await runCommand('sc.exe', ['stop', serviceName], {
      timeoutMs,
    });
  } catch (error) {
    return failure(
      'POSTGRES_SERVICE_STOP_FAILED',
      `Unable to stop Windows service ${serviceName}`,
      {
        error: formatError(error),
      },
    );
  }

  if (!result.ok) {
    if (result.timedOut) {
      return failure(
        'POSTGRES_SERVICE_STOP_TIMEOUT',
        `Timed out while stopping Windows service ${serviceName}`,
        commandDetails(result),
      );
    }

    const accessDenied = isWindowsAccessDenied(result);

    return failure(
      accessDenied
        ? 'POSTGRES_SERVICE_STOP_ACCESS_DENIED'
        : 'POSTGRES_SERVICE_STOP_FAILED',
      accessDenied
        ? 'Unable to stop Windows service without administrator privileges'
        : `Unable to stop Windows service ${serviceName}`,
      commandDetails(result),
    );
  }

  return success(
    'POSTGRES_SERVICE_STOP_REQUESTED',
    'Windows service stop was requested',
    {
      serviceName,
    },
  );
}

export function isWindowsAccessDenied(result) {
  const output = normalizeCommandOutput(result);

  return (
    result.code === 5 ||
    output.includes('access is denied') ||
    output.includes('отказано в доступе')
  );
}

function checkWindowsPlatform(platform) {
  if (platform === 'win32') {
    return null;
  }

  return failure(
    'POSTGRES_SERVICE_OPERATION_UNAVAILABLE',
    'Windows service operations are unavailable on this platform',
  );
}

function classifyServiceQueryFailure(serviceName, result) {
  if (result.timedOut) {
    return failure(
      'POSTGRES_SERVICE_CHECK_TIMEOUT',
      `Timed out while querying Windows service ${serviceName}`,
      commandDetails(result),
    );
  }

  if (isWindowsAccessDenied(result)) {
    return failure(
      'POSTGRES_SERVICE_CHECK_ACCESS_DENIED',
      `Access to Windows service ${serviceName} was denied`,
      commandDetails(result),
    );
  }

  if (isWindowsServiceMissing(result)) {
    return failure(
      'POSTGRES_SERVICE_NOT_FOUND',
      `Windows service ${serviceName} was not found`,
      commandDetails(result),
    );
  }

  return failure(
    'POSTGRES_SERVICE_CHECK_FAILED',
    `Unable to query Windows service ${serviceName}`,
    commandDetails(result),
  );
}

function isWindowsServiceMissing(result) {
  const output = normalizeCommandOutput(result);

  return (
    result.code === 1060 ||
    output.includes('specified service does not exist') ||
    output.includes('указанная служба не установлена')
  );
}

function normalizeCommandOutput(result) {
  return `${result.stdout ?? ''}\n${result.stderr ?? ''}`.toLowerCase();
}

function commandDetails(result) {
  return {
    code: result.code,
    stderr: redactSensitiveText(result.stderr),
    stdout: redactSensitiveText(result.stdout),
    timedOut: result.timedOut,
  };
}
