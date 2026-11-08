import { Injectable } from '@nestjs/common';
import { AuditLogService } from '../../audit/audit-log.service';
import { WarehouseStockService } from '../stock/stock.service';
import { moveReservation, type MoveReservationInput } from './reservation-move';
import type { ReservationContext } from './reservation-common';
import {
  consumeReservation,
  type ConsumeReservationInput,
} from './reservation-consume';
import {
  changeReservationCoverage,
  type ReservationCoverageInput,
} from './reservation-coverage';
import { reserveStock, type ReserveInput } from './reservation-create';
import {
  decreaseReservation,
  type DecreaseReservationInput,
} from './reservation-decrease';

@Injectable()
export class WarehouseReservationManager {
  constructor(
    private readonly audit: AuditLogService,
    private readonly stock: WarehouseStockService,
  ) {}

  // Callers must propagate errors out of the transaction to roll back all writes.
  // Batches must acquire all Stock locks first and take reservation locks in consistent order.
  reserve(context: ReservationContext, input: ReserveInput) {
    return reserveStock(this.audit, context, input);
  }

  decrease(context: ReservationContext, input: DecreaseReservationInput) {
    return decreaseReservation(this.audit, context, input);
  }

  reduceCoverage(context: ReservationContext, input: ReservationCoverageInput) {
    return changeReservationCoverage(
      this.audit,
      context,
      input,
      'REDUCE_COVERAGE',
    );
  }

  restoreCoverage(
    context: ReservationContext,
    input: ReservationCoverageInput,
  ) {
    return changeReservationCoverage(
      this.audit,
      context,
      input,
      'RESTORE_COVERAGE',
    );
  }

  move(
    context: ReservationContext & { actorUserId: string },
    input: MoveReservationInput,
  ) {
    return moveReservation(this.audit, this.stock, context, input);
  }

  consume(
    context: ReservationContext & { actorUserId: string },
    input: ConsumeReservationInput,
  ) {
    return consumeReservation(this.audit, this.stock, context, input);
  }
}
