import { Link } from 'react-router-dom';

type Props<T> = {
  title: string;
  items: T[];
  limit?: number;
  seeAllHref?: string;
  seeAllLabel?: string;
  renderItem: (item: T) => React.ReactNode;
  empty?: React.ReactNode;
};

export default function StaffListPreview<T>({
  title,
  items,
  limit = 5,
  seeAllHref,
  seeAllLabel = 'See all',
  renderItem,
  empty,
}: Props<T>) {
  const visible = items.slice(0, limit);
  const hasMore = items.length > limit;
  return (
    <div className="staff-panel staff-list-preview">
      <h3 className="staff-panel__title">{title}</h3>
      {visible.length === 0 ? (
        empty || <p className="staff-empty-hint">None at this time.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {visible.map((item, i) => (
            <div key={i}>{renderItem(item)}</div>
          ))}
        </div>
      )}
      {hasMore && seeAllHref && (
        <div className="staff-list-preview__footer">
          <Link to={seeAllHref}>{seeAllLabel} ({items.length})</Link>
        </div>
      )}
    </div>
  );
}
