import { useState, useEffect } from 'react';
import { Calendar, Plus, Check } from 'phosphor-react';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { getReviewPeriods, getActiveReviewPeriods } from '@/lib/storage';
import type { ReviewPeriod } from '@/types';
import { PeriodBadge } from './period-badge';

interface PeriodSelectorProps {
  value?: string;
  onChange: (periodId: string | null) => void;
  showActiveOnly?: boolean;
  showCreateOption?: boolean;
  onCreateNew?: () => void;
  className?: string;
}

export function PeriodSelector({
  value,
  onChange,
  showActiveOnly = false,
  showCreateOption = true,
  onCreateNew,
  className,
}: PeriodSelectorProps) {
  const [periods, setPeriods] = useState<ReviewPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPeriods();
  }, [showActiveOnly]);

  const loadPeriods = async () => {
    try {
      const data = showActiveOnly ? await getActiveReviewPeriods() : await getReviewPeriods();
      // Sort by year desc, then by type
      const sorted = data.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const typeOrder = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual', 'Custom'];
        return typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
      });
      setPeriods(sorted);
    } catch (error) {
      console.error('Failed to load periods:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedPeriod = periods.find((p) => p.id === value);

  if (loading) {
    return <div className="h-10 w-48 bg-muted animate-pulse rounded-md" />;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Calendar size={18} weight="duotone" className="text-muted-foreground/70" />
      <Select
        value={value || ''}
        onChange={(e) => {
          const selectedValue = e.target.value;
          if (selectedValue === '__create__' && onCreateNew) {
            onCreateNew();
          } else if (selectedValue && selectedValue !== '__create__') {
            onChange(selectedValue);
          } else {
            onChange(null);
          }
        }}
        className="w-48 min-h-[2.75rem]"
        disabled={periods.length === 0 && !showCreateOption}
      >
        <option value="">Select Period...</option>
        {periods.length === 0 && !showCreateOption && (
          <option disabled>No periods available</option>
        )}
        {periods.map((period) => (
          <option key={period.id} value={period.id}>
            {period.name} {period.status === 'active' ? '✓' : period.status === 'completed' ? '✓' : ''}
          </option>
        ))}
        {showCreateOption && onCreateNew && periods.length > 0 && (
          <>
            <option disabled>──────────</option>
            <option value="__create__">+ Create New Period</option>
          </>
        )}
      </Select>
      {selectedPeriod && (
        <PeriodBadge period={selectedPeriod} />
      )}
    </div>
  );
}
