import React from 'react';
import { Modal } from '../ui/Modal';
import { LEGAL_PRACTICE_AREAS } from '../../constants/legalCategories';

export type DirectoryMode = 'lawyers' | 'briefs';
export type RateBand = 'any' | 'under-1000' | '1000-3000' | '3000-5000' | 'over-5000' | 'flexible';
export type LawyerSort = 'relevance' | 'rating' | 'fee-low' | 'fee-high' | 'experience';
export type BriefSort = 'newest' | 'budget-low' | 'budget-high';
export type AvailabilityFilter = 'any' | 'open';

export interface DirectoryFilters {
  readonly category: string;
  readonly rateBand: RateBand;
  readonly lawyerSort: LawyerSort;
  readonly briefSort: BriefSort;
  readonly availability: AvailabilityFilter;
}

interface DirectoryFiltersPanelProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly mode: DirectoryMode;
  readonly filters: DirectoryFilters;
  readonly onChange: (next: DirectoryFilters) => void;
}

const RATE_OPTIONS: ReadonlyArray<{ value: RateBand; label: string }> = [
  { value: 'any', label: 'Any' },
  { value: 'under-1000', label: 'Under ₱1,000' },
  { value: '1000-3000', label: '₱1,000–₱3,000' },
  { value: '3000-5000', label: '₱3,000–₱5,000' },
  { value: 'over-5000', label: 'Over ₱5,000' },
];

function FilterOption({
  selected,
  onSelect,
  children,
}: {
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`dir-filter-opt${selected ? ' is-active' : ''}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

export const DirectoryFiltersPanel: React.FC<DirectoryFiltersPanelProps> = ({
  open,
  onClose,
  mode,
  filters,
  onChange,
}) => {
  const patch = (partial: Partial<DirectoryFilters>) => onChange({ ...filters, ...partial });
  const isLawyers = mode === 'lawyers';

  return (
    <Modal open={open} onClose={onClose} title="Filters" size="xl">
      <div className="dir-filter-grid">
        <section className="dir-filter-col">
          <h3 className="dir-filter-col__title">Type</h3>
          <p className="dir-filter-opt is-active" aria-current="true">
            {isLawyers ? 'Available lawyers' : 'Citizen requests'}
          </p>
        </section>

        <section className="dir-filter-col">
          <h3 className="dir-filter-col__title">Category</h3>
          <FilterOption selected={!filters.category} onSelect={() => patch({ category: '' })}>
            All
          </FilterOption>
          {LEGAL_PRACTICE_AREAS.map((area) => (
            <FilterOption
              key={area.value}
              selected={filters.category === area.value}
              onSelect={() => patch({ category: area.value })}
            >
              {area.label}
            </FilterOption>
          ))}
        </section>

        <section className="dir-filter-col">
          <h3 className="dir-filter-col__title">Rates</h3>
          {RATE_OPTIONS.map((opt) => (
            <FilterOption
              key={opt.value}
              selected={filters.rateBand === opt.value}
              onSelect={() => patch({ rateBand: opt.value })}
            >
              {opt.label}
            </FilterOption>
          ))}
          {!isLawyers ? (
            <FilterOption
              selected={filters.rateBand === 'flexible'}
              onSelect={() => patch({ rateBand: 'flexible' })}
            >
              Flexible
            </FilterOption>
          ) : null}
        </section>

        {isLawyers ? (
          <section className="dir-filter-col">
            <h3 className="dir-filter-col__title">Availability</h3>
            <FilterOption
              selected={filters.availability === 'any'}
              onSelect={() => patch({ availability: 'any' })}
            >
              Any
            </FilterOption>
            <FilterOption
              selected={filters.availability === 'open'}
              onSelect={() => patch({ availability: 'open' })}
            >
              Open slots
            </FilterOption>
          </section>
        ) : null}

        <section className="dir-filter-col">
          <h3 className="dir-filter-col__title">Sort by</h3>
          {isLawyers ? (
            <>
              <FilterOption
                selected={filters.lawyerSort === 'relevance'}
                onSelect={() => patch({ lawyerSort: 'relevance' })}
              >
                Relevance
              </FilterOption>
              <FilterOption
                selected={filters.lawyerSort === 'rating'}
                onSelect={() => patch({ lawyerSort: 'rating' })}
              >
                Rating
              </FilterOption>
              <FilterOption
                selected={filters.lawyerSort === 'fee-low'}
                onSelect={() => patch({ lawyerSort: 'fee-low' })}
              >
                Fee (low to high)
              </FilterOption>
              <FilterOption
                selected={filters.lawyerSort === 'fee-high'}
                onSelect={() => patch({ lawyerSort: 'fee-high' })}
              >
                Fee (high to low)
              </FilterOption>
              <FilterOption
                selected={filters.lawyerSort === 'experience'}
                onSelect={() => patch({ lawyerSort: 'experience' })}
              >
                Experience
              </FilterOption>
            </>
          ) : (
            <>
              <FilterOption
                selected={filters.briefSort === 'newest'}
                onSelect={() => patch({ briefSort: 'newest' })}
              >
                Newest
              </FilterOption>
              <FilterOption
                selected={filters.briefSort === 'budget-low'}
                onSelect={() => patch({ briefSort: 'budget-low' })}
              >
                Budget (low to high)
              </FilterOption>
              <FilterOption
                selected={filters.briefSort === 'budget-high'}
                onSelect={() => patch({ briefSort: 'budget-high' })}
              >
                Budget (high to low)
              </FilterOption>
            </>
          )}
        </section>
      </div>
    </Modal>
  );
};

export default DirectoryFiltersPanel;
