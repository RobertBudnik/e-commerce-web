'use client';

import { useEffect, useId, useRef, useState } from 'react';

type Option = { value: string; label: string };

/**
 * Wysuwany stos opcji zamiast `<select>`, którego nie da się animować.
 * Zachowuje się jak listbox: strzałki chodzą po opcjach, Home/End skacze
 * na krańce, Enter wybiera, Escape zamyka i oddaje ostrość przyciskowi.
 */
export function SortStack({
  label,
  options,
  value,
  onChange,
  compact = false,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const box = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    if (open) menu.current?.focus();
  }, [open]);

  function pick(option: Option) {
    onChange(option.value);
    setOpen(false);
    button.current?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const move = (next: number) => {
      e.preventDefault();
      setCursor((next + options.length) % options.length);
    };

    switch (e.key) {
      case 'ArrowDown':
        return move(cursor + 1);
      case 'ArrowUp':
        return move(cursor - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(options.length - 1);
      case 'Enter':
      case ' ':
        e.preventDefault();
        return pick(options[cursor]);
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        return button.current?.focus();
      case 'Tab':
        return setOpen(false);
      default:
        return undefined;
    }
  }

  return (
    <div className={`sortbox${compact ? ' sortbox-sm' : ''}`} ref={box}>
      <span className="sr-only" id={labelId}>
        {label}
      </span>
      <button
        className="sortbox-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={labelId}
        ref={button}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span>{current?.label}</span>
        <span className="sortbox-chevron" aria-hidden="true" />
      </button>

      <ul
        className={`sortbox-menu${open ? ' is-open' : ''}`}
        role="listbox"
        aria-labelledby={labelId}
        tabIndex={-1}
        hidden={!open}
        ref={menu}
        onKeyDown={onKeyDown}
      >
        {options.map((option, i) => (
          <li
            key={option.value}
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            className={i === cursor ? 'is-active' : undefined}
            onClick={() => pick(option)}
            onMouseEnter={() => setCursor(i)}
          >
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
