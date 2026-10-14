import { Settings2 } from "lucide-react";
import React from "react";
import { canAccessAdmin } from "@shared/googleRoles";

export function AdminNavigationLink({ role, className }: { role: "admin" | "user"; className: string }) {
  if (!canAccessAdmin(role)) return null;
  return <a href="/admin" className={className}><Settings2 size={15} /> الإدارة</a>;
}
