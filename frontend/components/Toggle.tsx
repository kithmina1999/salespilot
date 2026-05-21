'use client';

import { useState, useEffect } from 'react';

interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export default function Toggle({ checked, defaultChecked = false, onChange, disabled = false }: ToggleProps) {
  const isControlled = checked !== undefined;
  const [internalChecked, setInternalChecked] = useState(defaultChecked);

  useEffect(() => {
    if (isControlled) {
      setInternalChecked(checked);
    }
  }, [checked, isControlled]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent parent clicks if embedded
    if (disabled) return;
    const nextChecked = !internalChecked;
    if (!isControlled) {
      setInternalChecked(nextChecked);
    }
    onChange?.(nextChecked);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={internalChecked}
      disabled={disabled}
      onClick={handleToggle}
      className={`group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 ease-in-out shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:scale-95 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${internalChecked ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-secondary hover:bg-border'}`}
    >
      {/* <span className="sr-only">Toggle</span>  */}
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-all duration-300 ease-out group-active:w-6 ${
          internalChecked ? 'translate-x-5 group-active:translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
