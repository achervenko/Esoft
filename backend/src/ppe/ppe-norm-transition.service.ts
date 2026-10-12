import { Injectable } from '@nestjs/common';
import type { Prisma, PpeIssue, PpeNormItem } from '@prisma/client';
import {
  PpeNormPositionService,
  type NormItemChain,
  type PositionNorm,
} from './ppe-norm-position.service';
import { PpeNormIntervalTransitionService } from './ppe-norm-interval-transition.service';

type Norm = PositionNorm;
type Context = Map<number, Norm>;

@Injectable()
export class PpeNormTransitionService {
  constructor(
    private readonly positions: PpeNormPositionService,
    private readonly interval: PpeNormIntervalTransitionService,
  ) {}

  async prepare(
    tx: Prisma.TransactionClient,
    current: Norm,
    issued: PpeIssue[] = [],
  ): Promise<Context> {
    const context: Context = new Map([[current.id, current]]);
    // Explicit ancestry prevents independent norms or a removed/readded item
    // from inheriting unrelated entitlements.
    let previousId = current.previousNormId;
    while (previousId && !context.has(previousId)) {
      const previous = await tx.ppeNorm.findUnique({
        where: { id: previousId },
        include: { items: true },
      });
      if (
        !previous ||
        previous.positionId !== current.positionId ||
        previous.effectiveFrom >= current.effectiveFrom
      )
        break;
      context.set(previous.id, previous);
      previousId = previous.previousNormId;
    }
    const foreignIds = [
      ...new Set(
        issued
          .filter(
            (issue) =>
              issue.positionId !== current.positionId &&
              issue.normItemId !== null,
          )
          .map((issue) => issue.normItemId!),
      ),
    ];
    if (foreignIds.length) {
      const sources = await tx.ppeNorm.findMany({
        where: { items: { some: { id: { in: foreignIds } } } },
        include: { items: true },
      });
      for (const source of sources) context.set(source.id, source);
    }
    return context;
  }

  evaluate(
    context: Context,
    norm: Norm,
    item: PpeNormItem,
    on: Date,
    issued: PpeIssue[],
    assignedAt?: Date | null,
  ) {
    const chain = this.positions.resolve(
      this.itemChain(context, norm, item),
      context,
      issued,
      on,
      assignedAt,
    );
    norm = chain[0].norm;
    const itemIds = new Set(chain.map((entry) => entry.item.id));
    const history = issued
      .filter(
        (issue) =>
          issue.normItemId !== null &&
          itemIds.has(issue.normItemId) &&
          issue.issueType === 'REGULAR' &&
          issue.issuedAt <= on,
      )
      .sort((a, b) => Number(a.issuedAt) - Number(b.issuedAt) || a.id - b.id);
    return this.interval.evaluate(chain, norm, item, on, history, assignedAt);
  }

  private itemChain(
    context: Context,
    norm: Norm,
    item: PpeNormItem,
  ): NormItemChain {
    const chain: NormItemChain = [{ norm, item }];
    const seen = new Set([norm.id]);
    while (norm.previousNormId && !seen.has(norm.previousNormId)) {
      const previous = context.get(norm.previousNormId);
      const previousItem = previous?.items.find(
        (entry) =>
          entry.ppeItemId === item.ppeItemId &&
          entry.ppeUnitSnapshot === item.ppeUnitSnapshot &&
          entry.ppeItemTypeSnapshot === item.ppeItemTypeSnapshot,
      );
      if (!previous || !previousItem) break;
      seen.add(previous.id);
      chain.push({ norm: previous, item: previousItem });
      norm = previous;
      item = previousItem;
    }
    return chain;
  }
}
