import { useLayoutEffect, useRef, type RefObject } from "react";
import type { Task } from "../types";
import { displayColumnForTask } from "../types";
import { ANIMATION_LAB_TASK_ID } from "../lib/animationLab";
import {
  buildColumnFlightKeyframes,
  clampColumnFlightOptions,
  DEFAULT_COLUMN_FLIGHT_OPTIONS,
  type ColumnFlightOptions,
} from "../lib/columnFlight";

const BOARD_TASK_CARD = (id: number) => `.kanban-board .task-card[data-task-id="${id}"]`;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useTaskColumnFlight(
  tasks: Task[],
  labFlightOptionsRef: RefObject<ColumnFlightOptions>
) {
  const prevTasksRef = useRef<Task[] | null>(null);
  const lastRectsRef = useRef<Map<number, DOMRect>>(new Map());
  const inflightByTaskIdRef = useRef<Map<number, Animation>>(new Map());

  useLayoutEffect(() => {
    const previousTasks = prevTasksRef.current;
    const previousRects = lastRectsRef.current;
    const allowMotion = !prefersReducedMotion();

    if (previousTasks) {
      for (const task of tasks) {
        const previousTask = previousTasks.find((candidate) => candidate.id === task.id);
        if (!previousTask) continue;
        if (displayColumnForTask(previousTask) === displayColumnForTask(task)) continue;

        const from = previousRects.get(task.id);
        const element = document.querySelector<HTMLElement>(BOARD_TASK_CARD(task.id));
        if (!from || !element) continue;

        const to = element.getBoundingClientRect();
        const dx = to.left - from.left;
        const dy = to.top - from.top;

        if (allowMotion && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
          const prior = inflightByTaskIdRef.current.get(task.id);
          if (prior) prior.cancel();

          const flightOptions =
            task.id === ANIMATION_LAB_TASK_ID && labFlightOptionsRef.current
              ? clampColumnFlightOptions(labFlightOptionsRef.current)
              : DEFAULT_COLUMN_FLIGHT_OPTIONS;

          element.classList.add("task-card--column-flying");
          const clone = element.cloneNode(true) as HTMLElement;
          clone.setAttribute("aria-hidden", "true");
          clone.classList.remove("task-card--column-flying");
          clone.style.position = "fixed";
          clone.style.left = `${from.left}px`;
          clone.style.top = `${from.top}px`;
          clone.style.width = `${from.width}px`;
          clone.style.zIndex = "10000";
          clone.style.margin = "0";
          clone.style.pointerEvents = "none";
          clone.style.willChange = "transform";
          document.body.appendChild(clone);

          const animation = clone.animate(buildColumnFlightKeyframes(dx, dy, flightOptions), {
            duration: flightOptions.durationMs,
            fill: "forwards",
          });

          inflightByTaskIdRef.current.set(task.id, animation);

          const cleanup = () => {
            clone.remove();
            if (inflightByTaskIdRef.current.get(task.id) === animation) {
              inflightByTaskIdRef.current.delete(task.id);
              element.classList.remove("task-card--column-flying");
            }
          };

          animation.addEventListener("finish", cleanup);
          animation.addEventListener("cancel", cleanup);
        }
      }
    }

    const nextRects = new Map<number, DOMRect>();
    for (const node of document.querySelectorAll<HTMLElement>(
      ".kanban-board .task-card[data-task-id]"
    )) {
      const id = Number(node.getAttribute("data-task-id"));
      if (Number.isFinite(id)) {
        nextRects.set(id, node.getBoundingClientRect());
      }
    }
    lastRectsRef.current = nextRects;
    prevTasksRef.current = tasks;
  }, [tasks]);
}