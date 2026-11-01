import { useCallback, useState } from "react";

import { AuthService, AuthServiceError } from "@/services/auth.service";
import type { AuthenticatedUser } from "@/types/auth";
import { t } from "@/i18n";

type FieldErrors = Partial<Record<"email" | "password", string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param onSuccess reçoit l'utilisateur, le choix « rester connecté » et le mot de passe saisi (pour l'enregistrer dans le
 *        coffre si l'utilisateur l'a demandé). La connexion sociale a son propre hook : use-social-sign-in.
 * @param onNeedsVerification appelé quand le compte existe mais que l'e-mail n'est pas vérifié
 *        (403 EMAIL_NOT_VERIFIED) : l'écran envoie vers la saisie du code.
 * @param initialRemember valeur de départ de « rester connecté » (le dernier choix de l'utilisateur).
 */
export function useLoginForm(
  onSuccess: (user: AuthenticatedUser, context: { remember: boolean; password: string }) => void,
  onNeedsVerification?: (email: string) => void,
  initialRemember = true,
) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(initialRemember);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = useCallback(() => {
    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = t("common.emailIsRequired");
    else if (!EMAIL_REGEX.test(email.trim())) errors.email = t("common.invalidEmailFormat");
    if (!password) errors.password = t("common.passwordIsRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [email, password]);

  const submit = useCallback(async () => {
    if (isSubmitting) return;
    setFormError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const user = await AuthService.login({ email: email.trim(), password }, { remember: rememberMe });
      onSuccess(user, { remember: rememberMe, password });
    } catch (error) {
      if (error instanceof AuthServiceError && error.code === "email_not_verified" && onNeedsVerification) {
        onNeedsVerification(email.trim());
        return;
      }
      setFormError(
        error instanceof AuthServiceError ? error.message : t("common.anErrorOccurredPleaseTry"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [email, password, rememberMe, isSubmitting, validate, onSuccess, onNeedsVerification]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    setFormError,
    rememberMe,
    setRememberMe,
    fieldErrors,
    formError,
    isSubmitting,
    submit,
    canSubmit: email.trim().length > 0 && password.length > 0 && !isSubmitting,
  };
}
