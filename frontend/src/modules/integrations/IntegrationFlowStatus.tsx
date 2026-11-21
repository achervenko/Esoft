import { Badge } from "@chakra-ui/react";
import { InfoTooltip } from "../../shared/ui/InfoTooltip";
import type { IntegrationFlow } from "../../shared/api/receipt-integration-api";
import { invoiceSchedulePresentation } from "./invoice-schedule-presentation";

const explanations: Record<string, string> = {
  INTEGRATION_HTTP_TIMEOUT:
    "1С не ответила вовремя. Проверьте доступность сервиса.",
  INTEGRATION_HTTP_401:
    "1С отклонила вход. Проверьте учётные данные и права чтения.",
  INTEGRATION_HTTP_403:
    "1С запретила чтение. Проверьте права пользователя обмена.",
  INTEGRATION_HTTP_UNAVAILABLE:
    "Не удалось подключиться к 1С. Проверьте адрес и доступность сервиса.",
  INTEGRATION_HTTP_404: "Сервис 1С не найден. Проверьте адрес подключения.",
  ORDERS_RESPONSE_INVALID:
    "1С вернула некорректные данные заказов. Проверьте обязательные поля и Ref_Key.",
  ORDERS_IDENTITY_AMBIGUOUS:
    "Несколько заказов подходят по номеру и дате. Требуется проверка связи с источником.",
  ORDERS_PAGINATION_UNSUPPORTED:
    "Формат постраничной выгрузки 1С не поддерживается.",
  ORDERS_RESPONSE_LIMIT: "Выгрузка превысила допустимый объём.",
  ORDERS_SYNC_FAILED:
    "Обновление заказов не завершилось. Требуется проверка серверного журнала.",
  HANDLER_UNAVAILABLE: "Обработчик обмена недоступен.",
};

export function IntegrationFlowStatus({
  flow,
  name,
}: {
  flow: IntegrationFlow;
  name: string;
}) {
  const disabled = !flow.isActive;
  const schedule = disabled ? null : flow.scheduleSummary;
  const failed =
    !disabled &&
    !schedule &&
    !!flow.lastErrorCode &&
    (!flow.lastSuccessAt ||
      (!!flow.lastErrorAt &&
        Date.parse(flow.lastErrorAt) >= Date.parse(flow.lastSuccessAt)));
  const label = disabled
    ? "Выключен"
    : failed
      ? "Есть проблема"
      : flow.lastSuccessAt
        ? "Работает"
        : "Ожидает первого обмена";
  const status = schedule && invoiceSchedulePresentation(schedule.outcome);
  const errorCode = schedule
    ? schedule.errorCode
    : failed
      ? flow.lastErrorCode
      : null;
  return (
    <Badge
      className={errorCode ? "info-tooltip-tone-inherit" : undefined}
      colorPalette={
        status
          ? status.color
          : disabled
            ? "gray"
            : failed
              ? "red"
              : flow.lastSuccessAt
                ? "green"
                : "yellow"
      }
      variant="subtle"
    >
      {status?.label ?? label}
      {errorCode && (
        <InfoTooltip
          label={`Подробности ошибки: ${name}`}
          reasons={[
            `${explanations[errorCode] ?? "Обмен завершился ошибкой. Проверьте настройки и доступность 1С."} Код: ${errorCode}`,
          ]}
        />
      )}
    </Badge>
  );
}
