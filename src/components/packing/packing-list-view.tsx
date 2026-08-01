import { ItemRow } from "./item-row";

interface Item {
  id: string;
  name: string;
  quantity: number;
  isChecked: boolean;
  isSuggested: boolean;
  suggestionReason: string | null;
}

interface Category {
  id: string;
  name: string;
  items: Item[];
}

export function PackingListView({
  title,
  listId,
  categories,
  addCategoryAction,
  deleteCategoryAction,
  addItemAction,
  toggleItemAction,
  deleteItemAction,
}: {
  title: string;
  listId: string;
  categories: Category[];
  addCategoryAction: (listId: string, formData: FormData) => Promise<void>;
  deleteCategoryAction: (categoryId: string) => Promise<void>;
  addItemAction: (categoryId: string, formData: FormData) => Promise<void>;
  toggleItemAction: (itemId: string, isChecked: boolean) => Promise<void>;
  deleteItemAction: (itemId: string) => Promise<void>;
}) {
  const boundAddCategory = addCategoryAction.bind(null, listId);

  return (
    <div className="flex flex-col gap-4 border rounded p-4">
      <h3 className="font-medium">{title}</h3>

      {categories.length === 0 && (
        <p className="text-sm text-gray-500">No categories yet — add one below.</p>
      )}

      {categories.map((category) => {
        const boundAddItem = addItemAction.bind(null, category.id);
        return (
          <div key={category.id} className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold">{category.name}</h4>
              <form action={deleteCategoryAction.bind(null, category.id)}>
                <button type="submit" className="text-xs text-red-600 underline">
                  Delete category
                </button>
              </form>
            </div>

            <ul className="flex flex-col gap-1">
              {category.items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={toggleItemAction}
                  onDelete={deleteItemAction}
                />
              ))}
            </ul>

            <form action={boundAddItem} className="flex gap-2">
              <input
                type="text"
                name="name"
                placeholder="Item name"
                required
                className="border rounded px-2 py-1 text-sm flex-1"
              />
              <input
                type="number"
                name="quantity"
                min={1}
                defaultValue={1}
                className="border rounded px-2 py-1 text-sm w-16"
              />
              <button type="submit" className="text-sm underline">
                Add
              </button>
            </form>
          </div>
        );
      })}

      <form action={boundAddCategory} className="flex gap-2 pt-2 border-t">
        <input
          type="text"
          name="name"
          placeholder="New category (e.g. Clothing)"
          required
          className="border rounded px-2 py-1 text-sm flex-1"
        />
        <button type="submit" className="text-sm underline">
          Add category
        </button>
      </form>
    </div>
  );
}
