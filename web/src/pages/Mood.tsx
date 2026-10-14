import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useMemo } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import MoodDashboard from "@/components/MoodDashboard";
import PersonalContent from "@/components/PersonalContent";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCurrentUser from "@/hooks/useCurrentUser";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { useUserStats } from "@/hooks/useUserQueries";
import type { MoodPoint } from "@/lib/mood-stats";
import { ROUTES } from "@/router/routes";
import { useTranslate } from "@/utils/i18n";

const MoodContent = () => {
  const user = useCurrentUser();
  const { data: stats } = useUserStats(user?.name);
  const location = useLocation();
  const navigate = useNavigate();
  const points = useMemo(() => {
    const timestamps = stats?.moodCreatedTimestamps?.length ? stats.moodCreatedTimestamps : (stats?.memoCreatedTimestamps ?? []);
    const levels = stats?.moodLevels ?? [];
    const points: MoodPoint[] = [];
    timestamps.forEach((timestamp, index) => {
      const level = levels[index];
      if (!timestamp || !level || level < 1 || level > 7) return;
      points.push({ createTime: timestampDate(timestamp), moodLevel: level, memoName: stats?.moodMemoNames[index] });
    });
    return points;
  }, [stats]);

  return (
    <MoodDashboard
      points={points}
      view={location.hash === "#statistics" ? "statistics" : "records"}
      onMemoSelect={(name) => navigate(`/${name}`, { state: { from: `${location.pathname}${location.search}${location.hash}` } })}
    />
  );
};

const Mood = () => {
  const t = useTranslate();
  const user = useCurrentUser();
  const { moodEnabled } = usePersonalFeatures();
  const location = useLocation();
  const navigate = useNavigate();
  const section = location.hash === "#statistics" ? "statistics" : "records";

  if (!moodEnabled || !user) return <Navigate to={ROUTES.HOME} replace />;

  return (
    <section className="mx-auto w-full max-w-5xl">
      <header className="mb-4 flex h-9 items-center">
        <h1 className="text-xl font-semibold tracking-tight">{t("personal.mood")}</h1>
      </header>
      <PersonalContent>
        <Tabs value={section} onValueChange={(value) => navigate(`${ROUTES.MOOD}${value === "statistics" ? "#statistics" : ""}`)}>
          <TabsList className="mb-4 w-fit rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="records" className="h-7 py-1 text-ui">
              {t("personal.records")}
            </TabsTrigger>
            <TabsTrigger value="statistics" className="h-7 py-1 text-ui">
              {t("common.statistics")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <MoodContent />
      </PersonalContent>
    </section>
  );
};

export default Mood;
