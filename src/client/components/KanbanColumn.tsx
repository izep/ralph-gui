import type { Task, ColumnDef } from "../types";
import { displayColumnForTask } from "../types";
import { TaskCard } from "./TaskCard";

export function KanbanColumn({
  column,
  tasks,
  animationLab,
}: {
  column: ColumnDef;
  tasks: Task[];
  animationLab?: { task: Task; onAdvance: () => void } | null;
}) {
  const labHere =
    animationLab && displayColumnForTask(animationLab.task) === column.key
      ? animationLab
      : null;
  const showEmpty = tasks.length === 0 && !labHere;
  const count = tasks.length + (labHere ? 1 : 0);

  return (
    <div className="kanban-column">
      <div
        className="kanban-column__header"
        style={{ borderBottomColor: column.color }}
      >
        <span
          className="kanban-column__dot"
          style={{ backgroundColor: column.color }}
        />
        <h2 className="kanban-column__title">{column.label}</h2>
        <span className="kanban-column__count">{count}</span>
      </div>

      <div className="kanban-column__body">
        {showEmpty && (
          <p className="kanban-column__empty">{column.emptyMessage}</p>
        )}
        {labHere && (
          <div data-ralph-animation-lab="1">
            <TaskCard task={labHere.task} onPrimaryClick={labHere.onAdvance} />
          </div>
        )}
        {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
      </div>
    </div>
  );
}
