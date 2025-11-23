import { Component } from 'preact'

export default class Comments extends Component {
  render() {
    const { comments = [], detailsRef } = this.props

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
        <details open ref={detailsRef}>
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
