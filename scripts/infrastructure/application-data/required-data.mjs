import { terminatePgClient } from '../postgres/pg-client-terminator.mjs';
import { failure, success } from '../result.mjs';
import { formatError } from '../security/redaction.mjs';

const MINIMUM_COUNTRIES = 200;
const REQUIRED_COUNTRY_ISO_CODES = Object.freeze(['LV', 'EE', 'LT']);

export async function checkRequiredApplicationData({ config, PgClient }) {
  const client = new PgClient({
    connectionString: config.database.url,
    connectionTimeoutMillis: 3_000,
  });
  let result;

  try {
    await client.connect();
    const queryResult = await client.query(
      `
        SELECT
          count(*)::integer AS count,
          count(DISTINCT iso) FILTER (
            WHERE iso = ANY($1::text[])
          )::integer AS required_count
        FROM countries
      `,
      [REQUIRED_COUNTRY_ISO_CODES],
    );
    const count = Number(queryResult.rows[0]?.count ?? 0);
    const requiredCount = Number(queryResult.rows[0]?.required_count ?? 0);

    if (
      count < MINIMUM_COUNTRIES ||
      requiredCount < REQUIRED_COUNTRY_ISO_CODES.length
    ) {
      result = failure(
        'APPLICATION_DATA_MISSING',
        'Required application data is missing',
        {
          countries: count,
          minimumCountries: MINIMUM_COUNTRIES,
          requiredCountryIsoCodes: [...REQUIRED_COUNTRY_ISO_CODES],
          requiredCountriesFound: requiredCount,
        },
      );
    } else {
      result = success('APPLICATION_DATA_OK', 'Required application data exists', {
        countries: count,
        requiredCountryIsoCodes: [...REQUIRED_COUNTRY_ISO_CODES],
        requiredCountriesFound: requiredCount,
      });
    }
  } catch (error) {
    result = failure(
      'APPLICATION_DATA_CHECK_FAILED',
      'Unable to check required application data',
      {
        error: formatError(error),
      },
    );
  }

  const cleanup = await closeRequiredApplicationDataClient(client);

  if (!cleanup.ok) {
    if (result.ok) {
      return failure(
        'APPLICATION_DATA_CHECK_FAILED',
        'Unable to check required application data',
        cleanup.details,
      );
    }

    return failure(result.code, result.message, {
      ...result.details,
      cleanupError: cleanup.details.error,
      ...('terminationError' in cleanup.details
        ? { terminationError: cleanup.details.terminationError }
        : {}),
    });
  }

  return result;
}

async function closeRequiredApplicationDataClient(client) {
  try {
    await client.end();
    return success('APPLICATION_DATA_CLIENT_CLOSED', 'PostgreSQL client closed');
  } catch (error) {
    const details = { error: formatError(error) };

    try {
      terminatePgClient(client);
    } catch (terminationError) {
      details.terminationError = formatError(terminationError);
    }

    return failure(
      'APPLICATION_DATA_CLIENT_CLOSE_FAILED',
      'Unable to close PostgreSQL client',
      details,
    );
  }
}
