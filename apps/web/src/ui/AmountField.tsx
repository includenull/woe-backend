import type { Token } from "../lib/mock.js";
import { Panel } from "./Panel.js";
import { TokenSelectButton } from "./TokenSelectButton.js";

export interface AmountFieldProps {
  /** "Sell" / "Buy" */
  label: string;
  token: Token;
  balance: string;
  /** display-only side (the computed buy output) renders text, not an input */
  readOnly?: boolean;
  /** uncontrolled initial value for the editable side */
  defaultValue?: string;
  /** computed value shown on the read-only side */
  value?: string;
  /** color the value with the brand accent (the output amount) */
  emphasis?: boolean;
  /** secondary line, e.g. USD estimate */
  hint?: string;
  onSelectToken?: () => void;
  inputId?: string;
}

export function AmountField({
  label,
  token,
  balance,
  readOnly = false,
  defaultValue,
  value,
  emphasis = false,
  hint,
  onSelectToken,
  inputId,
}: AmountFieldProps) {
  return (
    <Panel>
      <div className="mb-2 flex items-center justify-between text-[0.65rem] tracking-widest text-muted uppercase">
        <label htmlFor={inputId}>{label}</label>
        <span>{balance}</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {readOnly ? (
          <span
            className={`text-2xl tabular-nums ${emphasis ? "text-brand" : "text-ink"}`}
          >
            {value}
          </span>
        ) : (
          <input
            id={inputId}
            inputMode="decimal"
            autoComplete="off"
            defaultValue={defaultValue}
            placeholder="0.00"
            className="w-full bg-transparent text-2xl tabular-nums text-white outline-none placeholder:text-muted"
          />
        )}
        <TokenSelectButton token={token} onClick={onSelectToken} />
      </div>
      {hint && <div className="mt-1 text-[0.7rem] text-muted">{hint}</div>}
    </Panel>
  );
}
