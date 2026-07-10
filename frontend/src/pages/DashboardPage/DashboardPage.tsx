import './DashboardPage.css';

export function DashboardPage() {
  return (
    <div className="dashboard-page">
      <header className="dashboard-page-header">
        <h1>Уведомления</h1>
      </header>

      <section className="dashboard-empty-state" aria-label="Уведомления">
        <p>Пока нет уведомлений.</p>
      </section>
    </div>
  );
}
