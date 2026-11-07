import { Badge } from "@chakra-ui/react";
import type { IntegrationFlow } from "../../shared/api/receipt-integration-api";

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
  sourceActive,
  name,
}: {
  flow: IntegrationFlow;
  sourceActive: boolean;
  name: string;
}) {
  const disabled = !sourceActive || !flow.isActive;
  const failed =
    !disabled &&
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
  return (
    <div>
      <span>{name}</span>{" "}
      <Badge
        colorPalette={
          disabled
            ? "gray"
            : failed
              ? "red"
              : flow.lastSuccessAt
                ? "green"
                : "yellow"
        }
        variant="subtle"
      >
        {label}
      </Badge>
      {failed && (
        <small>
          {explanations[flow.lastErrorCode!] ??
            "Обмен завершился ошибкой. Проверьте настройки и доступность 1С."}{" "}
          Код: {flow.lastErrorCode}
        </small>
      )}
    </div>
  );
}
