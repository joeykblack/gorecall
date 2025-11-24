export default function TagSelector({ options = [], selected = [], onChange = () => {}, style = {} }) {
  const toggle = (tag) => {
    const idx = selected.indexOf(tag)
    let next = []
    if (idx === -1) next = selected.concat(tag)
    else next = selected.filter(t => t !== tag)
    onChange(next)
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', ...style }}>
      {options && options.length > 0 ? options.map((tag) => {
        const active = selected && selected.indexOf(tag) !== -1
        return (
          <button
            key={tag}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(tag)}
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '999px',
              border: active ? '1px solid #0066cc' : '1px solid #ccc',
              background: active ? '#0066cc' : '#f0f0f0',
              color: active ? '#fff' : '#111',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            {tag}
          </button>
        )
      }) : (
        <div style={{ color: '#666', fontSize: '0.9rem' }}>No tags</div>
      )}
    </div>
  )
}
