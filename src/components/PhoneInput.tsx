import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  COUNTRIES,
  formatNational,
  splitPhone,
  toE164Digits,
} from "@/utils/countries";

interface PhoneInputProps {
  /** Digits (with or without country code) or a formatted string. */
  value: string;
  /** Emits digits only, always including the country code (e.g. 5583985591952). */
  onChange: (digits: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Extra classes for the text input. */
  inputClassName?: string;
  autoFocus?: boolean;
  id?: string;
  /** Accessible name for the phone number field. */
  "aria-label"?: string;
  /** Id of an external element labelling the phone number field. */
  "aria-labelledby"?: string;
  /** Id of an element describing the field (hint/error). */
  "aria-describedby"?: string;
}

const flagUrl = (countryCode: string) =>
  `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`;

let uid = 0;

/**
 * Compact phone field with an accessible country selector.
 * The emitted value is standardized (digits + country code) everywhere.
 */
export const PhoneInput = ({
  value,
  onChange,
  placeholder,
  disabled,
  required,
  className = "",
  inputClassName = "",
  autoFocus,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: PhoneInputProps) => {
  const parsed = useMemo(() => splitPhone(value), [value]);
  const [dial, setDial] = useState(parsed.dial);
  const [national, setNational] = useState(parsed.national);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ term: "", at: 0 });

  const baseId = useMemo(() => `phone-${++uid}`, []);
  const listboxId = `${baseId}-listbox`;
  const statusId = `${baseId}-status`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // Sync when the value changes from the outside
  useEffect(() => {
    const current = toE164Digits(dial, national);
    const incoming = String(value || "").replace(/\D/g, "");
    if (incoming !== current) {
      const next = splitPhone(value);
      setDial(next.dial);
      setNational(next.national);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close dropdown when clicking/tapping outside
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: PointerEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [open]);

  const selectedIndex = Math.max(
    0,
    COUNTRIES.findIndex((c) => c.dial === dial),
  );
  const selected = COUNTRIES[selectedIndex] || COUNTRIES[0];

  const emit = (nextDial: string, nextNational: string) => {
    setDial(nextDial);
    setNational(nextNational);
    onChange(toE164Digits(nextDial, nextNational));
  };

  const openList = useCallback(
    (index?: number) => {
      if (disabled) return;
      setActiveIndex(index ?? selectedIndex);
      setOpen(true);
    },
    [disabled, selectedIndex],
  );

  const closeList = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  };

  // Keep the focused option scrolled into view + move DOM focus into the list
  useLayoutEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(optionId(activeIndex))}`,
    );
    el?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const commit = (index: number) => {
    const c = COUNTRIES[index];
    if (!c) return;
    emit(c.dial, national);
    closeList();
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const last = COUNTRIES.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => (i >= last ? 0 : i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? last : i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(last);
        break;
      case "PageDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(last, i + 5));
        break;
      case "PageUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 5));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        closeList();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const now = Date.now();
          const t = typeahead.current;
          t.term = now - t.at > 700 ? e.key : t.term + e.key;
          t.at = now;
          const term = t.term.toLowerCase();
          const found = COUNTRIES.findIndex((c) =>
            c.name.toLowerCase().startsWith(term),
          );
          if (found >= 0) setActiveIndex(found);
        }
    }
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openList();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative flex items-center gap-1 rounded-lg border border-border/60 bg-background min-h-9 overflow-visible focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/10 ${className}`}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`País: ${selected.name} (+${selected.dial}). Alterar código do país`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className="shrink-0 flex items-center gap-1 self-stretch min-h-11 sm:min-h-9 pl-2 pr-1.5 text-xs text-foreground rounded-l-lg transition-colors hover:bg-muted/30 disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <img
          src={flagUrl(selected.code)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-3.5 w-5 rounded-sm object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = e.currentTarget
              .nextElementSibling as HTMLElement | null;
            if (fallback) fallback.style.display = "inline";
          }}
        />
        <span className="hidden text-sm leading-none" aria-hidden="true">
          {selected.flag}
        </span>
        <span className="font-medium tabular-nums" aria-hidden="true">
          +{selected.dial}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-label="Selecione o país"
          aria-activedescendant={optionId(activeIndex)}
          onKeyDown={onListKeyDown}
          className="absolute top-full left-0 mt-1.5 z-50 max-h-64 w-60 overflow-auto rounded-lg border border-border bg-popover shadow-lg p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {COUNTRIES.map((c, i) => {
            const isSelected = c.dial === dial;
            const isActive = i === activeIndex;
            return (
              <li
                key={c.code}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                onClick={() => commit(i)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2.5 sm:py-1.5 text-sm text-left text-popover-foreground ${
                  isActive ? "bg-muted" : ""
                } ${isSelected ? "font-medium" : ""}`}
              >
                <img
                  src={flagUrl(c.code)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="h-3.5 w-5 rounded-sm object-cover"
                />
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  +{c.dial}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="w-px h-4 bg-border/60" aria-hidden="true" />

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        aria-label={ariaLabelledBy ? undefined : ariaLabel || "Número de WhatsApp"}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={[ariaDescribedBy, statusId].filter(Boolean).join(" ")}
        value={formatNational(dial, national)}
        onChange={(e) =>
          emit(dial, e.target.value.replace(/\D/g, "").slice(0, 13))
        }
        placeholder={
          placeholder || (dial === "55" ? "(00) 00000-0000" : "000 000 000")
        }
        className={
          inputClassName ||
          "min-w-0 flex-1 self-stretch min-h-11 sm:min-h-9 bg-transparent border-0 px-2 py-0 text-sm outline-none rounded-r-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset placeholder:text-muted-foreground/60 disabled:opacity-50"
        }
      />

      <span id={statusId} className="sr-only" aria-live="polite">
        {`País selecionado: ${selected.name}, código +${selected.dial}`}
      </span>
    </div>
  );
};

export default PhoneInput;
