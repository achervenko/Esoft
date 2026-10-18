import { Prisma } from '@prisma/client';

// Match whole tokens, including existing comma-separated values with whitespace.
export function hasAnyRoleSql(column: Prisma.Sql, roles: readonly string[]) {
  if (!roles.length) return Prisma.sql`false`;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM regexp_split_to_table(COALESCE(${column}, ''), ',') AS assigned_role(value)
    WHERE BTRIM(assigned_role.value) IN (${Prisma.join([...roles])})
  )`;
}

export async function countOtherActiveAdmins(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const rows = await tx.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT count(*) AS count FROM "user" u
    WHERE u.id <> ${userId} AND u.banned IS NOT TRUE
      AND ${hasAnyRoleSql(Prisma.sql`u.role`, ['admin'])}
  `);
  return Number(rows[0].count);
}
