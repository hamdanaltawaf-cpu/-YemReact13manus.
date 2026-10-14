export const ADMIN_EMAIL = "hamdanaltawaf@gmail.com";

export function normalizeGoogleEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * المستخدم غير الموثق يستطيع استخدام الموقع كـ user فقط. لا تُمنح صلاحية
 * الإدارة حتى للبريد المعتمد ما لم تؤكد Google قيمة email_verified صراحةً.
 */
export function resolveGoogleRole(email: string, emailVerified = false): "admin" | "user" {
  return emailVerified && normalizeGoogleEmail(email) === ADMIN_EMAIL ? "admin" : "user";
}

export function canAccessAdmin(role: "admin" | "user" | null | undefined) {
  return role === "admin";
}
