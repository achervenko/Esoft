import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { IntegrationWorkerService } from './integration-worker.service';
@Injectable()
export class IntegrationSchedulerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running: Promise<void> | null = null;
  private stopped = false;
  private readonly logger = new Logger(IntegrationSchedulerService.name);
  constructor(private readonly worker: IntegrationWorkerService) {}
  onApplicationBootstrap() {
    this.timer = setInterval(() => {
      if (!this.running && !this.stopped)
        this.running = this.worker
          .cleanupSkipped()
          .catch(() =>
            this.logger.error(
              'Не удалось очистить старые пропущенные события интеграций.',
            ),
          )
          .then(() =>
            this.stopped ? undefined : this.worker.drain(() => !this.stopped),
          )
          .catch(() =>
            this.logger.error(
              'Не удалось обработать очередь интеграций. Проверьте доступность БД.',
            ),
          )
          .finally(() => {
            this.running = null;
          });
    }, 5000);
    this.timer.unref();
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
