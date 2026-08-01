"use client";

import { useTransition } from "react";

export function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: { id: string; name: string; quantity: number; isChecked: boolean };
  onToggle: (itemId: string, isChecked: boolean) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <label className="flex items-center gap-2 flex-1">
        <input
          type="checkbox"
          checked={item.isChecked}
          disabled={pending}
          onChange={(e) => {
            const checked = e.target.checked;
            startTransition(() => {
              onToggle(item.id, checked);
            });
          }}
        />
        <span className={item.isChecked ? "line-through text-gray-400" : ""}>
          {item.name}
          {item.quantity > 1 && ` ×${item.quantity}`}
        </span>
      </label>
      <button
        type="button"
        onClick={() => startTransition(() => onDelete(item.id))}
        disabled={pending}
        className="text-red-600 text-xs underline"
      >
        Delete
      </button>
    </li>
  );
}
