export default function Select({ label, value, onChange, options = [], placeholder = "Bitte wählen" }) {
  return (
    <div className="form-group">
      {label && <label className="label">{label}</label>}
      <div className="select-wrap">
        <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map((opt) =>
            typeof opt === "string" ? (
              <option key={opt} value={opt}>{opt}</option>
            ) : (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            )
          )}
        </select>
        <span className="select-caret">▾</span>
      </div>
    </div>
  );
}
