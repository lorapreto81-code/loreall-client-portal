import { useEffect, useMemo, useRef, useState } from "react";
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
}

const flagUrl = (countryCode: string) =>
  `https://flagcdn.com/w20/${countryCode.toLowerCase()}.png`;

/**
 * Compact phone field with a visual country selector.
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
}: PhoneInputProps) => {
  const parsed = useMemo(() => splitPhone(value), [value]);
  const [dial, setDial] = useState(parsed.dial);
  const [national, setNational] = useState(parsed.national);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const emit = (nextDial: string, nextNational: string) => {
    setDial(nextDial);
    setNational(nextNational);
    onChange(toE164Digits(nextDial, nextNational));
  };

  const selected =
    COUNTRIES.find((c) => c.dial === dial) || COUNTRIES[0];

  return (
    <div
      ref={wrapperRef}
      className={`relative flex items-center gap-1 rounded-lg border border-border/60 bg-background h-9 overflow-hidden focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/10 ${className}`}
    >
      <button
        type="button"
        aria-label="Selecionar país"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 flex items-center gap-1 h-full pl-2 pr-1.5 text-xs text-foreground outline-none transition-colors hover:bg-muted/30 disabled:opacity-50"
      >
        <img
          src={flagUrl(selected.code)}
          alt={selected.name}
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
        <span className="font-medium tabular-nums">+{selected.dial}</span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Países"
          className="absolute top-full left-0 mt-1.5 z-50 max-h-56 w-48 overflow-auto rounded-lg border border-border bg-popover shadow-lg p-1"
        >
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              role="option"
              aria-selected={c.dial === dial}
              onClick={() => {
                emit(c.dial, national);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left text-popover-foreground hover:bg-muted ${
                c.dial === dial ? "bg-muted/70" : ""
              }`}
            >
              <img
                src={flagUrl(c.code)}
                alt={c.name}
                className="h-3.5 w-5 rounded-sm object-cover"
              />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                +{c.dial}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="w-px h-4 bg-border/60" />

      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        required={required}
        autoFocus={autoFocus}
        value={formatNational(dial, national)}
        onChange={(e) =>
          emit(dial, e.target.value.replace(/\D/g, "").slice(0, 13))
        }
        placeholder={
          placeholder || (dial === "55" ? "(00) 00000-0000" : "000 000 000")
        }
        className={
          inputClassName ||
          "min-w-0 flex-1 h-full bg-transparent border-0 px-2 py-0 text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-50"
        }
      />
    </div>
  );
};

export default PhoneInput;
