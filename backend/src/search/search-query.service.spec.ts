import { SearchQueryService } from './search-query.service';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

describe('global search SQL and access', () => {
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
  it('uses the indexed employee expression and a transaction-local fuzzy prefilter', async () => {
    const { service, queryRaw, executeRaw } = create();
    await service.search(
      { query: 'червнко', entityType: 'employee' },
      'ppe_specialist',
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
  it.each(['chief_engineer', 'engineer', 'operator', 'auditor'])(
    'queries only equipment for %s',
    async (role) => {
      const { service, queryRaw } = create();
      await service.search({ query: 'кур' }, role);
      const sql = queryRaw.mock.calls[0][0].sql;
      expect(sql).toContain('FROM search_index');
      expect(sql).not.toContain('FROM ppe_items');
      expect(sql).not.toContain('FROM employees emp');
      expect(sql).not.toContain('FROM positions pos');
    },
  );
  it.each(['ppe_specialist', 'accounting_specialist'])(
    'queries only active PPE and employees for %s',
    async (role) => {
      const { service, queryRaw } = create();
      await service.search({ query: 'кур' }, role);
      const sql = queryRaw.mock.calls[0][0].sql;
      expect(sql).not.toContain('FROM search_index');
      expect(sql).toContain('p.is_active = true');
      expect(sql).toContain('emp.is_active = true');
      expect(sql).toContain('FROM positions pos');
    },
  );
  it('merges all allowed domains before ranking and paginating once', async () => {
    const { service, queryRaw } = create();
    await service.search({ query: '3.955', limit: 20, offset: 10 }, 'admin');
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
  it.each([
    ['ppe_specialist', 'equipment'],
    ['chief_engineer', 'ppe_item'],
    ['unknown', undefined],
  ])(
    'does no database work for inaccessible scope %s / %s',
    async (role, entityType) => {
      const { service, queryRaw } = create();
      expect(await service.search({ query: 'кур', entityType }, role)).toEqual(
        [],
      );
      expect(queryRaw).not.toHaveBeenCalled();
    },
  );
  it('finds norms by active position without duplicating revisions', async () => {
    const { service, queryRaw } = create();
    await service.search(
      { query: 'инженер', entityType: 'ppe_norm' },
      'accounting_specialist',
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
    await service.search({ query: 'инженр', offset: 1200 }, 'admin');
    const statement = queryRaw.mock.calls[0][0];
    expect(statement.sql.match(/word_similarity/g)).toHaveLength(5);
    expect(statement.values.slice(-2)).toEqual([20, 1000]);
    expect(statement.sql).toContain('THEN 100 ELSE 0 END');
  });
  it.each(['equipment', 'ppe'])(
    'limits admin queries to module %s',
    async (module) => {
      const { service, queryRaw } = create();
      await service.search({ query: 'кур', module }, 'admin');
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
  it('does not grant equipment access through a module filter', async () => {
    const { service, queryRaw } = create();
    expect(
      await service.search(
        { query: 'кур', module: 'equipment' },
        'accounting_specialist',
      ),
    ).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
  it('does not query short input and escapes LIKE wildcards', async () => {
    const { service, queryRaw } = create();
    expect(await service.search({ query: 'к' }, 'admin')).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
    await service.search({ query: '3_%', entityType: 'ppe_item' }, 'admin');
    expect(queryRaw.mock.calls[0][0].values).toContain('%3\\_\\%%');
  });
  it('intersects multiple selected modules with role permissions', async () => {
    const { service, queryRaw } = create();
    await service.search({ query: 'кур', module: 'equipment,ppe' }, 'admin');
    expect(queryRaw.mock.calls[0][0].sql.match(/UNION ALL/g)).toHaveLength(3);
    queryRaw.mockClear();
    await service.search(
      { query: 'кур', module: 'equipment,ppe' },
      'accounting_specialist',
    );
    expect(queryRaw.mock.calls[0][0].sql).not.toContain('FROM search_index');
    expect(queryRaw.mock.calls[0][0].sql).toContain('FROM ppe_items');
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
    const items = await service.search({ query: 'иванв' }, 'engineer');
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
