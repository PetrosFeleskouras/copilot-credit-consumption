import { useMemo, useState } from 'react'
import {
  Combobox,
  Dropdown,
  Option,
  Field,
  Input,
  Text,
  Button,
  Tag,
  TagGroup,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { FilterDismissRegular } from '@fluentui/react-icons'
import type { DateRange, PeriodKey, PeriodOption } from '../data/types'

const useStyles = makeStyles({
  bar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
    padding: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalL,
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    boxSizing: 'border-box',
  },
  period: { minWidth: '200px' },
  select: { minWidth: '220px' },
  dateInput: { minWidth: '150px' },
  spacer: { flex: 1 },
  reset: { marginBottom: tokens.spacingVerticalXXS },
  range: { color: tokens.colorNeutralForeground3, paddingBottom: tokens.spacingVerticalXS },
  tagsRow: {
    flexBasis: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  tagGroup: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS, rowGap: tokens.spacingVerticalXS },
  tagsLabel: { color: tokens.colorNeutralForeground3 },
})

export interface FilterOption {
  value: string
  label: string
}

interface SelectProps {
  label: string
  allLabel: string
  values: string[]
  options: FilterOption[]
  onChange: (values: string[]) => void
  className?: string
  limit?: number
}

/** A multi-select Combobox with type-to-filter. Empty selection = "All …". */
function MultiSelect({ label, allLabel, values, options, onChange, className, limit = 500 }: SelectProps) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  // Kept independent of `values` so selecting an item doesn't rebuild the list and reset scroll.
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase()
    const base = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
    return base.slice(0, limit)
  }, [options, text, limit])

  const labelFor = (v: string) => options.find((o) => o.value === v)?.label ?? v
  const summary =
    values.length === 0 ? '' : values.length === 1 ? labelFor(values[0]) : `${values.length} selected`

  return (
    <Field label={label}>
      <Combobox
        multiselect
        className={className}
        placeholder={allLabel}
        value={open ? text : summary}
        selectedOptions={values}
        onOpenChange={(_, d) => {
          setOpen(d.open)
          if (d.open) setText('')
        }}
        onChange={(ev) => setText(ev.target.value)}
        onOptionSelect={(_, d) => {
          // Preserve the dropdown scroll position across the selection re-render.
          // Fluent renders this popup as role="menu" (multiselect), so match both roles.
          const getBox = () =>
            document.querySelector('[role="listbox"],[role="menu"]') as HTMLElement | null
          const top = getBox()?.scrollTop ?? 0
          onChange(d.selectedOptions)
          const restore = () => {
            const b = getBox()
            if (b) b.scrollTop = top
          }
          requestAnimationFrame(() => {
            restore()
            requestAnimationFrame(restore)
          })
        }}
      >
        {matches.map((o) => (
          <Option key={o.value} value={o.value} text={o.label}>
            {o.label}
          </Option>
        ))}
      </Combobox>
    </Field>
  )
}

export interface EntityFilterDef {
  key: string
  label: string
  allLabel: string
  options: FilterOption[]
  values: string[]
  onChange: (values: string[]) => void
  limit?: number
}

interface Props {
  periodOptions: PeriodOption[]
  selectedKey: PeriodKey
  onSelectKey: (key: PeriodKey) => void
  customRange: DateRange
  onCustomChange: (range: DateRange) => void
  dateRange: { from: string; to: string } | null
  filters: EntityFilterDef[]
  onReset: () => void
}

export function EntityFilters({
  periodOptions,
  selectedKey,
  onSelectKey,
  customRange,
  onCustomChange,
  dateRange,
  filters,
  onReset,
}: Props) {
  const styles = useStyles()
  const periodLabel =
    selectedKey === 'custom'
      ? 'Custom range'
      : periodOptions.find((o) => o.key === selectedKey)?.label ?? ''

  const activeTags = filters.flatMap((f) =>
    f.values.map((v) => ({
      id: `${f.key}::${v}`,
      text: `${f.label}: ${f.options.find((o) => o.value === v)?.label ?? v}`,
    })),
  )

  const dismissTag = (tagId: string) => {
    const f = filters.find((x) => tagId.startsWith(`${x.key}::`))
    if (!f) return
    const v = tagId.slice(f.key.length + 2)
    f.onChange(f.values.filter((x) => x !== v))
  }

  return (
    <div className={styles.bar}>
      <Field label="Time period">
        <Dropdown
          className={styles.period}
          value={periodLabel}
          selectedOptions={[selectedKey]}
          onOptionSelect={(_, d) => d.optionValue && onSelectKey(d.optionValue as PeriodKey)}
        >
          {periodOptions.map((o) => (
            <Option key={o.key} value={o.key} text={o.label}>
              {o.label}
            </Option>
          ))}
          <Option key="custom" value="custom" text="Custom range">
            Custom range…
          </Option>
        </Dropdown>
      </Field>

      {selectedKey === 'custom' && (
        <>
          <Field label="From">
            <Input
              className={styles.dateInput}
              type="date"
              value={customRange.from}
              max={customRange.to}
              onChange={(_, d) => onCustomChange({ ...customRange, from: d.value })}
            />
          </Field>
          <Field label="To">
            <Input
              className={styles.dateInput}
              type="date"
              value={customRange.to}
              min={customRange.from}
              onChange={(_, d) => onCustomChange({ ...customRange, to: d.value })}
            />
          </Field>
        </>
      )}

      {filters.map((f) => (
        <MultiSelect
          key={f.key}
          label={f.label}
          allLabel={f.allLabel}
          values={f.values}
          options={f.options}
          onChange={f.onChange}
          className={styles.select}
          limit={f.limit}
        />
      ))}

      <Button
        className={styles.reset}
        appearance="secondary"
        icon={<FilterDismissRegular />}
        onClick={onReset}
      >
        Reset filters
      </Button>

      <div className={styles.spacer} />

      <Text size={200} className={styles.range}>
        {dateRange ? `${dateRange.from} → ${dateRange.to}` : 'No data'}
      </Text>

      {activeTags.length > 0 && (
        <div className={styles.tagsRow}>
          <Text size={200} className={styles.tagsLabel}>
            Active filters ({activeTags.length})
          </Text>
          <TagGroup className={styles.tagGroup} onDismiss={(_, d) => dismissTag(String(d.value))}>
            {activeTags.map((t) => (
              <Tag key={t.id} value={t.id} dismissible size="small">
                {t.text}
              </Tag>
            ))}
          </TagGroup>
        </div>
      )}
    </div>
  )
}
