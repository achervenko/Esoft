import { useEffect, useMemo, useRef, useState } from "react";
import { canEditEquipment } from "../../modules/equipment-permissions";
import {
  getEquipmentCard,
  getEquipmentCreateOptions,
  updateEquipment,
} from "../../shared/api/equipment/equipment.api";
import type { EquipmentCreateOptions } from "../../shared/api/equipment/equipment.types";
import {
  toEquipmentCreatePayload,
  toEquipmentFormState,
} from "../EquipmentCreatePage/model/equipment-create-form.mapper";
import {
  type EquipmentCreateFieldErrors,
  initialEquipmentCreateFormState,
  type EquipmentCreateFormState,
} from "../EquipmentCreatePage/model/equipment-create-form.types";
import {
  getEquipmentFieldErrorsFromMessage,
  validateEquipmentCreateForm,
} from "../EquipmentCreatePage/model/equipment-create-form.validation";
import {
  buildEquipmentViewHref,
  type EquipmentEditTab,
} from "./equipment-edit-navigation";

type UseEquipmentEditPageParams = {
  initialTab: EquipmentEditTab;
  returnTo: string;
  userRole: string | null;
  visibleId: number;
};

export function useEquipmentEditPage({
  initialTab,
  returnTo,
  userRole,
  visibleId,
}: UseEquipmentEditPageParams) {
  const redirectTimeoutRef = useRef<number | null>(null);
  const isEditAllowed = canEditEquipment(userRole);
  const [form, setForm] = useState<EquipmentCreateFormState>(
    initialEquipmentCreateFormState,
  );
  const [initialForm, setInitialForm] =
    useState<EquipmentCreateFormState | null>(null);
  const [options, setOptions] = useState<EquipmentCreateOptions | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<EquipmentEditTab>(initialTab);
  const [fieldErrors, setFieldErrors] = useState<EquipmentCreateFieldErrors>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const hasUnsavedChanges = useMemo(
    () =>
      Boolean(
        initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
      ),
    [form, initialForm],
  );

  useEffect(() => {
    let isMounted = true;

    if (!isEditAllowed) {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);
    setOptions(null);
    setInitialForm(null);
    setFieldErrors({});
    setError(null);
    setMessage(null);

    Promise.all([getEquipmentCreateOptions(), getEquipmentCard(visibleId)])
      .then(([optionsData, equipment]) => {
        if (!isMounted) {
          return;
        }

        const formState = toEquipmentFormState(equipment, optionsData);
        setOptions(optionsData);
        setForm(formState);
        setInitialForm(formState);
      })
      .catch((requestError: Error) => {
        if (isMounted) {
          setError(requestError.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isEditAllowed, visibleId]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const updateForm = <Key extends keyof EquipmentCreateFormState>(
    key: Key,
    value: EquipmentCreateFormState[Key],
  ) => {
    setForm((currentForm) => ({ ...currentForm, [key]: value }));
  };

  const handleFieldFocus = (key: keyof EquipmentCreateFormState) => {
    if (fieldErrors[key]) {
      setError(null);
      setMessage(null);
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        [key]: undefined,
      }));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!options) {
      setError("Справочники для редактирования ещё не загружены.");
      return;
    }

    const validation = validateEquipmentCreateForm(form);
    setFieldErrors(validation.fieldErrors);

    if (validation.formError) {
      setError(validation.formError);
      return;
    }

    setIsSubmitting(true);
    let shouldResetSubmitting = true;

    try {
      const updatedEquipment = await updateEquipment(
        visibleId,
        toEquipmentCreatePayload(form),
      );

      setMessage("Оборудование сохранено.");
      const updatedForm = toEquipmentFormState(updatedEquipment, options);
      setInitialForm(updatedForm);
      setForm(updatedForm);
      shouldResetSubmitting = false;

      if (redirectTimeoutRef.current !== null) {
        window.clearTimeout(redirectTimeoutRef.current);
      }

      redirectTimeoutRef.current = window.setTimeout(() => {
        window.location.hash = buildEquipmentViewHref(
          updatedEquipment.visibleId,
          activeTab,
          returnTo,
        );
        redirectTimeoutRef.current = null;
      }, 500);
    } catch (requestError) {
      const errorMessage =
        requestError instanceof Error
          ? requestError.message
          : "Не удалось сохранить оборудование.";

      setError(errorMessage);
      setFieldErrors((currentErrors) => ({
        ...currentErrors,
        ...getEquipmentFieldErrorsFromMessage(errorMessage),
      }));
    } finally {
      if (shouldResetSubmitting) {
        setIsSubmitting(false);
      }
    }
  };

  const handleDocumentsSaved = () => {
    window.location.hash = buildEquipmentViewHref(
      visibleId,
      "documents",
      returnTo,
    );
  };

  return {
    activeTab,
    error,
    fieldErrors,
    form,
    handleDocumentsSaved,
    handleFieldFocus,
    handleSubmit,
    hasUnsavedChanges,
    initialForm,
    isEditAllowed,
    isLoading,
    isSubmitting,
    message,
    options,
    setActiveTab,
    updateForm,
  };
}
