/* @vitest-environment jsdom */
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleSignInButton, googleIdentityButtonOptions, googleSignInCopy, resetGoogleInitializationForTests } from "./GoogleSignInButton";

let clientId = "client-a";
const initialize = vi.fn();
const renderButton = vi.fn();

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: {
      googleConfig: { useQuery: () => ({ isLoading: false, data: { clientId } }) },
      googleSignIn: { useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }) },
    },
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
  },
}));

function mountGoogleScript() {
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  document.head.appendChild(script);
}

describe("زر دخول Google المخصص", () => {
  beforeEach(() => {
    clientId = "client-a";
    initialize.mockReset();
    renderButton.mockReset();
    resetGoogleInitializationForTests();
    (globalThis as unknown as Record<string, unknown>).google = {
      accounts: { id: { initialize, renderButton, disableAutoSelect: vi.fn() } },
    };
    mountGoogleScript();
  });

  afterEach(() => {
    document.head.querySelectorAll('script[src="https://accounts.google.com/gsi/client"]').forEach(script => script.remove());
    delete (globalThis as unknown as Record<string, unknown>).google;
    resetGoogleInitializationForTests();
  });

  it("يعرض تسمية YemReact العربية ويحتفظ بخيار Google Identity المطلوب", () => {
    expect(googleSignInCopy.label).toBe("الدخول بحساب جوجل");
    expect(googleSignInCopy.helper).toBe("احفظ رياكشناتك وأرسل مساهمتك");
    expect(googleIdentityButtonOptions).toMatchObject({ theme: "outline", size: "large", text: "signin_with" });
  });

  it("لا يهيئ Google مرتين عند إعادة تركيب الزر لنفس المعرّف ويعيد التهيئة لمعرّف جديد فقط", async () => {
    const firstMount = render(<GoogleSignInButton />);
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));

    firstMount.unmount();
    render(<GoogleSignInButton />);
    await waitFor(() => expect(renderButton).toHaveBeenCalledTimes(2));
    expect(initialize).toHaveBeenCalledTimes(1);

    clientId = "client-b";
    render(<GoogleSignInButton />);
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
  });
});
