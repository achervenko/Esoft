import {
  hasPermission,
  getPermissionRoles,
  type Permission,
} from '../auth/permission-policy';
import { USER_ROLES } from '../auth/role-module-policy';
import { SearchQueryService } from './search-query.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

describe('global search SQL and access', () => {
  const reader = (permission: Permission) => {
    const roles = getPermissionRoles(permission);
    expect(roles.length).toBeGreaterThan(0);
    return roles[0];
  };
  const equipmentReader = reader('equipment.read');
  const ppeReader = reader('ppe.read');
  const allDomainsReader = [...new Set([equipmentReader, ppeReader])].join(',');

  const create = () => {
    const queryRaw = jest
      .fn<Promise<unknown[]>, [Prisma.Sql]>()
      .mockResolvedValue([]);
    const executeRaw = jest
      .fn<Promise<number>, [TemplateStringsArray]>()
      .mockResolvedValue(0);
    const service = new SearchQueryService({
      $queryRaw: queryRaw,
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $queryRaw: queryRaw,
          $executeRaw: executeRaw,
        }),
    } as unknown as PrismaService);
    return { service, queryRaw, executeRaw };
  };
  describe.each(['limit', 'offset'] as const)('pagination %s', (field) => {
    it.each([
      10.9,
      '3.7',
      true,
      false,
      null,
      '',
      ' ',
      ' 10 ',
      '1e2',
      '0x10',
      [],
      {},
      NaN,
      Infinity,
      -1,
      9007199254740992,
    ])(
      'rejects invalid input %p before querying the database',
      async (value) => {
        const { service, queryRaw, executeRaw } = create();
        await expect(
          service.search({ query: 'кур', [field]: value }, allDomainsReader),
        ).rejects.toMatchObject({
          response: {
            code:
              field === 'limit'
                ? 'SEARCH_LIMIT_INVALID'
                : 'SEARCH_OFFSET_INVALID',
          },
        });
        expect(queryRaw).not.toHaveBeenCalled();
        expect(executeRaw).not.toHaveBeenCalled();
      },
    );
  });
  it('rejects zero limit and validates pagination even for a short query', async () => {
    const { service, queryRaw } = create();
    await expect(
      service.search({ query: '', limit: 0 }, allDomainsReader),
    ).rejects.toMatchObject({ response: { code: 'SEARCH_LIMIT_INVALID' } });
    expect(queryRaw).not.toHaveBeenCalled();
  });
  it.each([
    [{}, [20, 0]],
    [{ limit: '10', offset: '3' }, [10, 3]],
    [{ limit: 10, offset: 0 }, [10, 0]],
    [{ limit: 101, offset: 1001 }, [100, 1000]],
  ])(
    'preserves pagination defaults, integer inputs and result caps: %p',
    async (params, expected) => {
      const { service, queryRaw } = create();
      await service.search({ query: 'кур', ...params }, allDomainsReader);
      expect(queryRaw.mock.calls[0][0].values.slice(-2)).toEqual(expected);
    },
  );
  it('normalizes whitespace and empty elements in selected modules', async () => {
    const { service, queryRaw } = create();
    await service.search(
      { query: 'кур', module: 'equipment,ppe' },
      allDomainsReader,
    );
    const expected = queryRaw.mock.calls[0][0];
    queryRaw.mockClear();
    await service.search(
      { query: 'кур', module: ' equipment, ppe, ' },
      allDomainsReader,
    );
    expect(queryRaw.mock.calls[0][0]).toEqual(expected);
  });
  describe.each([
    ...USER_ROLES,
    'unknown',
    'engineer,storekeeper',
    'ppe_specialist,accounting_specialist',
    allDomainsReader,
  ])('search branches for %s', (role) => {
    const scopes = [
      { module: undefined, entityType: undefined },
      { module: 'equipment', entityType: undefined },
      { module: 'ppe', entityType: undefined },
      { module: ' equipment, ppe, ', entityType: undefined },
      { module: undefined, entityType: 'equipment' },
      { module: undefined, entityType: 'ppe_item' },
      { module: undefined, entityType: 'employee' },
      { module: undefined, entityType: 'ppe_norm' },
      { module: 'equipment', entityType: 'ppe_item' },
      { module: 'ppe', entityType: 'equipment' },
    ];
    it.each(scopes)(
      'intersects policy with module=$module entityType=$entityType',
      async (scope) => {
        const { service, queryRaw, executeRaw } = create();
        const modules =
          scope.module
            ?.split(',')
            .map((value) => value.trim())
            .filter(Boolean) ?? [];
        const domains = [
          {
            module: 'equipment',
            entityType: 'equipment',
            permission: 'equipment.read',
            sql: 'FROM search_index',
          },
          {
            module: 'ppe',
            entityType: 'ppe_item',
            permission: 'ppe.read',
            sql: 'FROM ppe_items',
          },
          {
            module: 'ppe',
            entityType: 'employee',
            permission: 'ppe.read',
            sql: 'FROM employees emp',
          },
          {
            module: 'ppe',
            entityType: 'ppe_norm',
            permission: 'ppe.read',
            sql: 'FROM positions pos',
          },
        ] as const;
        const expected = domains.filter(
          (domain) =>
            hasPermission(role, domain.permission) &&
            (!modules.length || modules.includes(domain.module)) &&
            (!scope.entityType || scope.entityType === domain.entityType),
        );
        const result = await service.search({ query: 'кур', ...scope }, role);
        if (!expected.length) {
          expect(result).toEqual([]);
          expect(queryRaw).not.toHaveBeenCalled();
          expect(executeRaw).not.toHaveBeenCalled();
          return;
        }
        expect(queryRaw).toHaveBeenCalledTimes(1);
        const sql = queryRaw.mock.calls[0][0].sql;
        for (const domain of domains) {
          expect(sql.includes(domain.sql)).toBe(expected.includes(domain));
        }
        if (expected.some((domain) => domain.entityType === 'ppe_item'))
          expect(sql).toContain('p.is_active = true');
        if (expected.some((domain) => domain.entityType === 'employee'))
          expect(sql).toContain('emp.is_active = true');
      },
    );
  });
  it('uses the indexed employee expression and a transaction-local fuzzy prefilter', async () => {
    const { service, queryRaw, executeRaw } = create();
    await service.search(
      { query: 'червнко', entityType: 'employee' },
      ppeReader,
    );
    const sql = queryRaw.mock.calls[0][0].sql;
    const name =
      "app_search_normalize(emp.last_name || ' ' || emp.first_name || CASE WHEN emp.middle_name IS NULL THEN '' ELSE ' ' || emp.middle_name END)";
    expect(sql).toContain(name);
    expect(sql).toContain(`${name} %> ? AND word_similarity`);
    expect(sql).not.toContain('regexp_replace');
    expect(executeRaw.mock.calls[0][0][0]).toBe(
      'SET LOCAL pg_trgm.word_similarity_threshold = 0.45',
    );
  });
  it('merges all allowed domains before ranking and paginating once', async () => {
    const { service, queryRaw } = create();
    await service.search(
      { query: '3.955', limit: 20, offset: 10 },
      allDomainsReader,
    );
    const statement = queryRaw.mock.calls[0][0];
    const sql = statement.sql;
    expect(sql).toContain('FROM search_index');
    expect(sql).toContain('FROM ppe_items');
    expect(sql).toContain('FROM employees emp');
    expect(sql).toContain("'ppe_norm'::text AS entity_type");
    expect(sql).toContain('FROM positions pos');
    expect(sql).toContain('EXISTS (SELECT 1 FROM ppe_norms norm');
    expect(sql.match(/UNION ALL/g)).toHaveLength(3);
    expect(sql.match(/LIMIT/g)).toHaveLength(1);
    expect(sql.indexOf('ORDER BY score DESC')).toBeGreaterThan(
      sql.lastIndexOf('UNION ALL'),
    );
    expect(statement.values.slice(-2)).toEqual([20, 10]);
    expect(sql).toContain('THEN 400');
    expect(sql).toContain('THEN 300');
    expect(sql).toContain('THEN 200');
  });
  it('finds norms by active position without duplicating revisions', async () => {
    const { service, queryRaw } = create();
    await service.search(
      { query: 'инженер', entityType: 'ppe_norm' },
      ppeReader,
    );
    const sql = queryRaw.mock.calls[0][0].sql;
    expect(sql).toContain('FROM positions pos');
    expect(sql).toContain('pos.is_active = true');
    expect(sql).toContain('EXISTS (SELECT 1 FROM ppe_norms norm');
    expect(sql).toContain("'#/ppe/positions/'");
    expect(sql).not.toContain('UNION ALL');
    expect(sql).not.toContain('FROM search_index');
  });
  it('includes fuzzy candidates after exact match tiers and caps expensive pagination offsets', async () => {
    const { service, queryRaw } = create();
    await service.search({ query: 'инженр', offset: 1200 }, allDomainsReader);
    const statement = queryRaw.mock.calls[0][0];
    expect(statement.sql.match(/word_similarity/g)).toHaveLength(5);
    expect(statement.values.slice(-2)).toEqual([20, 1000]);
    expect(statement.sql).toContain('THEN 100 ELSE 0 END');
  });
  it.each(['equipment', 'ppe'])(
    'limits SQL branches to module %s',
    async (module) => {
      const { service, queryRaw } = create();
      await service.search({ query: 'кур', module }, allDomainsReader);
      const sql = queryRaw.mock.calls[0][0].sql;
      if (module === 'equipment') {
        expect(sql).toContain('FROM search_index');
        expect(sql).not.toContain('FROM ppe_items');
        expect(sql).not.toContain('FROM positions pos');
      } else {
        expect(sql).not.toContain('FROM search_index');
        expect(sql).toContain('FROM ppe_items');
        expect(sql).toContain('FROM positions pos');
        expect(sql).toContain('FROM employees emp');
      }
    },
  );
  it('does not query short input and escapes LIKE wildcards', async () => {
    const { service, queryRaw } = create();
    expect(await service.search({ query: 'к' }, allDomainsReader)).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
    await service.search(
      { query: '3_%', entityType: 'ppe_item' },
      allDomainsReader,
    );
    expect(queryRaw.mock.calls[0][0].values).toContain('%3\\_\\%%');
  });
  it('returns structured field matches and uses the search fuzzy threshold', async () => {
    const { service, queryRaw } = create();
    const matches = [{ field: 'responsible', value: 'Иванов Иван' }];
    queryRaw.mockResolvedValueOnce([
      {
        id: '1',
        entity_type: 'equipment',
        entity_id: 1,
        title: 'Насос',
        subtitle: 'ИНВ-1',
        search_text: 'насос иванов иван',
        score: 100,
        target_url: '#/equipment/1',
        matched_fields: matches,
      },
    ]);
    const items = await service.search(
      { query: 'иванв', entityType: 'equipment' },
      equipmentReader,
    );
    expect(items[0].matches).toEqual(matches);
    const sql = queryRaw.mock.calls[0][0].sql;
    expect(sql).toContain("('workshop', matches.workshop, 3)");
    expect(sql).toContain('AS matched_fields');
    expect(sql).toContain('candidate.value');
    // Every LIKE must use the same single-character escape, including metadata.
    const escapes = [...sql.matchAll(/ESCAPE '([^']*)'/g)].map(
      (match) => match[1],
    );
    expect(escapes.every((escape) => escape === '\\')).toBe(true);
    expect(sql.match(/> 0\.45/g)).toHaveLength(2);
  });
});
