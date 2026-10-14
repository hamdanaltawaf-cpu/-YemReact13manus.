import { describe, expect, it } from "vitest";
import { isClientRequestAbort } from "./requestAbort";

describe("isClientRequestAbort", () => {
  it("يتعرف على طلبات العميل الملغاة ولا يخلطها مع أخطاء الخادم", () => {
    expect(isClientRequestAbort({ type: "request.aborted", message: "request aborted" })).toBe(true);
    expect(isClientRequestAbort({ code: "ECONNABORTED" })).toBe(true);
    expect(isClientRequestAbort({ message: "database unavailable" })).toBe(false);
    expect(isClientRequestAbort(null)).toBe(false);
  });
});
