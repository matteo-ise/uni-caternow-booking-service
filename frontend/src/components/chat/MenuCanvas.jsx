const SECTIONS = [
  { key: 'vorspeise',    label: '🥗 Vorspeise' },
  { key: 'hauptspeise1', label: '🍖 Hauptspeise 1' },
  { key: 'hauptspeise2', label: '🍽️ Hauptspeise 2' },
  { key: 'nachspeise',   label: '🍮 Nachspeise' },
]

export default function MenuCanvas({ menuOptions, menu, onSelect, onConfirm, step }) {
  const allFilled = SECTIONS.every(s => menu[s.key])

  return (
    <div className="canvas">
      <div className="canvas__header">
        <h3 className="canvas__title">Dein Menü</h3>
        {allFilled && (
          <span className="canvas__badge">Vollständig ✓</span>
        )}
      </div>

      <div className="canvas__sections">
        {SECTIONS.map(section => {
          const options    = menuOptions[section.key] || []
          const selected   = menu[section.key]
          const hasOptions = options.length > 0

          return (
            <div
              key={section.key}
              className={`canvas__section${selected ? ' canvas__section--filled' : ''}`}
            >
              <div className="canvas__section-label">{section.label}</div>

              {!hasOptions ? (
                <p className="canvas__placeholder">
                  Wird nach deinen Angaben befüllt…
                </p>
              ) : (
                <div className="canvas__options">
                  {options.map(dish => (
                    <label key={dish} className={`canvas__option${selected === dish ? ' canvas__option--selected' : ''}`}>
                      <input
                        type="radio"
                        name={section.key}
                        value={dish}
                        checked={selected === dish}
                        onChange={() => onSelect(section.key, dish)}
                      />
                      <span>{dish}</span>
                    </label>
                  ))}

                  {/* Neuer Vorschlag */}
                  <label className={`canvas__option canvas__option--suggest${selected === '__suggest__' ? ' canvas__option--selected' : ''}`}>
                    <input
                      type="radio"
                      name={section.key}
                      value="__suggest__"
                      checked={selected === '__suggest__'}
                      onChange={() => onSelect(section.key, '__suggest__')}
                    />
                    <span>💬 Neuer Vorschlag (Anpassung im Chat)</span>
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Bestätigungs-Button */}
      {step === 2 && (
        <button
          className={`canvas__confirm-btn${allFilled ? ' canvas__confirm-btn--active' : ''}`}
          disabled={!allFilled}
          onClick={onConfirm}
        >
          Mir gefällt das Menü ✓
        </button>
      )}
    </div>
  )
}
