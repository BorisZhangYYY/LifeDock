import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import FinanceDashboard from "@/components/Finance/FinanceDashboard";
import FinanceTransactionDialog from "@/components/Finance/FinanceTransactionDialog";
import PersonalContent from "@/components/PersonalContent";
import FinanceSettings from "@/components/Settings/FinanceSettings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCurrentUser from "@/hooks/useCurrentUser";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";

const Finance = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { financeEnabled } = usePersonalFeatures();
  const location = useLocation();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const section = location.hash === "#manage" ? "manage" : location.hash === "#statistics" ? "statistics" : "records";

  if (!financeEnabled || !user) return <Navigate to={ROUTES.HOME} replace />;

  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="mb-4 flex h-9 items-center">
        <h1 className="text-xl font-semibold tracking-tight">{t("personal.finance")}</h1>
      </header>
      <PersonalContent>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={section}
            onValueChange={(value) => navigate(`${ROUTES.FINANCE}${value === "records" ? "" : `#${value}`}`)}
            className="min-w-0 max-w-full"
          >
            <TabsList className="w-fit max-w-full overflow-x-auto rounded-lg bg-muted/60 p-1">
              <TabsTrigger value="records" className="h-7 py-1 text-ui">
                {t("personal.records")}
              </TabsTrigger>
              <TabsTrigger value="statistics" className="h-7 py-1 text-ui">
                {t("common.statistics")}
              </TabsTrigger>
              <TabsTrigger value="manage" className="h-7 py-1 text-ui">
                {t("personal.finance-settings")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button size="sm" variant="outline" className="text-ui" onClick={() => setAddOpen(true)}>
            <PlusIcon className="size-3.5" />
            {t("finance.dashboard.add")}
          </Button>
        </div>
        {section === "manage" ? (
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <FinanceSettings />
          </div>
        ) : (
          <FinanceDashboard
            parent={user.name}
            onManage={() => navigate(`${ROUTES.FINANCE}#manage`)}
            view={section === "statistics" ? "statistics" : "records"}
          />
        )}
        <FinanceTransactionDialog open={addOpen} onOpenChange={setAddOpen} parent={user.name} />
      </PersonalContent>
    </section>
  );
};

export default Finance;
