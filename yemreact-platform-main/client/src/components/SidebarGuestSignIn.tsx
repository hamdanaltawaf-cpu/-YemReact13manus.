import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export default function SidebarGuestSignIn({ onSignedIn }: { onSignedIn?: () => void }) {
  return <GoogleSignInButton onSignedIn={onSignedIn} className="drawer-google-signin" />;
}
