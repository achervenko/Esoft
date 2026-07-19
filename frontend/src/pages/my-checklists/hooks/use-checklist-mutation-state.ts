import { useCallback, useState } from "react";

export function useChecklistUiState() {
  const [mutationDetailError, setMutationDetailError] = useState<
    string | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [mutationVersionConflict, setMutationVersionConflict] = useState<
    string | null
  >(null);
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const clearValidationState = useCallback(() => {
    setShowRequiredErrors(false);
  }, []);

  const clearMutationErrors = useCallback(() => {
    setMutationDetailError(null);
    setFormError(null);
    setMutationVersionConflict(null);
  }, []);

  const prepareMutation = useCallback(() => {
    clearMutationErrors();
    setRefreshError(null);
    setMessage(null);
    clearValidationState();
  }, [clearMutationErrors, clearValidationState]);

  const resetMutationUiState = useCallback(() => {
    prepareMutation();
    setIsActionLoading(false);
  }, [prepareMutation]);

  const applyMutationError = useCallback(
    ({
      detailError,
      formError,
      versionConflict,
    }: {
      detailError: string | null;
      formError: string | null;
      versionConflict: string | null;
    }) => {
      setMutationDetailError(detailError);
      setFormError(formError);
      setMutationVersionConflict(versionConflict);
    },
    [],
  );

  const showRequiredValidationErrors = useCallback(() => {
    setShowRequiredErrors(true);
  }, []);

  const hideRequiredValidationErrors = useCallback(() => {
    setShowRequiredErrors(false);
  }, []);

  const showRefreshError = useCallback((message: string | null) => {
    setRefreshError(message);
  }, []);

  const showMessage = useCallback((message: string | null) => {
    setMessage(message);
  }, []);

  const showFormError = useCallback((message: string | null) => {
    setFormError(message);
  }, []);

  return {
    applyMutationError,
    clearMutationErrors,
    clearValidationState,
    formError,
    hideRequiredValidationErrors,
    isActionLoading,
    message,
    mutationDetailError,
    mutationVersionConflict,
    prepareMutation,
    refreshError,
    resetMutationUiState,
    setIsActionLoading,
    showFormError,
    showMessage,
    showRequiredErrors,
    showRefreshError,
    showRequiredValidationErrors,
  };
}
