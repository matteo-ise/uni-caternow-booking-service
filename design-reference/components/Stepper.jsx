export default function Stepper({ step = 1, steps = [] }) {
  return (
    <ol className="stepper">
      {steps.map((s, i) => {
        const n = i + 1;
        const state =
          step > n ? "done" : step === n ? "active" : "todo";
        return (
          <li key={s} className={`step ${state}`}>
            <span className="step-index">{n}</span>
            <span className="step-label">{s}</span>
            {i < steps.length - 1 && <span className="step-connector" />}
          </li>
        );
      })}
    </ol>
  );
}
