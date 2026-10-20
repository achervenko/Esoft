import { PpeIssueNormsGuardService } from './ppe-issue-norms-guard.service';
import { PpeIssueCatalogGuardService } from './ppe-issue-catalog-guard.service';
import { PpeIssueSizeService } from './ppe-issue-size.service';
import { Prisma, PpeItemType, type PpeIssue } from '@prisma/client';
import { PpeIssuesGuardsService } from './ppe-issues-guards.service';
import { toPpeIssueDto } from './ppe-issues.mapper';

it.each([PpeItemType.BODY, PpeItemType.TSHIRT])(
  'returns a historical heightValue for %s without the legacy field',
  (type) => {
    const dto = toPpeIssueDto({
      ppeItemTypeSnapshot: type,
      heightSnapshot: '182–188',
      quantity: new Prisma.Decimal(1),
      issuedAt: new Date('2026-10-20T00:00:00Z'),
    } as PpeIssue);
    expect(dto.heightValue).toBe('182–188');
    expect(dto).not.toHaveProperty('clothingHeight');
  },
);

it('recommends the independent T-shirt pair and snapshots its height', () => {
  const guards = new PpeIssuesGuardsService(
    new PpeIssueNormsGuardService(),
    new PpeIssueCatalogGuardService(),
    new PpeIssueSizeService(),
  );
  const sizes = {
    clothingSize: '48',
    clothingHeight: '170–176',
    tshirtSize: '52',
    tshirtHeight: '182–188',
    shoeSize: new Prisma.Decimal(42),
    gloveSize: null,
    headwearSize: null,
  };
  const employee = { ppeSizes: sizes } as Parameters<
    typeof guards.recommendSize
  >[0];
  const item = {
    type: PpeItemType.TSHIRT,
    sizes: [
      { id: 1, value: '48', heightValue: '170–176', isActive: true },
      { id: 2, value: '52', heightValue: '182–188', isActive: true },
      { id: 3, value: '52', heightValue: '170–176', isActive: true },
    ],
  } as Parameters<typeof guards.recommendSize>[1];
  expect(guards.recommendSize(employee, item)).toMatchObject({
    recommendedSizeId: 2,
  });
  expect(guards.resolveSize(employee, item, null)).toMatchObject({
    sizeValue: '52',
    heightSnapshot: '182–188',
    warnings: [],
  });
  expect(guards.resolveSize(employee, item, 3).warnings).toHaveLength(1);
});
