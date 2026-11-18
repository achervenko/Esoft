import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OneCInvoiceSchedulerService } from './one-c-invoice-scheduler.service';

const maxConcurrentSources = 2;

@Injectable()
export class OneCInvoiceScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OneCInvoiceScheduler.name);
  private readonly abort = new AbortController();
  private timer?: ReturnType<typeof setInterval>;
  private scan?: Promise<void>;
  private readonly active = new Map<string, Promise<void>>();
  private lastSourceId = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: OneCInvoiceSchedulerService,
  ) {}

  onApplicationBootstrap() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
    this.timer.unref();
  }

  private tick() {
    if (
      this.scan ||
      this.active.size >= maxConcurrentSources ||
      this.abort.signal.aborted
    )
      return;
    this.scan = this.dispatch()
      .catch(() =>
        this.logger.error('Не удалось проверить расписание приходов 1С.'),
      )
      .finally(() => {
        this.scan = undefined;
      });
  }

  private async dispatch() {
    const sources = await this.prisma.integrationFlow.findMany({
      where: {
        flowCode: 'warehouse.receipts',
        isActive: true,
        source: { systemType: 'ONE_C', isActive: true },
        config: { path: ['enabled'], equals: true },
      },
      select: { sourceId: true },
      orderBy: { sourceId: 'asc' },
    });
    // Resume after the last dispatched source so busy slots cannot starve later sources.
    const next = sources.findIndex(
      ({ sourceId }) => sourceId > this.lastSourceId,
    );
    const start = next < 0 ? 0 : next;
    for (let offset = 0; offset < sources.length; offset++) {
      if (this.abort.signal.aborted || this.active.size >= maxConcurrentSources)
        return;
      const { sourceId } = sources[(start + offset) % sources.length];
      if (this.active.has(sourceId)) continue;
      this.lastSourceId = sourceId;
      const attempt = this.scheduler
        .run(sourceId, this.abort.signal)
        .catch(() => {
          this.logger.error(
            'Не удалось завершить попытку импорта приходов 1С.',
          );
        })
        .finally(() => {
          this.active.delete(sourceId);
        });
      this.active.set(sourceId, attempt);
    }
  }

  async onModuleDestroy() {
    this.abort.abort();
    if (this.timer) clearInterval(this.timer);
    await this.scan;
    await Promise.allSettled(this.active.values());
  }
}
