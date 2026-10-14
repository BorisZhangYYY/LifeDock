import type { ReactNode } from "react";

interface Props {
  title: string;
  description: string;
  children: ReactNode;
}

const DashboardDetails = ({ title, description, children }: Props) => (
  <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
    {children}
  </section>
);

export default DashboardDetails;
