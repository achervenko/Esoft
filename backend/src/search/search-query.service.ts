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
  id: bigint;
  entity_type: string;
  entity_id: number;
  title: string;
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

  async search(params: {
    entityType?: unknown;
    limit?: unknown;
    offset?: unknown;
    query?: unknown;
  }): Promise<SearchResultDto[]> {
    const query = normalizeSearchQuery(params.query);

    if (query.length < SEARCH_MIN_QUERY_LENGTH) {
      return [];
    }

    const limit = this.toLimit(params.limit);
    const offset = this.toOffset(params.offset);
    const entityType = this.toOptionalText(params.entityType);
    const startsWith = `${query}%`;
    const contains = `%${query}%`;
    const titleExpression = Prisma.sql`regexp_replace(replace(lower(title), chr(1105), chr(1077)), '[[:space:]]+', ' ', 'g')`;
    const entityFilter = entityType
      ? Prisma.sql`AND entity_type = ${entityType}`
      : Prisma.empty;
    const similarityFilter =
      query.length >= 3
        ? Prisma.sql`OR similarity(search_text, ${query}) > 0.2`
        : Prisma.empty;
    const scoreExpression =
      query.length >= 3
        ? Prisma.sql`similarity(search_text, ${query})`
        : Prisma.sql`0`;

    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT
        search_index.id,
        entity_type,
        entity_id,
        title,
        subtitle,
        CASE
          WHEN entity_type = 'equipment' THEN '#/equipment/' || equipment.visible_id::text
          ELSE NULL
        END AS target_url,
        manufacturers.name AS manufacturer,
        equipment_models.name AS model,
        equipment.serial_number,
        CASE
          WHEN workshops.name IS NOT NULL AND sections.name IS NOT NULL
          THEN workshops.name || ' / ' || sections.name
          ELSE NULL
        END AS location,
        NULLIF(concat_ws(
          ' ',
          employees.last_name,
          employees.first_name,
          employees.middle_name
        ), '') AS responsible,
        equipment.status::text AS status,
        ${scoreExpression} AS score
      FROM search_index
      LEFT JOIN equipment
        ON entity_type = 'equipment'
        AND equipment.id = entity_id
      LEFT JOIN manufacturers
        ON manufacturers.id = equipment.manufacturer_id
      LEFT JOIN equipment_models
        ON equipment_models.id = equipment.model_id
      LEFT JOIN sections
        ON sections.id = equipment.section_id
      LEFT JOIN workshops
        ON workshops.id = sections.workshop_id
      LEFT JOIN employees
        ON employees.id = equipment.responsible_employee_id
      WHERE is_active = true
        ${entityFilter}
        AND (
          ${titleExpression} = ${query}
          OR ${titleExpression} LIKE ${startsWith}
          OR ${titleExpression} LIKE ${contains}
          OR search_text ILIKE ${contains}
          ${similarityFilter}
        )
      ORDER BY
        CASE
          WHEN ${titleExpression} = ${query} THEN 0
          WHEN ${titleExpression} LIKE ${startsWith} THEN 1
          WHEN ${titleExpression} LIKE ${contains} THEN 2
          WHEN search_text ILIKE ${contains} THEN 3
          ELSE 4
        END ASC,
        score DESC,
        title ASC,
        search_index.id ASC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return rows.map((row) => ({
      id: row.id.toString(),
      entityType: row.entity_type,
      entityId: row.entity_id,
      title: row.title,
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

  private toLimit(value: unknown) {
    const parsed = Number(value ?? SEARCH_DEFAULT_LIMIT);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return SEARCH_DEFAULT_LIMIT;
    }

    return Math.min(Math.trunc(parsed), SEARCH_MAX_LIMIT);
  }

  private toOffset(value: unknown) {
    const parsed = Number(value ?? SEARCH_DEFAULT_OFFSET);

    if (!Number.isFinite(parsed) || parsed < 0) {
      return SEARCH_DEFAULT_OFFSET;
    }

    return Math.trunc(parsed);
  }

  private toOptionalText(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
