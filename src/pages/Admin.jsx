import { useEffect, useState } from 'react'

function Admin() {
  const [events, setEvents] = useState([])
  const [eventName, setEventName] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [files, setFiles] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState(null)
  const [eventImages, setEventImages] = useState([])
  const [editingEvent, setEditingEvent] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const activeEvents = events.filter(e => !e.archived)
  const archivedEvents = events.filter(e => e.archived)
  const uploadableEvents = activeEvents // can't upload to archived

  const loadEvents = () => {
    fetch('/api/events?all=1')
      .then(r => r.json())
      .then(data => setEvents(data))
      .catch(() => setMessage({ type: 'error', text: 'Failed to load events' }))
  }

  const loadImages = (eventId) => {
    if (!eventId) { setEventImages([]); return }
    fetch(`/api/events/${eventId}/images`)
      .then(r => r.json())
      .then(data => setEventImages(data))
      .catch(() => setEventImages([]))
  }

  useEffect(() => { loadEvents() }, [])
  useEffect(() => { loadImages(selectedEvent) }, [selectedEvent])

  const createEvent = async (e) => {
    e.preventDefault()
    if (!eventName.trim() || !eventDate) return
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: eventName.trim(), date: eventDate }),
      })
      if (!res.ok) throw new Error('Failed to create event')
      setEventName('')
      setEventDate('')
      setMessage({ type: 'success', text: 'Event created!' })
      loadEvents()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const uploadImages = async (e) => {
    e.preventDefault()
    if (!selectedEvent || !files?.length) return
    setUploading(true)
    setMessage(null)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('image', file)
        const res = await fetch(`/api/events/${selectedEvent}/images`, {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Failed to upload ${file.name}`)
        }
      }
      setFiles(null)
      setMessage({ type: 'success', text: `Uploaded ${files.length} image(s)!` })
      loadImages(selectedEvent)
      loadEvents()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setUploading(false)
    }
  }

  const deleteImage = async (imageId) => {
    if (!confirm('Delete this image?')) return
    try {
      const res = await fetch(`/api/events/${selectedEvent}/images/${imageId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete image')
      setMessage({ type: 'success', text: 'Image deleted.' })
      loadImages(selectedEvent)
      loadEvents()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const updateEvent = async (eventId, updates) => {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update event')
      loadEvents()
      return true
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
      return false
    }
  }

  const deleteEvent = async (eventId) => {
    const event = events.find(e => e.id === eventId)
    if (!confirm(`Permanently delete "${event?.name}" and all its images? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete event')
      setMessage({ type: 'success', text: 'Event deleted.' })
      if (selectedEvent === eventId) {
        setSelectedEvent('')
        setEventImages([])
      }
      loadEvents()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const startEditing = (event) => {
    setEditingEvent(event.id)
    setEditName(event.name)
    setEditDate(event.date)
  }

  const saveEdit = async () => {
    if (!editName.trim() || !editDate) return
    const ok = await updateEvent(editingEvent, { name: editName.trim(), date: editDate })
    if (ok) {
      setMessage({ type: 'success', text: 'Event updated.' })
      setEditingEvent(null)
    }
  }

  const toggleArchive = async (event) => {
    const ok = await updateEvent(event.id, { archived: !event.archived })
    if (ok) {
      setMessage({ type: 'success', text: event.archived ? 'Event unarchived.' : 'Event archived.' })
    }
  }

  const toggleHidden = async (event) => {
    const ok = await updateEvent(event.id, { hidden: !event.hidden })
    if (ok) {
      setMessage({ type: 'success', text: event.hidden ? 'Event is now visible.' : 'Event is now hidden.' })
    }
  }

  const renderEventRow = (event) => {
    const isEditing = editingEvent === event.id

    return (
      <div key={event.id} className="admin-event-row">
        {isEditing ? (
          <div className="admin-event-edit">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
            />
            <input
              type="date"
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
            />
            <button className="admin-btn admin-btn-primary" onClick={saveEdit}>Save</button>
            <button className="admin-btn" onClick={() => setEditingEvent(null)}>Cancel</button>
          </div>
        ) : (
          <>
            <div className="admin-event-info">
              <strong>{event.name}</strong>
              <span className="admin-event-date">{event.date}</span>
              {event.hidden && <span className="admin-badge admin-badge-hidden">Hidden</span>}
              {event.archived && <span className="admin-badge admin-badge-archived">Archived</span>}
            </div>
            <div className="admin-event-actions">
              <button className="admin-btn" onClick={() => startEditing(event)}>Edit</button>
              <button className="admin-btn" onClick={() => toggleHidden(event)}>
                {event.hidden ? 'Unhide' : 'Hide'}
              </button>
              <button className="admin-btn" onClick={() => toggleArchive(event)}>
                {event.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button className="admin-btn admin-btn-danger" onClick={() => deleteEvent(event.id)}>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <div className="section-header">
          <h2>Admin</h2>
          <div className="divider" />
        </div>
        <a href="/cdn-cgi/access/logout" className="admin-logout-btn">Logout</a>
      </div>

      {message && (
        <div className={`admin-message admin-message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Create Event */}
      <div className="admin-section">
        <h3>Create Event</h3>
        <form onSubmit={createEvent} className="admin-form">
          <input
            type="text"
            placeholder="Event name"
            value={eventName}
            onChange={e => setEventName(e.target.value)}
            required
          />
          <input
            type="date"
            value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            required
          />
          <button type="submit">Create Event</button>
        </form>
      </div>

      {/* Manage Events */}
      <div className="admin-section">
        <h3>Events</h3>
        {activeEvents.length === 0 && <p className="admin-empty">No active events.</p>}
        {activeEvents.map(renderEventRow)}

        {archivedEvents.length > 0 && (
          <>
            <button
              className="admin-btn admin-toggle-archived"
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? 'Hide' : 'Show'} Archived ({archivedEvents.length})
            </button>
            {showArchived && archivedEvents.map(renderEventRow)}
          </>
        )}
      </div>

      {/* Upload Images */}
      <div className="admin-section">
        <h3>Upload Images</h3>
        <form onSubmit={uploadImages} className="admin-form">
          <select
            value={selectedEvent}
            onChange={e => setSelectedEvent(e.target.value)}
            required
          >
            <option value="">Select event...</option>
            {uploadableEvents.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.name} ({ev.date}){ev.hidden ? ' [Hidden]' : ''}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={e => setFiles(e.target.files)}
            required
          />
          <button type="submit" disabled={uploading}>
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </div>

      {/* Manage Images */}
      {selectedEvent && eventImages.length > 0 && (
        <div className="admin-section">
          <h3>Manage Images</h3>
          <div className="admin-image-grid">
            {eventImages.map(img => (
              <div key={img.id} className="admin-image-item">
                <img src={img.url} alt="" />
                <button className="admin-delete-btn" onClick={() => deleteImage(img.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
