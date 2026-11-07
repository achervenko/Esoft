import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { OrdersSyncService } from './orders-sync.service';
@Injectable()
export class OrdersScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(OrdersScheduler.name);
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | null = null;
  private stopped = false;
  private readonly abort = new AbortController();
  constructor(private readonly sync: OrdersSyncService) {}
  onApplicationBootstrap() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 60_000);
    this.timer.unref();
  }
  private tick() {
    if (this.stopped || this.running) return;
    this.running = this.run()
      .catch(() =>
        this.logger.error('Не удалось проверить расписание заказов.'),
      )
      .finally(() => {
        this.running = null;
      });
  }
  private async run() {
    for (const source of await this.sync.dueSources()) {
      if (this.stopped) break;
      try {
        await this.sync.sync(source.sourceId, undefined, this.abort.signal);
      } catch {
        this.logger.error(
          'Не удалось обновить заказы; код ошибки доступен в журнале интеграции.',
        );
      }
    }
  }
  async onModuleDestroy() {
    this.stopped = true;
    this.abort.abort();
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
