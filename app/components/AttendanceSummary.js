export default function AttendanceSummary({ label, total, programs = [] }) {
  return (
    <div className="card att-summary">
      {label ? <h3>{label}</h3> : null}
      <p className="att-summary-total">
        {total} {total === 1 ? "student" : "students"} attended
      </p>
      {programs.length ? (
        <div className="att-programs">
          {programs.map((program) => (
            <span key={program.name} className="badge is-on">
              {program.name} · {program.count}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">No programs yet.</p>
      )}
    </div>
  );
}
