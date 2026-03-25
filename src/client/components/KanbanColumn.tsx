import type { Task, ColumnDef } from "../types";
import { TaskCard } from "./TaskCard";

export function KanbanColumn({
  column,
  tasks,
}: {
  column: ColumnDef;
  tasks: Task[];
}) {
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
        <span className="kanban-column__count">{tasks.length}</span>
      </div>

      <div className="kanban-column__body">
        {tasks.length === 0 ? (
          <p className="kanban-column__empty">{column.emptyMessage}</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}
