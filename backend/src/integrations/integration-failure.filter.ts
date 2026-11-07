import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { IntegrationFailure } from './integration-errors';
@Catch(IntegrationFailure)
export class IntegrationFailureFilter implements ExceptionFilter {
  catch(error: IntegrationFailure, host: ArgumentsHost) {
    host
      .switchToHttp()
      .getResponse<{
        status: (status: number) => { json: (body: unknown) => void };
      }>()
      .status(error.retryable ? 503 : 400)
      .json({
        code: error.code,
        message:
          error.publicMessage ??
          (error.retryable
            ? 'Компонент обмена временно недоступен.'
            : 'Некорректные параметры обмена.'),
      });
  }
}
