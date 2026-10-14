import { describe, expect, it } from "vitest";
import { operationStateMeta } from "./AdminOperations";

describe("حالات تشغيل مهام الفيديو", () => {
  it("يعرض دلالات بصرية صحيحة للنجاح والانتظار والفشل", () => {
    expect(operationStateMeta("ready").tone).toBe("ready");
    expect(operationStateMeta("pending").tone).toBe("pending");
    expect(operationStateMeta("failed").tone).toBe("failed");
  });

  it("يعطي المهمة العالقة أولوية فشل حتى لو كانت قيد المعالجة", () => {
    expect(operationStateMeta("processing", true)).toMatchObject({ tone: "failed", label: "عالقة" });
  });
});
