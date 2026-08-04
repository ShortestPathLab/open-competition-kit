import { ThemeToggle } from "@/components/theme-toggle";
import { DesktopActions, MobileActions } from "./account-actions";
import { DesktopNavbar, MobileNavbar } from "./chrome";
import { Brand, NavLinks } from "./nav-links";
import { useNavbar } from "./use-navbar";

export function Navbar({
  appName = "Open Competition Kit",
}: {
  appName?: string;
}) {
  const { banner, signOut, ...account } = useNavbar();
  const brand = <Brand appName={appName} />;

  return (
    <>
      <DesktopNavbar
        brand={brand}
        navLinks={<NavLinks variant="desktop" />}
        banner={banner}
        actions={
          <>
            <ThemeToggle />
            <DesktopActions {...account} onSignOut={signOut} />
          </>
        }
      />
      <MobileNavbar
        brand={brand}
        navLinks={<NavLinks variant="mobile" />}
        actions={<MobileActions {...account} onSignOut={signOut} />}
        banner={banner}
      />
    </>
  );
}
