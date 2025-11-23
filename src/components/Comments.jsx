import { Component } from 'preact'

export default class Comments extends Component {
  constructor(props) {
    super(props)

    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('commentsOpen') : null
    const defaultOpen = stored != null ? stored === '1' : true

    this.state = { open: defaultOpen }
    this.onToggle = this.onToggle.bind(this)
    this.onStorage = this.onStorage.bind(this)
    this.onExternal = this.onExternal.bind(this)
  }

  componentDidMount() {
    window.addEventListener('storage', this.onStorage)
    window.addEventListener('commentsOpenChanged', this.onExternal)
    // ensure details ref (if provided) reflects current open state
    this.syncRef()
  }

  componentDidUpdate(prevProps, prevState) {
    // If comments appeared (empty -> non-empty) open the details
    const prevLen = (prevProps.comments && prevProps.comments.length) || 0
    const curLen = (this.props.comments && this.props.comments.length) || 0
    if (prevLen === 0 && curLen > 0) {
      // Only auto-open when there is no stored user preference. If the
      // user previously chose open/closed we should respect that.
      let stored = null
      try {
        stored = typeof window !== 'undefined' ? window.localStorage.getItem('commentsOpen') : null
      } catch (e) {
        stored = null
      }
      if (stored == null) {
        this.setOpen(true)
      }
    }
    // keep ref in sync when state.open changes
    if (prevState.open !== this.state.open) this.syncRef()
  }

  componentWillUnmount() {
    window.removeEventListener('storage', this.onStorage)
    window.removeEventListener('commentsOpenChanged', this.onExternal)
  }

  onStorage(e) {
    if (e.key === 'commentsOpen') {
      const val = e.newValue === '1'
      this.setState({ open: val })
    }
  }

  onExternal(e) {
    try {
      const open = !!(e && e.detail)
      this.setState({ open })
    } catch (err) {}
  }

  setOpen(open) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem('commentsOpen', open ? '1' : '0')
    } catch (e) {}
    // notify other listeners in same window
    try { window.dispatchEvent(new CustomEvent('commentsOpenChanged', { detail: open })) } catch (e) {}
    this.setState({ open })
  }

  onToggle(e) {
    const open = !!e.target.open
    this.setOpen(open)
  }

  syncRef() {
    const { detailsRef } = this.props
    if (!detailsRef) return
    try {
      if (typeof detailsRef === 'function') detailsRef(this.details)
      else if (detailsRef && typeof detailsRef === 'object') detailsRef.current = this.details
      if (this.details) this.details.open = !!this.state.open
    } catch (e) {}
  }

  render() {
    const { comments = [] } = this.props

    if (!comments || comments.length === 0) return null

    return (
      <div style={{
        width: '100%',
        maxWidth: '800px',
        marginBottom: '1rem',
        padding: '0.5rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '4px'
      }}>
        <details open={this.state.open} ref={(el) => { this.details = el }} onToggle={this.onToggle}>
          <summary><strong>Comments:</strong></summary>
          <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            {comments.map((comment, i) => {
              if (comment == null) return null
              const text = typeof comment === 'string' ? comment.trim() : String(comment)
              if (text === '') return null
              return (
                <li key={i} value={i + 1}>
                  <pre style={{
                    margin: '0.25rem 0',
                    whiteSpace: 'pre-wrap',
                    wordWrap: 'break-word',
                    fontFamily: 'inherit',
                    fontSize: 'inherit'
                  }}>
                    {comment}
                  </pre>
                </li>
              )
            })}
          </ol>
        </details>
      </div>
    )
  }
}
