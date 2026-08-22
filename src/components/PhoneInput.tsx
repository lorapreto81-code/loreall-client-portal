import { useEffect, useMemo, useState } from "react";
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
  /** Emits digits only, always including the country code (e.g. 5583999998888). */
  onChange: (digits: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Extra classes for the text input (defaults keep the field transparent). */
  inputClassName?: string;
  autoFocus?: boolean;
  id?: string;
}

/**
 * Phone field with a country selector. The emitted value is standardized
 * (digits + country code) everywhere in the app.
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

  const emit = (nextDial: string, nextNational: string) => {
    setDial(nextDial);
    setNational(nextNational);
    onChange(toE164Digits(nextDial, nextNational));
  };

  const selected =
    COUNTRIES.find((c) => c.dial === dial) || COUNTRIES[0];

  return (
    <div className={`flex items-stretch gap-2 ${className}`}>
      <div className="relative shrink-0">
        <select
          aria-label="País"
          disabled={disabled}
          value={`${selected.code}:${selected.dial}`}
          onChange={(e) => emit(e.target.value.split(":")[1], national)}
          className="appearance-none h-full w-[92px] pl-2.5 pr-6 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground outline-none focus:border-primary/50 cursor-pointer"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={`${c.code}:${c.dial}`}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </select>
        <ChevronDown className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
      </div>
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
        placeholder={placeholder || (dial === "55" ? "(00) 00000-0000" : "000 000 000")}
        className={
          inputClassName ||
          "w-full px-3 py-2.5 rounded-lg bg-background border border-border text-sm outline-none focus:border-primary/50"
        }
      />
    </div>
  );
};

export default PhoneInput;
