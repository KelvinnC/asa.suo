import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'

function EventDetail() {
  const { eventId } = useParams()
  const [event, setEvent] = useState(null)
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/events').then(r => r.json()),
      fetch(`/api/events/${eventId}/images`).then(r => r.json()),
    ])
      .then(([events, imgs]) => {
        const found = events.find(e => e.id === eventId)
        if (!found) throw new Error('Event not found')
        setEvent(found)
        setImages(imgs)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [eventId])

  if (loading) return <div className="gallery-page"><p className="gallery-loading">Loading...</p></div>
  if (error) return <div className="gallery-page"><p className="gallery-error">{error}</p></div>

  return (
    <div className="gallery-page">
      <Link to="/gallery" className="back-link">&larr; Back to Gallery</Link>
      <div className="section-header">
        <h2>{event.name}</h2>
        <div className="divider" />
        <p>{event.date}</p>
      </div>

      {images.length === 0 ? (
        <p className="gallery-empty">No photos yet for this event.</p>
      ) : (
        <div className="photo-grid">
          {images.map(img => (
            <div key={img.id} className="photo-item" onClick={() => setLightbox(img)}>
              <img src={img.url} alt="" loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>&times;</button>
          <img src={lightbox.url} alt="" className="lightbox-image" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

export default EventDetail
