import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_DEFAULT_OFFSET,
  SEARCH_MAX_LIMIT,
  SEARCH_MIN_QUERY_LENGTH,
} from './search.constants';
import { normalizeSearchQuery } from './search-normalization.helper';
import type { SearchResultDto } from './search.types';

type SearchRow = {
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
    const query = normalizeSearchQuery(params.query);
    if (query.length < SEARCH_MIN_QUERY_LENGTH) return [];
    const parsedLimit = Number(params.limit ?? SEARCH_DEFAULT_LIMIT);
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit >= 1
        ? Math.min(Math.trunc(parsedLimit), SEARCH_MAX_LIMIT)
        : SEARCH_DEFAULT_LIMIT;
    const parsedOffset = Number(params.offset ?? SEARCH_DEFAULT_OFFSET);
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset >= 0
        ? Math.min(1000, Math.trunc(parsedOffset))
        : SEARCH_DEFAULT_OFFSET;
    const entityType =
      typeof params.entityType === 'string' ? params.entityType.trim() : '';
    const module = typeof params.module === 'string' ? params.module : '';
    const modules = module ? module.split(',') : [];
    if (modules.some((entry) => !['equipment', 'ppe'].includes(entry)))
      return [];
    const equipmentAllowed =
      (!modules.length || modules.includes('equipment')) &&
      typeof role === 'string' &&
      ['admin', 'chief_engineer', 'engineer', 'operator', 'auditor'].includes(
        role,
      );
    const ppeAllowed =
      (!modules.length || modules.includes('ppe')) &&
      typeof role === 'string' &&
      ['admin', 'ppe_specialist', 'accounting_specialist'].includes(role);
    const branches: Prisma.Sql[] = [];
    const contains = `%${this.escapeLike(query)}%`;
    const normalize = (value: Prisma.Sql) =>
      Prisma.sql`regexp_replace(replace(lower(${value}), chr(1105), chr(1077)), '[[:space:]]+', ' ', 'g')`;
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
    const fuzzy = (text: Prisma.Sql) =>
      query.length >= 3
        ? Prisma.sql`OR word_similarity(${query}, ${text}) > 0.45`
        : Prisma.empty;
    const emptyDetails = Prisma.sql`NULL::text AS manufacturer, NULL::text AS model, NULL::text AS serial_number, NULL::text AS location, NULL::text AS responsible, NULL::text AS status`;
    if (equipmentAllowed && (!entityType || entityType === 'equipment')) {
      const title = normalize(Prisma.sql`si.title`);
      const text = normalize(Prisma.sql`si.search_text`);
      branches.push(Prisma.sql`
        SELECT si.id::text AS id, 'equipment'::text AS entity_type, si.entity_id, si.title, si.subtitle, ${text} AS search_text,
          '#/equipment/' || e.visible_id::text AS target_url,
          m.name AS manufacturer, em.name AS model, e.serial_number,
          CASE WHEN w.name IS NOT NULL AND s.name IS NOT NULL THEN w.name || ' / ' || s.name ELSE NULL END AS location,
          NULLIF(concat_ws(' ', emp.last_name, emp.first_name, emp.middle_name), '') AS responsible,
          e.status::text AS status, ${score(title, text)}
        FROM search_index si
        JOIN equipment e ON e.id = si.entity_id
        LEFT JOIN equipment_models em ON em.id = e.model_id
        LEFT JOIN manufacturers m ON m.id = em.manufacturer_id
        LEFT JOIN sections s ON s.id = e.section_id
        LEFT JOIN workshops w ON w.id = s.workshop_id
        LEFT JOIN employees emp ON emp.id = e.responsible_employee_id
        WHERE si.entity_type = 'equipment' AND si.is_active = true AND
          (${text} LIKE ${contains} ESCAPE '\\' OR ${title} LIKE ${contains} ESCAPE '\\' ${fuzzy(text)})
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
        FROM ppe_items p WHERE p.is_active = true AND (${title} LIKE ${contains} ESCAPE '\\' OR ${article} LIKE ${contains} ESCAPE '\\' ${fuzzy(text)})
      `);
    }
    if (ppeAllowed && (!entityType || entityType === 'employee')) {
      const name = Prisma.sql`concat_ws(' ', emp.last_name, emp.first_name, emp.middle_name)`;
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
        WHERE emp.is_active = true AND (${Prisma.join(words, ' AND ')} ${fuzzy(title)})
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
        WHERE pos.is_active = true AND (${title} LIKE ${contains} ESCAPE '\\' ${fuzzy(title)})
          AND EXISTS (SELECT 1 FROM ppe_norms norm WHERE norm.position_id = pos.id)
      `);
    }
    if (!branches.length) return [];
    const rows = await this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`
      SELECT * FROM (${Prisma.join(branches, ' UNION ALL ')}) AS matches
      ORDER BY score DESC, title COLLATE "C" ASC, entity_type ASC, entity_id ASC
      LIMIT ${limit} OFFSET ${offset}
    `);
    return rows.map((row) => ({
      id: row.id.toString(),
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
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
