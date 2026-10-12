import './PageNavigation.css';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  onChange: (page: number) => void;
};

export function PageNavigation({ page, pageSize, total, loading, onChange }: Props) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Страницы списка" className="page-navigation">
      <button type="button" disabled={loading || page === 0} onClick={() => onChange(page - 1)}>Назад</button>
      <span>Страница {page + 1} из {pages}</span>
      <button type="button" disabled={loading || page + 1 >= pages} onClick={() => onChange(page + 1)}>Далее</button>
    </nav>
  );
}
