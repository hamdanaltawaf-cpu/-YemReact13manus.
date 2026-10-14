import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

type GoogleIdentity = { accounts: { id: { initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: "popup" }) => void; renderButton: (element: HTMLElement, options: { theme: "outline"; size: "large"; width?: number; text?: "signin_with" }) => void; disableAutoSelect: () => void } } };
const googleIdentity = () => ((globalThis as unknown as Record<string, unknown>)["google"] as GoogleIdentity | undefined);
type GoogleCredentialResponse = { credential?: string };
type GoogleCredentialHandler = (response: GoogleCredentialResponse) => void;
let initializedGoogleClientId: string | null = null;
let activeGoogleCredentialHandler: GoogleCredentialHandler | null = null;

type GoogleSignInButtonProps = { onSignedIn?: () => void; className?: string };

export const googleSignInCopy = {
  label: "الدخول بحساب جوجل",
  helper: "احفظ رياكشناتك وأرسل مساهمتك",
} as const;

export const googleIdentityButtonOptions = { theme: "outline", size: "large", width: 260, text: "signin_with" } as const;

export function shouldInitializeGoogle(clientId: string) {
  return initializedGoogleClientId !== clientId;
}

export function recordGoogleInitialized(clientId: string) {
  initializedGoogleClientId = clientId;
}

export function resetGoogleInitializationForTests() {
  initializedGoogleClientId = null;
  activeGoogleCredentialHandler = null;
}

export function GoogleSignInButton({ onSignedIn, className }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const config = trpc.auth.googleConfig.useQuery();
  const utils = trpc.useUtils();
  const signIn = trpc.auth.googleSignIn.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      onSignedIn?.();
    },
  });
  const [scriptError, setScriptError] = useState("");
  const signInMutationRef = useRef(signIn.mutate);

  useEffect(() => {
    signInMutationRef.current = signIn.mutate;
  }, [signIn.mutate]);

  useEffect(() => {
    const clientId = config.data?.clientId;
    if (!clientId || !container.current) return;
    const handleCredential: GoogleCredentialHandler = response => {
      if (!response.credential) return setScriptError("لم يصل رمز هوية Google. حاول مجددًا.");
      signInMutationRef.current({ idToken: response.credential });
    };
    const render = () => {
      const google = googleIdentity();
      if (!google || !container.current) return;
      activeGoogleCredentialHandler = handleCredential;
      if (shouldInitializeGoogle(clientId)) {
        google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: "popup",
          callback: response => activeGoogleCredentialHandler?.(response),
        });
        recordGoogleInitialized(clientId);
      }
      container.current.replaceChildren();
      google.accounts.id.renderButton(container.current, googleIdentityButtonOptions);
    };

    const current = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (current) {
      if (googleIdentity()) render();
      else current.addEventListener("load", render, { once: true });
      return () => {
        current.removeEventListener("load", render);
        if (activeGoogleCredentialHandler === handleCredential) activeGoogleCredentialHandler = null;
      };
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => setScriptError("تعذر تحميل خدمة Google. تحقق من اتصالك وحاول مجددًا.");
    document.head.appendChild(script);
    return () => {
      script.removeEventListener("load", render);
      if (activeGoogleCredentialHandler === handleCredential) activeGoogleCredentialHandler = null;
    };
  }, [config.data?.clientId]);

  if (config.isLoading) return <span className={`google-signin-loading ${className ?? ""}`}><Loader2 size={15} /> جارٍ تجهيز Google…</span>;
  if (!config.data?.clientId) return <p className="google-signin-error">لم يُضبط Google Client ID بعد.</p>;
  return <div className={`google-signin ${className ?? ""}`} dir="rtl"><div className="google-custom-surface" aria-hidden="true"><span className="google-custom-surface__spark"><Sparkles size={15} /></span><span className="google-custom-surface__copy"><b>{googleSignInCopy.label}</b><small>{googleSignInCopy.helper}</small></span><span className="google-custom-surface__arrow"><ArrowLeft size={16} /></span></div><div ref={container} className="google-native-click-target" aria-label={googleSignInCopy.label} />{signIn.isPending && <span className="google-signin-loading"><Loader2 size={15} /> جارٍ التحقق من الهوية…</span>}{(scriptError || signIn.error) && <p className="google-signin-error">{scriptError || signIn.error?.message}</p>}</div>;
}
