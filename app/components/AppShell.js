export default function AppShell({ title, children, wide = false, home = false, footer }) {
  return (
    <div className={wide ? "app app-wide" : "app"}>
      <header className="app-header">
        <p className={home ? "brand brand-lg" : "brand"}>GriffinScan</p>
        {!home && title ? <h1>{title}</h1> : null}
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
