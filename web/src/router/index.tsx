import { createBrowserRouter, Navigate, type RouteObject, useLocation } from "react-router-dom";
import App from "@/App";
import { ChunkLoadErrorFallback } from "@/components/ErrorBoundary";
import usePersonalFeatures from "@/hooks/usePersonalFeatures";
import MainLayout from "@/layouts/MainLayout";
import RootLayout from "@/layouts/RootLayout";
import { lazyWithReload } from "@/utils/lazy";
import {
  LandingRoute,
  RequireAuthRoute,
  RequireExploreEnabledRoute,
  RequireFullInitializationRoute,
  RequireGuestRoute,
  RequireInstanceInitializationRoute,
} from "./guards";
import { CALENDAR_ROUTE_PATTERN, ROUTES } from "./routes";

const AdminSignIn = lazyWithReload(() => import("@/pages/AdminSignIn"));
const About = lazyWithReload(() => import("@/pages/About"));
const Archived = lazyWithReload(() => import("@/pages/Archived"));
const AuthCallback = lazyWithReload(() => import("@/pages/AuthCallback"));
const Calendar = lazyWithReload(() => import("@/pages/Calendar"));
const MapPage = lazyWithReload(() => import("@/pages/Map"));
const Explore = lazyWithReload(() => import("@/pages/Explore"));
const Home = lazyWithReload(() => import("@/pages/Home"));
const Finance = lazyWithReload(() => import("@/pages/Finance"));
const Mood = lazyWithReload(() => import("@/pages/Mood"));
const ReminderPage = lazyWithReload(() => import("@/pages/ReminderPage"));
const Inboxes = lazyWithReload(() => import("@/pages/Inboxes"));
const MemoDetail = lazyWithReload(() => import("@/pages/MemoDetail"));
const NotFound = lazyWithReload(() => import("@/pages/NotFound"));
const PermissionDenied = lazyWithReload(() => import("@/pages/PermissionDenied"));
const Attachments = lazyWithReload(() => import("@/pages/Attachments"));
const Setting = lazyWithReload(() => import("@/pages/Setting"));
const MemoViews = lazyWithReload(() => import("@/pages/MemoViews"));
const SignIn = lazyWithReload(() => import("@/pages/SignIn"));
const SignUp = lazyWithReload(() => import("@/pages/SignUp"));
const UserProfile = lazyWithReload(() => import("@/pages/UserProfile"));

const PersonalRedirect = () => {
  const { remindersEnabled, financeEnabled, moodEnabled } = usePersonalFeatures();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  searchParams.delete("view");
  const destination = remindersEnabled ? ROUTES.REMINDERS : financeEnabled ? ROUTES.FINANCE : moodEnabled ? ROUTES.MOOD : ROUTES.HOME;
  return <Navigate to={{ pathname: destination, search: searchParams.toString() }} replace />;
};

// Backward compatibility alias.
export const Routes = ROUTES;
export { ROUTES };

/**
 * Static route configuration. Exported so tests can assert on the tree shape
 * (e.g. that `/auth/callback` stays outside the guest-only guard subtree) and
 * so integration tests can drive a `createMemoryRouter` over the same tree.
 */
export const routeConfig: RouteObject[] = [
  {
    path: "/",
    element: <App />,
    errorElement: <ChunkLoadErrorFallback />,
    children: [
      {
        path: Routes.AUTH,
        children: [
          // The OAuth callback must run regardless of the current session — an
          // authenticated tab elsewhere must not block it from consuming its
          // one-time OAuth state. Keep it outside the guest-only subtree.
          { path: "callback", element: <AuthCallback /> },
          {
            element: <RequireInstanceInitializationRoute />,
            children: [
              {
                element: <RequireGuestRoute />,
                children: [
                  { path: "", element: <SignIn /> },
                  { path: "admin", element: <AdminSignIn /> },
                  { path: "signup", element: <SignUp /> },
                ],
              },
            ],
          },
        ],
      },
      // Backward compatibility: the old `/home` URL now lives at `/`.
      { path: "home", element: <Navigate to={Routes.HOME} replace /> },
      {
        element: <RootLayout />,
        children: [
          {
            element: <MainLayout />,
            children: [
              {
                element: <LandingRoute />,
                children: [{ index: true, element: <Home /> }],
              },
              {
                element: <RequireInstanceInitializationRoute />,
                children: [{ path: Routes.ABOUT, element: <About /> }],
              },
              {
                element: <RequireExploreEnabledRoute />,
                children: [{ path: Routes.EXPLORE, element: <Explore /> }],
              },
              { path: "u/:username", element: <UserProfile /> },
              {
                element: <RequireAuthRoute />,
                children: [
                  { path: Routes.ARCHIVED, element: <Archived /> },
                  { path: CALENDAR_ROUTE_PATTERN, element: <Calendar /> },
                  { path: Routes.MAP, element: <MapPage /> },
                  {
                    element: <RequireFullInitializationRoute />,
                    children: [
                      { path: Routes.VIEWS, element: <MemoViews /> },
                      { path: Routes.REMINDERS, element: <ReminderPage /> },
                      { path: Routes.FINANCE, element: <Finance /> },
                      { path: Routes.MOOD, element: <Mood /> },
                    ],
                  },
                ],
              },
            ],
          },
          { path: "memos/:uid", element: <MemoDetail /> },
          { path: "memos/shares/:token", element: <MemoDetail /> },
          {
            element: <RequireAuthRoute />,
            children: [
              {
                element: <RequireFullInitializationRoute />,
                children: [
                  { path: Routes.ATTACHMENTS, element: <Attachments /> },
                  { path: Routes.PERSONAL, element: <PersonalRedirect /> },
                  { path: "/shortcuts", element: <Navigate to={Routes.VIEWS} replace /> },
                  { path: Routes.INBOX, element: <Inboxes /> },
                  { path: Routes.SETTING, element: <Setting /> },
                ],
              },
            ],
          },
          { path: "403", element: <PermissionDenied /> },
          { path: "404", element: <NotFound /> },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routeConfig);

export default router;
