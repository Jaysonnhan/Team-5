import Icon from './Icon.jsx'

export default function EmptyState({ icon = 'search', title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="empty-title">{title}</h3>
      {children ? <div className="empty-body">{children}</div> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}
