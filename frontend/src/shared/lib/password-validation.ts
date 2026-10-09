export const MAX_PASSWORD_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE =
  "Пароль должен содержать от 8 до 128 символов, букву и цифру и не совпадать с логином или email.";

export function isValidPassword(
  password: string,
  identity: { email: string; username: string | null },
) {
  const normalized = password.toLowerCase();
  return (
    password.length >= 8 &&
    password.length <= MAX_PASSWORD_LENGTH &&
    /\p{L}/u.test(password) &&
    /\d/.test(password) &&
    normalized !== identity.email.trim().toLowerCase() &&
    normalized !== (identity.username ?? "").trim().toLowerCase()
  );
}
