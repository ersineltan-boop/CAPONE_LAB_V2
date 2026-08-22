import { CONSUMER_FOOTWEAR_CATEGORIES } from "../../categories/categoryFilterConfig";
import type { PrimaryFootwearCategory } from "../../taxonomy/types";
import { getCategoryLabel, UI_COPY } from "../../presentation/turkishLabels";

interface CategorySwitcherProps {
  currentCategory: PrimaryFootwearCategory;
  onSelectCategory: (category: PrimaryFootwearCategory) => void;
}

export default function CategorySwitcher({
  currentCategory,
  onSelectCategory,
}: CategorySwitcherProps) {
  return (
    <label className="inline-flex items-center gap-2 text-[10px] text-ink-muted">
      <span>{UI_COPY.changeCategory}</span>
      <select
        value={currentCategory}
        onChange={(event) =>
          onSelectCategory(event.target.value as PrimaryFootwearCategory)
        }
        className="border border-line bg-cream px-2 py-1.5 text-[10px] tracking-wide text-ink"
        aria-label={UI_COPY.changeCategory}
      >
        {CONSUMER_FOOTWEAR_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {getCategoryLabel(category)}
          </option>
        ))}
      </select>
    </label>
  );
}
