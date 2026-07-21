import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialAdmin,
  getSetupEmployees,
  type SetupEmployee,
} from "../../shared/api/setup";
import {
  getSetupErrorCode,
  getSetupErrorMessage,
  hasSetupFieldErrors,
  validateSetupForm,
} from "./setup.validation";
import type { SetupFieldErrors, SetupFormState } from "./setup.types";

const initialForm: SetupFormState = {
  email: "",
  employeeId: "",
  password: "",
  passwordConfirmation: "",
  username: "",
};

type UseSetupPageParams = {
  onCompleted: () => void;
};

export function useSetupPage({ onCompleted }: UseSetupPageParams) {
  const completionTimeoutRef = useRef<number | null>(null);
  const isSubmittingRef = useRef(false);
  const [employees, setEmployees] = useState<SetupEmployee[]>([]);
  const [form, setForm] = useState(initialForm);
  const [fieldErrors, setFieldErrors] = useState<SetupFieldErrors>({});
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const clearCompletionTimeout = useCallback(() => {
    if (completionTimeoutRef.current != null) {
      window.clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }, []);

  const scheduleCompleted = useCallback(
    (delayMs: number) => {
      clearCompletionTimeout();
      completionTimeoutRef.current = window.setTimeout(() => {
        completionTimeoutRef.current = null;
        onCompleted();
      }, delayMs);
    },
    [clearCompletionTimeout, onCompleted],
  );

  useEffect(() => {
    let isMounted = true;

    getSetupEmployees()
      .then((response) => {
        if (isMounted) {
          setEmployees(response.employees);
        }
      })
      .catch((loadError) => {
        if (!isMounted) {
          return;
        }

        const errorCode = getSetupErrorCode(loadError);

        if (errorCode === "SETUP_ALREADY_COMPLETED") {
          scheduleCompleted(0);
          return;
        }

        setError(getSetupErrorMessage(loadError));
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingEmployees(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [scheduleCompleted]);

  useEffect(() => clearCompletionTimeout, [clearCompletionTimeout]);

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        label: `${employee.fullName} — ${employee.position}`,
        value: String(employee.id),
      })),
    [employees],
  );

  const setField = (field: keyof SetupFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setError(null);
    setMessage(null);

    const nextErrors = validateSetupForm(form);
    setFieldErrors(nextErrors);

    if (hasSetupFieldErrors(nextErrors)) {
      isSubmittingRef.current = false;
      return;
    }

    setIsSubmitting(true);

    try {
      await createInitialAdmin({
        email: form.email.trim(),
        employeeId: Number(form.employeeId),
        password: form.password,
        passwordConfirmation: form.passwordConfirmation,
        username: form.username.trim(),
      });

      setMessage("Администратор создан. Теперь можно войти в систему.");
      scheduleCompleted(900);
    } catch (submitError) {
      const errorCode = getSetupErrorCode(submitError);
      const nextMessage = getSetupErrorMessage(submitError);
      setError(nextMessage);
      setForm((current) => ({
        ...current,
        password: "",
        passwordConfirmation: "",
      }));

      if (errorCode === "SETUP_ALREADY_COMPLETED") {
        scheduleCompleted(1200);
      }
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return {
    employeeOptions,
    error,
    fieldErrors,
    form,
    isLoadingEmployees,
    isSubmitting,
    message,
    setField,
    submit,
  };
}
