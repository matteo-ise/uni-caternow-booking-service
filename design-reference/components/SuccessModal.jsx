export default function SuccessModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-icon-circle">✓</div>
        <h2 className="modal-title">Anfrage gesendet!</h2>
        <p className="modal-text">
          Vielen Dank für deine Anfrage! <br />
Wir haben deine Angaben erhalten und melden uns in Kürze mit einem passenden Catering-Vorschlag!
        </p>
        <button className="modal-button" onClick={onClose}>
          Schließen
        </button>
      </div>
    </div>
  );
}
