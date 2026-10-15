import { ChartLineIcon, ListTodoIcon, WalletCardsIcon } from "lucide-react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { useAppSidebar } from "@/contexts/AppSidebarContext";
import { useAuth } from "@/contexts/AuthContext";
import useCurrentUser from "@/hooks/useCurrentUser";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";
import { SIDEBAR_ROW_CLASSES, SIDEBAR_ROW_ICON_CLASSES, sidebarRowStateClasses } from "./SidebarRow";
import SidebarSection from "./SidebarSection";

const PersonalNavigation = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { isUserSettingsInitialized } = useAuth();
  const { remindersEnabled, financeEnabled, moodEnabled } = usePersonalFeatures();
  const { setMobileOpen } = useAppSidebar();
  const location = useLocation();

  const destinations = [
    { enabled: remindersEnabled, path: ROUTES.REMINDERS, label: t("common.reminders"), icon: ListTodoIcon },
    { enabled: financeEnabled, path: ROUTES.FINANCE, label: t("personal.finance"), icon: WalletCardsIcon },
    { enabled: moodEnabled, path: ROUTES.MOOD, label: t("personal.mood"), icon: ChartLineIcon },
  ].filter((destination) => destination.enabled);
  if (!user || !isUserSettingsInitialized || destinations.length === 0) return null;

  return (
    <SidebarSection label={t("personal.navigation")}>
      {destinations.map(({ path, label, icon: Icon }) => {
        const active = !!matchPath(path, location.pathname);
        return (
          <Link
            key={path}
            to={path}
            onClick={() => setMobileOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(SIDEBAR_ROW_CLASSES, sidebarRowStateClasses(active))}
          >
            <Icon className={SIDEBAR_ROW_ICON_CLASSES} strokeWidth={1.8} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </SidebarSection>
  );
};

export default PersonalNavigation;
