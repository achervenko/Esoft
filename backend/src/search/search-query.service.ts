import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { canReadEquipment, canReadPpe } from '../auth/role-permissions';
import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_DEFAULT_OFFSET,
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_QUERY_LENGTH,
} from './search.constants';
import { normalizeSearchQuery } from './search-normalization.helper';
import type { SearchResultDto } from './search.types';

type SearchRow = {
  matched_fields: SearchResultDto['matches'];
  id: string;
  entity_type: string;
  entity_id: number;
  title: string;
  search_text: string;
  subtitle: string | null;
  score: number | null;
  target_url: string | null;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  responsible: string | null;
  serial_number: string | null;
  status: string | null;
};

@Injectable()
export class SearchQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async search(
    params: {
      entityType?: unknown;
      module?: unknown;
      limit?: unknown;
      offset?: unknown;
      query?: unknown;
    },
    role: unknown,
  ): Promise<SearchResultDto[]> {
    const limit = Math.min(
      parsePaginationInteger(params.limit, SEARCH_DEFAULT_LIMIT, 1, 'limit'),
      SEARCH_MAX_LIMIT,
    );
    const offset = Math.min(
      parsePaginationInteger(params.offset, SEARCH_DEFAULT_OFFSET, 0, 'offset'),
      1000,
    );
    const query = normalizeSearchQuery(params.query);
    if (query.length < SEARCH_MIN_QUERY_LENGTH) return [];
    const entityType =
      typeof params.entityType === 'string' ? params.entityType.trim() : '';
    const module = typeof params.module === 'string' ? params.module : '';
    const modules = module
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (modules.some((entry) => !['equipment', 'ppe'].includes(entry)))
      return [];
    const equipmentAllowed =
      (!modules.length || modules.includes('equipment')) &&
      canReadEquipment(role);
    const ppeAllowed =
      (!modules.length || modules.includes('ppe')) && canReadPpe(role);
    const branches: Prisma.Sql[] = [];
    const contains = `%${this.escapeLike(query)}%`;
    const normalize = (value: Prisma.Sql) =>
      Prisma.sql`app_search_normalize(${value})`;
    const score = (
      title: Prisma.Sql,
      text: Prisma.Sql,
      article = Prisma.sql`NULL::text`,
      exactWords = Prisma.sql`false`,
    ) => Prisma.sql`
      CASE WHEN ${title} = ${query} OR ${article} = ${query} THEN 400
        WHEN ${title} LIKE ${this.escapeLike(query) + '%'} ESCAPE '\\' OR ${article} LIKE ${this.escapeLike(query) + '%'} ESCAPE '\\' THEN 300
        WHEN ${title} LIKE ${contains} ESCAPE '\\' OR ${article} LIKE ${contains} ESCAPE '\\' THEN 200
        WHEN ${text} LIKE ${contains} ESCAPE '\\' OR ${exactWords} THEN 100 ELSE 0 END
      + similarity(${text}, ${query}) AS score`;
    const fuzzy = (text: Prisma.Sql, indexed = false) =>
      query.length >= 3
        ? Prisma.sql`OR (${indexed ? Prisma.sql`${text} %> ${query} AND` : Prisma.empty} word_similarity(${query}, ${text}) > 0.45)`
        : Prisma.empty;
    const emptyDetails = Prisma.sql`NULL::text AS manufacturer, NULL::text AS model, NULL::text AS serial_number, NULL::text AS location, NULL::text AS responsible, NULL::text AS status, NULL::text AS workshop`;
    if (equipmentAllowed && (!entityType || entityType === 'equipment')) {
      const title = normalize(Prisma.sql`si.title`);
      const text = normalize(Prisma.sql`si.search_text`);
      branches.push(Prisma.sql`
        SELECT si.id::text AS id, 'equipment'::text AS entity_type, si.entity_id, si.title,
          concat_ws(' ', CASE WHEN nullif(e.serial_number, '') IS NOT NULL THEN '№ ' || e.serial_number END, s.name) AS subtitle, ${text} AS search_text,
          '#/equipment/' || e.visible_id::text AS target_url,
          m.name AS manufacturer, em.name AS model, e.serial_number,
          CASE WHEN w.name IS NOT NULL AND s.name IS NOT NULL THEN w.name || ' / ' || s.name ELSE NULL END AS location,
          NULLIF(concat_ws(' ', emp.last_name, emp.first_name, emp.middle_name), '') AS responsible,
          e.status::text AS status, w.name AS workshop, ${score(title, text)}
        FROM search_index si
        JOIN equipment e ON e.id = si.entity_id
        LEFT JOIN equipment_models em ON em.id = e.model_id
        LEFT JOIN manufacturers m ON m.id = em.manufacturer_id
        LEFT JOIN sections s ON s.id = e.section_id
        LEFT JOIN workshops w ON w.id = s.workshop_id
        LEFT JOIN employees emp ON emp.id = e.responsible_employee_id
        WHERE si.entity_type = 'equipment' AND si.is_active = true AND
          (${text} LIKE ${contains} ESCAPE '\\' OR ${title} LIKE ${contains} ESCAPE '\\' ${fuzzy(text, true)})
      `);
    }
    if (ppeAllowed && (!entityType || entityType === 'ppe_item')) {
      const title = normalize(Prisma.sql`p.name`);
      const article = normalize(Prisma.sql`p.article`);
      const text = normalize(Prisma.sql`p.article || ' ' || p.name`);
      branches.push(Prisma.sql`
        SELECT 'ppe:' || p.id::text AS id, 'ppe_item'::text AS entity_type, p.id AS entity_id, p.name AS title,
          'Артикул: ' || p.article AS subtitle, ${text} AS search_text, '#/ppe?tab=catalog&itemId=' || p.id::text AS target_url,
          ${emptyDetails}, ${score(title, text, article)}
        FROM ppe_items p WHERE p.is_active = true AND (${title} LIKE ${contains} ESCAPE '\\' OR ${article} LIKE ${contains} ESCAPE '\\' ${fuzzy(text, true)})
      `);
    }
    if (ppeAllowed && (!entityType || entityType === 'employee')) {
      const name = Prisma.sql`emp.last_name || ' ' || emp.first_name || CASE WHEN emp.middle_name IS NULL THEN '' ELSE ' ' || emp.middle_name END`;
      const title = normalize(name);
      const words = query
        .split(/\s+/)
        .map(
          (word) =>
            Prisma.sql`${title} LIKE ${'%' + this.escapeLike(word) + '%'} ESCAPE '\\'`,
        );
      branches.push(Prisma.sql`
        SELECT 'employee:' || emp.id::text AS id, 'employee'::text AS entity_type, emp.id AS entity_id,
          ${name} AS title, pos.name AS subtitle, ${title} AS search_text, '#/ppe/employees/' || emp.id::text AS target_url,
          ${emptyDetails}, ${score(title, title, Prisma.sql`NULL::text`, Prisma.sql`(${Prisma.join(words, ' AND ')})`)}
        FROM employees emp JOIN positions pos ON pos.id = emp.position_id
        WHERE emp.is_active = true AND (${Prisma.join(words, ' AND ')} ${fuzzy(title, true)})
      `);
    }
    if (ppeAllowed && (!entityType || entityType === 'ppe_norm')) {
      const title = normalize(Prisma.sql`pos.name`);
      branches.push(Prisma.sql`
        SELECT 'ppe-norm:' || pos.id::text AS id, 'ppe_norm'::text AS entity_type,
          pos.id AS entity_id, pos.name AS title, 'Нормы выдачи по должности'::text AS subtitle, ${title} AS search_text,
          '#/ppe/positions/' || pos.id::text AS target_url,
          ${emptyDetails}, ${score(title, title)}
        FROM positions pos
        WHERE pos.is_active = true AND (${title} LIKE ${contains} ESCAPE '\\' ${fuzzy(title, true)})
          AND EXISTS (SELECT 1 FROM ppe_norms norm WHERE norm.position_id = pos.id)
      `);
    }
    if (!branches.length) return [];
    const matchedValue = normalize(Prisma.sql`candidate.value`);
    const statement = Prisma.sql`
      SELECT matches.*, COALESCE((
        SELECT jsonb_agg(jsonb_build_object('field', candidate.field, 'value', candidate.value) ORDER BY candidate.ordinal)
        FROM (VALUES
          ('manufacturer', matches.manufacturer, 1),
          ('model', matches.model, 2),
          ('workshop', matches.workshop, 3),
          ('responsible', matches.responsible, 4),
          ('serialNumber', matches.serial_number, 5)
        ) AS candidate(field, value, ordinal)
        WHERE candidate.value IS NOT NULL AND candidate.value <> '' AND
          (${matchedValue} LIKE ${contains} ESCAPE '\\' ${fuzzy(matchedValue)})
      ), '[]'::jsonb) AS matched_fields
      FROM (${Prisma.join(branches, ' UNION ALL ')}) AS matches
      ORDER BY score DESC, title COLLATE "C" ASC, entity_type ASC, entity_id ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL pg_trgm.word_similarity_threshold = 0.45`;
      return tx.$queryRaw<SearchRow[]>(statement);
    });
    return rows.map((row) => ({
      id: row.id.toString(),
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
      matches: row.matched_fields ?? [],
      searchText: row.search_text,
      subtitle: row.subtitle,
      score: Number(row.score ?? 0),
      targetUrl: row.target_url,
      details: {
        location: row.location,
        manufacturer: row.manufacturer,
        model: row.model,
        responsible: row.responsible,
        serialNumber: row.serial_number,
        status: row.status,
      },
    }));
  }

  private escapeLike(value: string) {
    return value.replace(/[\\%_]/g, '\\$&');
  }
}

function parsePaginationInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  field: 'limit' | 'offset',
): number {
  if (value === undefined) return fallback;
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new BadRequestException({
      code:
        field === 'limit' ? 'SEARCH_LIMIT_INVALID' : 'SEARCH_OFFSET_INVALID',
      message: `Некорректный параметр ${field}.`,
    });
  }
  return parsed;
}
