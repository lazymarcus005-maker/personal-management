"use client";

import type { InferSelectModel } from "drizzle-orm";
import type { todos as todosTable } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleTodoStatus, deleteTodo } from "@/lib/actions/todos";
import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";

type Todo = InferSelectModel<typeof todosTable>;

export function TodoList({
  todos,
  emptyMessage,
}: {
  todos: Todo[];
  emptyMessage: string;
}) {
  if (todos.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-500">{emptyMessage}</div>
    );
  }

  return (
    <div className="space-y-2">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </div>
  );
}

function TodoItem({ todo }: { todo: Todo }) {
  const [isPending, startTransition] = useTransition();
  const isOverdue =
    todo.dueAt && isPast(todo.dueAt) && todo.status !== "DONE";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
        isOverdue
          ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20"
          : todo.status === "DONE"
            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
            : ""
      }`}
    >
      <Checkbox
        checked={todo.status === "DONE"}
        onCheckedChange={() =>
          startTransition(() => void toggleTodoStatus(todo.id))
        }
        disabled={isPending}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p
            className={`text-sm font-medium truncate ${
              todo.status === "DONE" ? "line-through text-neutral-400" : ""
            }`}
          >
            {todo.title}
          </p>
          <Badge
            variant={
              todo.priority === "URGENT"
                ? "destructive"
                : todo.priority === "HIGH"
                  ? "warning"
                  : todo.priority === "MEDIUM"
                    ? "info"
                    : "secondary"
            }
          >
            {todo.priority}
          </Badge>
        </div>
        {todo.dueAt && (
          <p
            className={`text-xs mt-0.5 ${
              isOverdue
                ? "text-red-500"
                : isToday(todo.dueAt)
                  ? "text-orange-500"
                  : "text-neutral-400"
            }`}
          >
            {format(todo.dueAt, "MMM d, yyyy")}
            {isToday(todo.dueAt) && " (Today)"}
            {isOverdue && " (Overdue)"}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-neutral-400 hover:text-red-500"
        onClick={() => startTransition(() => void deleteTodo(todo.id))}
        disabled={isPending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
