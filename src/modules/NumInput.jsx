import { useState, useEffect } from 'react';

/**
 * Sayısal input — tamamen silinebilir, 0 sorunu yok.
 * Props: value (number), onChange (number => void), unit, className, step, min, max
 */
export default function NumInput({ value, onChange, unit, className = '', step, min, max, placeholder }) {
  const [local, setLocal] = useState(value === 0 || value === '' ? '' : String(value));

  // Dışarıdan value değişince sync et (ama kullanıcı yazarken değil)
  useEffect(() => {
    const num = parseFloat(String(local).replace(',', '.'));
    if (isNaN(num) || num !== value) {
      setLocal(value === 0 ? '' : String(value));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e) => {
    const raw = e.target.value;
    // Sadece rakam, nokta, virgül, eksi işaretine izin ver
    if (!/^-?[\d.,]*$/.test(raw)) return;
    setLocal(raw);
    const num = parseFloat(raw.replace(',', '.'));
    if (!isNaN(num)) onChange(num);
  };

  const handleBlur = () => {
    const num = parseFloat(String(local).replace(',', '.'));
    if (isNaN(num) || local === '' || local === '-') {
      setLocal('');
      onChange(0);
    } else {
      setLocal(String(num));
      onChange(num);
    }
  };

  const baseClass = `flex-1 px-3 py-2 font-mono font-bold text-sm outline-none bg-transparent w-0 min-w-0`;

  return (
    <div className={`flex items-center border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-yellow-400 transition-colors bg-white ${className}`}>
      <input
        type="text"
        inputMode="decimal"
        value={local}
        placeholder={placeholder ?? '0'}
        step={step}
        min={min}
        max={max}
        onFocus={e => e.target.select()}
        onChange={handleChange}
        onBlur={handleBlur}
        className={baseClass}
      />
      {unit && (
        <span className="px-3 text-xs text-slate-400 font-bold border-l bg-slate-50 whitespace-nowrap flex-shrink-0">
          {unit}
        </span>
      )}
    </div>
  );
}
