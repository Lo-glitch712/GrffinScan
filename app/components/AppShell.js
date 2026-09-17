import Link from "next/link";

export default function AppShell({ title, subtitle, children, wide = false, home = false, footer, backTo }) {
  return (
    <div className={wide ? "app app-wide" : "app"}>
      <header className={backTo ? "app-header has-back" : "app-header"}>
        {backTo ? (
          <Link href={backTo} className="back-link">
            Back
          </Link>
        ) : null}
        <p className={home ? "brand brand-lg" : "brand"}>GriffinScan</p>
        {!home && title ? <h1>{title}</h1> : null}
        {!home && subtitle ? <p className="app-subtitle">{subtitle}</p> : null}
      </header>
      <main className={home ? "app-main app-main-home" : "app-main"}>{children}</main>
      {footer === undefined ? (
        <footer className="app-footer">© 2026</footer>
      ) : (
        footer
      )}
    </div>
  );
}
