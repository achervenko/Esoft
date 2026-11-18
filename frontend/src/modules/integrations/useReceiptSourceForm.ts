import { useRef, useState, type FormEvent } from "react";
import {
  receiptIntegrationApi,
  type ReceiptSource,
  type IntegrationFlowRegistration,
  type IntegrationFlow,
} from "../../shared/api/receipt-integration-api";
import { getApiErrorMessage } from "../../shared/api/api-error";
import { BUSINESS_TIME_ZONE } from "../../shared/lib/business-date";

export function useReceiptSourceForm(
  source: ReceiptSource | null,
  availableFlows: IntegrationFlowRegistration[],
  onSaved: () => void,
) {
  const [name, setName] = useState(source?.name ?? "");
  const [selectedFlows, setSelectedFlows] = useState(
    source?.flows.filter((f) => f.isActive).map((f) => f.flowCode) ??
      availableFlows
        .filter(
          (f) =>
            f.systemTypes.includes("ONE_C") && f.incomingActions.length > 0,
        )
        .map((f) => f.flowCode),
  );
  const [baseUrl, setUrl] = useState(source?.baseUrl ?? "");
  const [authMode, setAuthMode] = useState("header");
  const [authorization, setAuthorization] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(source?.isActive ?? true);
  const receiptsFlow = source?.flows.find(
    (flow) => flow.flowCode === "warehouse.receipts",
  );
  const [scheduleEnabled, setScheduleEnabled] = useState(
    receiptsFlow?.config.enabled === true,
  );
  const [scheduleInterval, setScheduleInterval] = useState(
    String(
      receiptsFlow?.config.intervalSeconds ??
        (typeof receiptsFlow?.config.intervalMinutes === "number"
          ? receiptsFlow.config.intervalMinutes * 60
          : 30),
    ),
  );
  const [schedulePeriod, setSchedulePeriod] = useState(
    String(receiptsFlow?.config.periodMinutes ?? 60),
  );
  const [scheduleOverlap, setScheduleOverlap] = useState(
    String(receiptsFlow?.config.overlapMinutes ?? 15),
  );
  const [scheduleInitial, setScheduleInitial] = useState(
    String(receiptsFlow?.config.initialFrom ?? ""),
  );
  const [scheduleTimezone, setScheduleTimezone] = useState(
    String(receiptsFlow?.config.timezone ?? BUSINESS_TIME_ZONE),
  );
  const showSchedule = !!source && selectedFlows.includes("warehouse.receipts");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef(false);
  const basic = authMode === "basic";
  const hasBasicInput = login !== "" || password !== "";
  let accessHeader = authorization.trim();
  if (basic) {
    accessHeader = "";
    if (login.trim() && !login.includes(":") && password) {
      const bytes = new TextEncoder().encode(`${login}:${password}`);
      accessHeader = `Basic ${btoa(String.fromCharCode(...bytes))}`;
    }
  }
  const invalidCredentials =
    accessHeader.length > 2000 ||
    (!accessHeader && (!source || (basic && hasBasicInput)));
  const submitDisabled =
    !name.trim() ||
    !baseUrl.trim() ||
    invalidCredentials ||
    (showSchedule && scheduleEnabled && !scheduleInitial.trim());

  function changeAuthMode(mode: string) {
    setAuthMode(mode);
    setAuthorization("");
    setLogin("");
    setPassword("");
    setError(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (ref.current || submitDisabled) return;
    ref.current = true;
    setSaving(true);
    setError(null);
    try {
      await receiptIntegrationApi.configure({
        code: source?.code,
        name: name.trim(),
        flows: [
          ...new Set([
            ...selectedFlows,
            ...(source?.flows.map((f) => f.flowCode) ?? []),
          ]),
        ].map(
          (flowCode) =>
            ({
              ...(source?.flows.find((f) => f.flowCode === flowCode) ?? {
                flowCode,
                configVersion: 1,
                config: {},
                lastSuccessAt: null,
                lastErrorAt: null,
                lastErrorCode: null,
              }),
              ...(flowCode === "warehouse.receipts" && showSchedule
                ? {
                    config: {
                      enabled: scheduleEnabled,
                      intervalSeconds: Number(scheduleInterval),
                      periodMinutes: Number(schedulePeriod),
                      overlapMinutes: Number(scheduleOverlap),
                      timezone: scheduleTimezone.trim(),
                      ...(scheduleInitial.trim()
                        ? { initialFrom: scheduleInitial.trim() }
                        : {}),
                    },
                  }
                : {}),
              isActive: selectedFlows.includes(flowCode),
            }) satisfies IntegrationFlow,
        ),
        baseUrl: baseUrl.trim(),
        authorization: accessHeader,
        isActive: active,
      });
      setAuthorization("");
      setLogin("");
      setPassword("");
      onSaved();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      ref.current = false;
      setSaving(false);
    }
  }

  return {
    name,
    setName,
    baseUrl,
    setUrl,
    selectedFlows,
    setSelectedFlows,
    active,
    setActive,
    saving,
    error,
    submitDisabled,
    submit,
    showSchedule,
    credentials: {
      authMode,
      changeAuthMode,
      basic,
      hasBasicInput,
      login,
      setLogin,
      password,
      setPassword,
      authorization,
      setAuthorization,
      headerTooLong: accessHeader.length > 2000,
    },
    schedule: {
      scheduleEnabled,
      setScheduleEnabled,
      scheduleInitial,
      setScheduleInitial,
      scheduleTimezone,
      setScheduleTimezone,
      scheduleInterval,
      setScheduleInterval,
      schedulePeriod,
      setSchedulePeriod,
      scheduleOverlap,
      setScheduleOverlap,
      statusCode: receiptsFlow ? source?.code : undefined,
    },
  };
}
