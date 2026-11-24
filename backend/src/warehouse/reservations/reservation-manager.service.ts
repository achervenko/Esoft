import { WarehouseNotificationsService } from '../warehouse-notifications.service';
import { Injectable, Optional } from '@nestjs/common';
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
import {
  increaseReservationDemand,
  type DemandIncreaseInput,
} from './reservation-demand';

@Injectable()
export class WarehouseReservationManager {
  constructor(
    private readonly audit: AuditLogService,
    private readonly stock: WarehouseStockService,
    @Optional() private readonly notifications?: WarehouseNotificationsService,
  ) {}

  // Callers must propagate errors out of the transaction to roll back all writes.
  // Batches must acquire all Stock locks first and take reservation locks in consistent order.
  async reserve(context: ReservationContext, input: ReserveInput) {
    const result = await reserveStock(this.audit, context, input);
    await this.notifications?.order(context.tx, result.reservation.orderId);
    return result;
  }

  async decrease(context: ReservationContext, input: DecreaseReservationInput) {
    const result = await decreaseReservation(this.audit, context, input);
    await this.notifications?.order(context.tx, result.reservation.orderId);
    return result;
  }

  async increaseDemand(
    context: ReservationContext,
    input: DemandIncreaseInput,
  ) {
    const result = await increaseReservationDemand(this.audit, context, input);
    await this.notifications?.order(context.tx, result.reservation.orderId);
    return result;
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

  async consume(
    context: ReservationContext & { actorUserId: string },
    input: ConsumeReservationInput,
  ) {
    const result = await consumeReservation(
      this.audit,
      this.stock,
      context,
      input,
    );
    await this.notifications?.order(context.tx, result.reservation.orderId);
    return result;
  }
}
