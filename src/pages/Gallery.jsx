import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function Gallery() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/events')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load events')
        return res.json()
      })
      .then(data => setEvents(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="gallery-page"><p className="gallery-loading">Loading events...</p></div>
  if (error) return <div className="gallery-page"><p className="gallery-error">{error}</p></div>

  return (
    <div className="gallery-page">
      <div className="section-header">
        <h2>Gallery</h2>
        <div className="divider" />
        <p>Photos from our events and gatherings.</p>
      </div>

      {events.length === 0 ? (
        <p className="gallery-empty">No events yet. Check back soon!</p>
      ) : (
        <div className="event-grid">
          {events.map(event => (
            <Link to={`/gallery/${event.id}`} key={event.id} className="event-card">
              {event.coverImage ? (
                <img src={event.coverImage} alt={event.name} className="event-card-image" />
              ) : (
                <div className="event-card-placeholder" />
              )}
              <div className="event-card-info">
                <h3>{event.name}</h3>
                <span>{event.date}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default Gallery
