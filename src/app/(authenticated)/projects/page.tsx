import { auth } from "@/auth";
import { getProjects } from "@/lib/actions/projects";
import { getGoals } from "@/lib/actions/goals";
import { getAreas, getAreaCounts } from "@/lib/actions/areas";
import { ProjectForm } from "@/components/projects/project-form";
import { GoalForm, GoalProgressBar, GoalProgressInput } from "@/components/projects/goal-form";
import { AreaForm, ArchiveAreaButton } from "@/components/projects/area-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatAppDate } from "@/lib/dates";
import { FolderKanban, Target, LayoutGrid } from "lucide-react";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  PLANNING: "bg-[#E5DBFE] text-[#13141A]",
  ACTIVE: "bg-[#D0E77F] text-[#13141A]",
  PAUSED: "bg-[#FBD4E6] text-[#13141A]",
  COMPLETED: "bg-[#EEF0F5] text-[#6B7280]",
  ARCHIVED: "bg-[#EEF0F5] text-[#6B7280]",
};

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;

  const [projectRows, goalRows, areaRows, areaCounts] = await Promise.all([
    getProjects(),
    getGoals(),
    getAreas(),
    getAreaCounts(),
  ]);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
              Life OS
            </p>
            <h1 className="text-2xl font-bold text-[#18201C]">Projects</h1>
            <p className="text-sm text-[#69736D] mt-0.5">
              Group goals, tasks, notes and expenses into outcomes that matter.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <AreaForm />
            <GoalForm areas={areaRows} projects={projectRows.map((p) => p.project)} />
            <ProjectForm areas={areaRows} />
          </div>
        </div>

        <Tabs defaultValue="projects">
          <TabsList>
            <TabsTrigger value="projects">
              <FolderKanban className="h-4 w-4 mr-1" /> Projects
            </TabsTrigger>
            <TabsTrigger value="goals">
              <Target className="h-4 w-4 mr-1" /> Goals
            </TabsTrigger>
            <TabsTrigger value="areas">
              <LayoutGrid className="h-4 w-4 mr-1" /> Areas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            {projectRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
                No projects yet. Create your first project to start grouping work.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {projectRows.map(({ project, areaName, areaColor }) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="rounded-2xl bg-white p-4 shadow-sm border border-transparent hover:border-[#CDD3CD] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <Badge
                        className={`${statusColor[project.status] ?? "bg-[#EEF0F5]"} border-0`}
                      >
                        {project.status}
                      </Badge>
                      {areaName && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: areaColor ?? "#EEF0F5" }}
                        >
                          {areaName}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-[#13141A] truncate">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="text-xs text-[#6B7280] mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3 text-xs text-[#6B7280]">
                      <span>{project.priority}</span>
                      {project.targetDate && (
                        <span>
                          · target{" "}
                          {formatAppDate(project.targetDate)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="goals" className="mt-4">
            {goalRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
                No goals yet. Goals are outcomes — projects are how you get there.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {goalRows.map(({ goal, areaName, projectName }) => (
                  <div
                    key={goal.id}
                    className="rounded-2xl bg-white p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        className={`${statusColor[goal.status] ?? "bg-[#EEF0F5]"} border-0`}
                      >
                        {goal.status}
                      </Badge>
                      <span className="text-xs text-[#6B7280]">
                        {areaName ?? projectName ?? ""}
                      </span>
                    </div>
                    <p className="font-semibold text-[#13141A]">{goal.title}</p>
                    {goal.description && (
                      <p className="text-xs text-[#6B7280] line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                    <GoalProgressBar
                      targetValue={goal.targetValue}
                      currentValue={goal.currentValue}
                    />
                    <GoalProgressInput
                      goalId={goal.id}
                      currentValue={goal.currentValue}
                      unit={goal.unit}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="areas" className="mt-4">
            {areaRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CDD3CD] bg-white/60 py-14 text-center text-[#69736D]">
                No areas yet. Areas like Work, Health or Hobby give every item a
                home.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {areaRows.map((area) => (
                  <div
                    key={area.id}
                    className="rounded-2xl bg-white p-4 shadow-sm flex items-start gap-3"
                  >
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: area.color ?? "#6366f1" }}
                    >
                      {area.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#13141A] truncate">
                        {area.name}
                      </p>
                      <p className="text-xs text-[#6B7280]">
                        {area.type} ·{" "}
                        {areaCounts.get(area.id) ?? 0} linked items
                      </p>
                    </div>
                    <ArchiveAreaButton areaId={area.id} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
