"use client";

import type { InferSelectModel } from "drizzle-orm";
import type { todos as todosTable } from "@/db/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleTodoStatus, deleteTodo } from "@/lib/actions/todos";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

type Todo = InferSelectModel<typeof todosTable>;

const priorityStyles: Record<string, string> = {
  URGENT: "bg-[#FFD4D4] text-[#B91C1C]",
  HIGH: "bg-[#FFE4C7] text-[#B45309]",
  MEDIUM: "bg-[#ACCDFF] text-[#1D4ED8]",
  LOW: "bg-[#EEF0F5] text-[#6B7280]",
};

export function TodoList({
  todos,
  emptyMessage,
}: {
  todos: Todo[];
  emptyMessage: string;
}) {
  if (todos.length === 0) {
    return (
      <div className="rounded-[20px] bg-white p-8 text-center">
        <p className="text-[#6B7280]">{emptyMessage}</p>
      </div>
    );
  }

  const sorted = [...todos].sort(
    (a, b) => Number(a.status === "DONE") - Number(b.status === "DONE")
  );

  return (
    <div className="space-y-3">
      {sorted.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}

function TodoItem({ todo }: { todo: Todo }) {
  const [isPending, startTransition] = useTransition();
  const isOverdue = todo.dueAt && isPast(todo.dueAt) && todo.status !== "DONE";
  const isDone = todo.status === "DONE";
  const isDueToday = !isDone && todo.dueAt && isToday(todo.dueAt);

  return (
    <div
      className={`rounded-[20px] bg-white p-4 flex items-center gap-4 transition-opacity ${
        isDone ? "opacity-60" : ""
      }`}
    >
      <div className="w-12 h-12 rounded-full bg-[#EEF0F5] flex items-center justify-center shrink-0">
        <Checkbox
          checked={isDone}
          onCheckedChange={() =>
            startTransition(() => void toggleTodoStatus(todo.id))
          }
          disabled={isPending}
          className="rounded-full border-[#13141A]/30 data-[state=checked]:bg-[#13141A] data-[state=checked]:border-[#13141A]"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`font-semibold truncate text-[#13141A] ${
              isDone ? "line-through text-[#6B7280]" : ""
            }`}
          >
            {todo.title}
          </p>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              priorityStyles[todo.priority] ?? priorityStyles.LOW
            }`}
          >
            {todo.priority}
          </span>
          {isDueToday && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 bg-red-500 text-white">
              Today
            </span>
          )}
        </div>
        {todo.dueAt && (
          <p
            className={`text-xs mt-0.5 ${
              isOverdue
                ? "text-red-500 font-medium"
                : isToday(todo.dueAt)
                  ? "text-orange-500"
                  : "text-[#6B7280]"
            }`}
          >
            {format(todo.dueAt, "MMM d, yyyy")}
            {isToday(todo.dueAt) && " · Today"}
            {isOverdue && " · Overdue"}
          </p>
        )}
      </div>
      <button
        className="w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-[#FFD4D4] hover:text-red-600 transition-colors shrink-0 disabled:opacity-50"
        onClick={() => startTransition(() => void deleteTodo(todo.id))}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
