import { Navigate } from "react-router-dom";
import PersonalContent from "@/components/PersonalContent";
import useCurrentUser from "@/hooks/useCurrentUser";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import { ROUTES } from "@/router/routes";
import Reminders from "./Reminders";

const ReminderPage = () => {
  const user = useCurrentUser();
  const { remindersEnabled } = usePersonalFeatures();

  if (!remindersEnabled || !user) return <Navigate to={ROUTES.HOME} replace />;

  return (
    <section className="mx-auto w-full max-w-5xl">
      <PersonalContent>
        <Reminders />
      </PersonalContent>
    </section>
  );
};

export default ReminderPage;
