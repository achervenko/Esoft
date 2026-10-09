import { Injectable } from '@nestjs/common';
import type { PpeIssue, PpeNorm, PpeNormItem } from '@prisma/client';

export type PositionNorm = PpeNorm & { items: PpeNormItem[] };
type NormItemEntry = { norm: PositionNorm; item: PpeNormItem };
export type NormItemChain = [NormItemEntry, ...NormItemEntry[]];

@Injectable()
export class PpeNormPositionService {
  resolve(
    chain: NormItemChain,
    context: Map<number, PositionNorm>,
    issued: PpeIssue[],
    on: Date,
    assignedAt?: Date | null,
  ): NormItemChain {
    const [{ norm, item }, ...ancestors] = chain;
    const assignment = assignedAt && assignedAt <= on ? assignedAt : null;
    const current =
      assignment && assignment > norm.effectiveFrom
        ? { ...norm, effectiveFrom: assignment }
        : norm;
    const foreignItems = new Map<number, NormItemChain[number]>();
    for (const source of context.values()) {
      if (source.positionId === norm.positionId) continue;
      for (const sourceItem of source.items) {
        if (
          sourceItem.ppeItemId === item.ppeItemId &&
          sourceItem.ppeUnitSnapshot === item.ppeUnitSnapshot &&
          sourceItem.ppeItemTypeSnapshot === item.ppeItemTypeSnapshot
        ) {
          foreignItems.set(sourceItem.id, { norm: source, item: sourceItem });
        }
      }
    }
    const carried: NormItemEntry[] = [];
    const seen = new Set<number>();
    for (const issue of [...issued].sort(
      (a, b) => Number(b.issuedAt) - Number(a.issuedAt) || b.id - a.id,
    )) {
      if (
        issue.issueType !== 'REGULAR' ||
        issue.status !== 'ISSUED' ||
        issue.issuedAt > on ||
        issue.normItemId === null ||
        seen.has(issue.normItemId)
      )
        continue;
      const source = foreignItems.get(issue.normItemId);
      if (!source) continue;
      seen.add(issue.normItemId);
      carried.push(source);
    }
    const assignmentTransition =
      carried.length > 0 && (!assignment || norm.effectiveFrom <= assignment);
    const transitionMode =
      item.calculationMode === 'MONTHLY' &&
      carried[0]?.item.calculationMode === 'MONTHLY'
        ? 'HARD'
        : 'SOFT';
    const adjustEntry = (entry: NormItemEntry): NormItemEntry => {
      if (
        !carried.length ||
        !assignment ||
        entry.norm.effectiveFrom > assignment
      )
        return entry;
      return {
        ...entry,
        norm: { ...entry.norm, effectiveFrom: assignment, transitionMode },
      };
    };
    const ownChain: NormItemChain = [
      adjustEntry({ norm: current, item }),
      ...ancestors.map(adjustEntry),
    ];
    if (assignmentTransition && !assignment)
      ownChain[0] = { ...ownChain[0], norm: { ...current, transitionMode } };
    return [...ownChain, ...carried];
  }
}
