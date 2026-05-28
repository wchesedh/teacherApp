'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface SearchableMultiSelectOption {
  value: string
  label: string
}

interface SearchableMultiSelectProps {
  options: SearchableMultiSelectOption[]
  selectedValues: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
}

export function SearchableMultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options',
  emptyText = 'No options found.',
  searchPlaceholder = 'Search...'
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedLabels = useMemo(
    () =>
      options
        .filter((option) => selectedValues.includes(option.value))
        .map((option) => option.label),
    [options, selectedValues]
  )

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return options
    return options.filter((option) => option.label.toLowerCase().includes(term))
  }, [options, search])

  const toggleValue = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((item) => item !== value))
      return
    }
    onChange([...selectedValues, value])
  }

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const triggerLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels[0]} +${selectedLabels.length - 1} more`

  return (
    <div ref={containerRef} className="relative w-full">
      <Button
        type="button"
        variant="outline"
        className="h-auto min-h-10 w-full justify-between gap-2 py-2 font-normal"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="min-w-0 flex-1 truncate text-left whitespace-normal break-words">
          {triggerLabel}
        </span>
        <span className="ml-2 text-xs text-gray-500">{selectedValues.length}</span>
      </Button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[min(60vh,22rem)] overflow-hidden rounded-md border bg-white p-2 shadow-lg">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="mb-2"
          />

          <div className="max-h-[min(45vh,16rem)] overflow-y-auto space-y-1">
            {filteredOptions.length === 0 ? (
              <p className="px-2 py-1 text-sm text-gray-500">{emptyText}</p>
            ) : (
              filteredOptions.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded px-2 py-2 text-sm hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(option.value)}
                    onChange={() => toggleValue(option.value)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="break-words">{option.label}</span>
                </label>
              ))
            )}
          </div>

          <div className="mt-2 flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
