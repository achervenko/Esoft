import { failure, success } from '../result.mjs';

const MINIMUM_COUNTRIES = 200;
const REQUIRED_COUNTRY_ISO_CODES = Object.freeze(['LV', 'EE', 'LT']);

export async function checkRequiredApplicationData({ config, PgClient }) {
  const client = new PgClient({
    connectionString: config.database.url,
    connectionTimeoutMillis: 3_000,
  });

  try {
    await client.connect();
    const result = await client.query(
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
    const count = Number(result.rows[0]?.count ?? 0);
    const requiredCount = Number(result.rows[0]?.required_count ?? 0);

    if (
      count < MINIMUM_COUNTRIES ||
      requiredCount < REQUIRED_COUNTRY_ISO_CODES.length
    ) {
      return failure(
        'APPLICATION_DATA_MISSING',
        'Required application data is missing',
        {
          countries: count,
          minimumCountries: MINIMUM_COUNTRIES,
          requiredCountryIsoCodes: [...REQUIRED_COUNTRY_ISO_CODES],
          requiredCountriesFound: requiredCount,
        },
      );
    }

    return success('APPLICATION_DATA_OK', 'Required application data exists', {
      countries: count,
      requiredCountryIsoCodes: [...REQUIRED_COUNTRY_ISO_CODES],
      requiredCountriesFound: requiredCount,
    });
  } catch (error) {
    return failure(
      'APPLICATION_DATA_CHECK_FAILED',
      'Unable to check required application data',
      {
        error: formatError(error),
      },
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}
