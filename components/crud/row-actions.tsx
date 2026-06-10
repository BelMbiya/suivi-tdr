import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type RowActionsProps = {
  onEdit?: () => void;
  onDelete?: () => void;
  editLabel?: string;
  deleteLabel?: string;
};

export function RowActions({
  onEdit,
  onDelete,
  editLabel = "Modifier",
  deleteLabel = "Supprimer",
}: RowActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {onEdit ? (
        <Button type="button" variant="secondary" className="h-8 px-2.5" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
          <span className="sr-only">{editLabel}</span>
        </Button>
      ) : null}
      {onDelete ? (
        <Button type="button" variant="danger" className="h-8 px-2.5" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">{deleteLabel}</span>
        </Button>
      ) : null}
    </div>
  );
}
