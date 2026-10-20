import { Injectable } from '@nestjs/common';
import { PpeItemType } from '@prisma/client';
import { ppeNotFound } from './ppe.errors';
import { badPpeRequest } from './ppe.validation';
import { normalizePpeSizeText } from './ppe-size-text';
import type { IssueEmployee } from './ppe-issue-norms-guard.service';
import type { IssueCatalogItem } from './ppe-issue-catalog-guard.service';

export type PpeIssueWarning = {
  code: 'PPE_SIZE_DIFFERS_FROM_RECOMMENDED';
  message: string;
};

function matchesRecommendedSize(
  type: PpeItemType,
  value: string,
  recommended: string | null,
) {
  return (
    (recommended !== null &&
      normalizePpeSizeText(value) === normalizePpeSizeText(recommended)) ||
    (type === PpeItemType.FEET &&
      recommended !== null &&
      /^\d+(\.\d+)?$/.test(value) &&
      Number(value) === Number(recommended))
  );
}

@Injectable()
export class PpeIssueSizeService {
  recommendSize(employee: IssueEmployee, item: IssueCatalogItem) {
    let recommendedValue: string | null = null;
    switch (item.type) {
      case PpeItemType.BODY:
        recommendedValue = employee.ppeSizes?.clothingSize ?? null;
        break;
      case PpeItemType.TSHIRT:
        recommendedValue = employee.ppeSizes?.tshirtSize ?? null;
        break;
      case PpeItemType.FEET:
        recommendedValue = employee.ppeSizes?.shoeSize?.toString() ?? null;
        break;
      case PpeItemType.HANDS:
        recommendedValue = employee.ppeSizes?.gloveSize ?? null;
        break;
      case PpeItemType.HEAD:
        recommendedValue = employee.ppeSizes?.headwearSize ?? null;
        break;
    }
    const height =
      item.type === PpeItemType.TSHIRT
        ? employee.ppeSizes?.tshirtHeight
        : employee.ppeSizes?.clothingHeight;
    const activeSizes = item.sizes.filter((size) => size.isActive);
    const matching =
      item.type === PpeItemType.OTHER
        ? undefined
        : activeSizes.find(
            (size) =>
              matchesRecommendedSize(item.type, size.value, recommendedValue) &&
              ((item.type !== PpeItemType.BODY &&
                item.type !== PpeItemType.TSHIRT) ||
                (height != null &&
                  size.heightValue !== null &&
                  normalizePpeSizeText(size.heightValue) ===
                    normalizePpeSizeText(height))),
          );
    return {
      type: item.type,
      recommendedValue,
      recommendedSizeId: matching?.id ?? null,
      recommendedSizeValue: matching?.value ?? null,
      recommendedHeightValue: matching?.heightValue ?? null,
      heightValue:
        item.type === PpeItemType.BODY || item.type === PpeItemType.TSHIRT
          ? (height ?? null)
          : null,
      requiresSelection:
        item.type !== PpeItemType.OTHER && item.sizes.length > 0 && !matching,
      activeSizes: activeSizes.map(({ id, value, heightValue }) => ({
        id,
        value,
        heightValue,
      })),
    };
  }

  resolveSize(
    employee: IssueEmployee,
    item: IssueCatalogItem,
    sizeId: number | null,
  ) {
    const recommendation = this.recommendSize(employee, item);
    const height = recommendation.heightValue;
    if (item.type === PpeItemType.OTHER || item.sizes.length === 0) {
      if (sizeId !== null)
        badPpeRequest(
          'PPE_SIZE_NOT_FOUND',
          'Размер не предусмотрен для этой позиции СИЗ.',
        );
      return {
        sizeValue: null,
        heightSnapshot: null,
        warnings: [] as PpeIssueWarning[],
      };
    }
    const selectedId = sizeId ?? recommendation.recommendedSizeId;
    if (selectedId === null)
      badPpeRequest(
        'PPE_SIZE_REQUIRED',
        'Выберите активный размер этой позиции СИЗ.',
      );
    const selected = item.sizes.find((size) => size.id === selectedId);
    if (!selected) ppeNotFound('PPE_SIZE_NOT_FOUND');
    if (!selected.isActive)
      badPpeRequest('PPE_SIZE_INACTIVE', 'Выбранный размер отключён.');
    return {
      sizeValue: selected.value,
      heightSnapshot:
        item.type === PpeItemType.BODY || item.type === PpeItemType.TSHIRT
          ? selected.heightValue
          : null,
      warnings:
        (recommendation.recommendedValue !== null &&
          !matchesRecommendedSize(
            item.type,
            selected.value,
            recommendation.recommendedValue,
          )) ||
        ((item.type === PpeItemType.BODY || item.type === PpeItemType.TSHIRT) &&
          height != null &&
          (selected.heightValue === null ||
            normalizePpeSizeText(selected.heightValue) !==
              normalizePpeSizeText(height)))
          ? ([
              {
                code: 'PPE_SIZE_DIFFERS_FROM_RECOMMENDED',
                message:
                  'Выбранный размер отличается от рекомендуемого размера сотрудника.',
              },
            ] as PpeIssueWarning[])
          : ([] as PpeIssueWarning[]),
    };
  }
}
