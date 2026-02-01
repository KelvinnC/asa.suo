const METADATA_KEY = 'metadata.json'
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])
const EXT_TO_CONTENT_TYPE = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
}

async function getMetadata(bucket) {
  const obj = await bucket.get(METADATA_KEY)
  if (!obj) return { events: [] }
  return obj.json()
}

async function putMetadata(bucket, data) {
  await bucket.put(METADATA_KEY, JSON.stringify(data), {
    httpMetadata: { contentType: 'application/json' },
  })
}

async function verifyAccess(request, env) {
  let jwt = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!jwt) {
    const cookie = request.headers.get('Cookie') || ''
    const match = cookie.match(/CF_Authorization=([^;]+)/)
    jwt = match ? match[1] : null
  }
  if (!jwt) return false

  const teamName = env.CF_ACCESS_TEAM_NAME
  const aud = env.CF_ACCESS_AUD
  // Fail closed: if config is missing, deny access
  if (!teamName || !aud) return false

  try {
    const certsUrl = `https://${teamName}/cdn-cgi/access/certs`
    const certsRes = await fetch(certsUrl)
    const { keys } = await certsRes.json()

    const parts = jwt.split('.')
    const header = JSON.parse(atob(parts[0]))
    const key = keys.find(k => k.kid === header.kid)
    if (!key) return false

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', key,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify'],
    )

    const signature = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    )
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, signature, data)
    if (!valid) return false

    const payload = JSON.parse(atob(parts[1]))
    if (payload.aud && !payload.aud.includes(aud)) return false

    return true
  } catch {
    return false
  }
}

async function handleGetEvents(env, url) {
  const metadata = await getMetadata(env.R2_BUCKET)
  const showAll = url.searchParams.get('all') === '1'
  if (showAll) {
    return Response.json(metadata.events)
  }
  return Response.json(metadata.events.filter(e => !e.hidden))
}

async function handlePostEvents(request, env) {
  const body = await request.json()
  const { name, date } = body
  if (!name || !date) {
    return Response.json({ error: 'name and date are required' }, { status: 400 })
  }

  const metadata = await getMetadata(env.R2_BUCKET)
  const id = `${date}-${crypto.randomUUID().slice(0, 8)}`

  metadata.events.push({
    id, name, date,
    coverImage: null,
    archived: false,
    hidden: false,
    createdAt: new Date().toISOString(),
  })
  metadata.events.sort((a, b) => b.date.localeCompare(a.date))
  await putMetadata(env.R2_BUCKET, metadata)

  return Response.json({ id, name, date }, { status: 201 })
}

async function handlePutEvent(request, env, eventId) {
  const body = await request.json()
  const metadata = await getMetadata(env.R2_BUCKET)
  const event = metadata.events.find(e => e.id === eventId)
  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 404 })
  }

  if (body.name !== undefined) event.name = body.name
  if (body.date !== undefined) event.date = body.date
  if (body.archived !== undefined) event.archived = body.archived
  if (body.hidden !== undefined) event.hidden = body.hidden

  metadata.events.sort((a, b) => b.date.localeCompare(a.date))
  await putMetadata(env.R2_BUCKET, metadata)

  return Response.json(event)
}

async function handleDeleteEvent(env, eventId) {
  const metadata = await getMetadata(env.R2_BUCKET)
  const eventIndex = metadata.events.findIndex(e => e.id === eventId)
  if (eventIndex === -1) {
    return Response.json({ error: 'Event not found' }, { status: 404 })
  }

  const prefix = `events/${eventId}/`
  let cursor = undefined
  do {
    const listed = await env.R2_BUCKET.list({ prefix, cursor })
    if (listed.objects.length > 0) {
      await env.R2_BUCKET.delete(listed.objects.map(obj => obj.key))
    }
    cursor = listed.truncated ? listed.cursor : undefined
  } while (cursor)

  metadata.events.splice(eventIndex, 1)
  await putMetadata(env.R2_BUCKET, metadata)

  return Response.json({ deleted: true })
}

async function handleGetImages(env, eventId) {
  const publicUrl = env.R2_PUBLIC_URL || ''
  const prefix = `events/${eventId}/`
  const listed = await env.R2_BUCKET.list({ prefix })

  const images = listed.objects.map(obj => ({
    id: obj.key.split('/').pop().replace(/\.[^.]+$/, ''),
    key: obj.key,
    url: `${publicUrl}/${obj.key}`,
    uploaded: obj.uploaded,
  }))

  return Response.json(images)
}

async function handlePostImages(request, env, eventId) {
  const metadata = await getMetadata(env.R2_BUCKET)
  const event = metadata.events.find(e => e.id === eventId)
  if (!event) {
    return Response.json({ error: 'Event not found' }, { status: 404 })
  }
  if (event.archived) {
    return Response.json({ error: 'Cannot upload to archived event' }, { status: 400 })
  }

  const publicUrl = env.R2_PUBLIC_URL || ''
  const formData = await request.formData()
  const file = formData.get('image')
  if (!file) {
    return Response.json({ error: 'No image provided' }, { status: 400 })
  }

  // Validate file extension and determine safe content type
  const ext = file.name.split('.').pop().toLowerCase()
  const contentType = EXT_TO_CONTENT_TYPE[ext]
  if (!contentType) {
    return Response.json(
      { error: `Invalid file type: .${ext}. Allowed: jpg, png, webp, gif, avif` },
      { status: 400 },
    )
  }

  // Also reject if the browser-reported MIME type is not an allowed image type
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return Response.json(
      { error: `Invalid MIME type: ${file.type}` },
      { status: 400 },
    )
  }

  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`
  const key = `events/${eventId}/${filename}`

  // Use server-determined content type, not user-provided
  await env.R2_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType },
  })

  const imageUrl = `${publicUrl}/${key}`

  if (!event.coverImage) {
    event.coverImage = imageUrl
    await putMetadata(env.R2_BUCKET, metadata)
  }

  return Response.json({
    id: filename.replace(/\.[^.]+$/, ''),
    key, url: imageUrl,
  }, { status: 201 })
}

async function handleDeleteImage(env, eventId, imageId) {
  const publicUrl = env.R2_PUBLIC_URL || ''
  const prefix = `events/${eventId}/`
  const listed = await env.R2_BUCKET.list({ prefix })
  const target = listed.objects.find(obj => {
    const name = obj.key.split('/').pop()
    return name.replace(/\.[^.]+$/, '') === imageId
  })

  if (!target) {
    return Response.json({ error: 'Image not found' }, { status: 404 })
  }

  await env.R2_BUCKET.delete(target.key)

  const metadata = await getMetadata(env.R2_BUCKET)
  const event = metadata.events.find(e => e.id === eventId)
  if (event && event.coverImage === `${publicUrl}/${target.key}`) {
    const remaining = listed.objects.filter(obj => obj.key !== target.key)
    event.coverImage = remaining.length > 0 ? `${publicUrl}/${remaining[0].key}` : null
    await putMetadata(env.R2_BUCKET, metadata)
  }

  return Response.json({ deleted: true })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    if (path.startsWith('/api/')) {
      if (method !== 'GET') {
        const authorized = await verifyAccess(request, env)
        if (!authorized) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }
      }

      if (path === '/api/events' && method === 'GET') {
        return handleGetEvents(env, url)
      }
      if (path === '/api/events' && method === 'POST') {
        return handlePostEvents(request, env)
      }

      const eventMatch = path.match(/^\/api\/events\/([^/]+)$/)
      if (eventMatch) {
        if (method === 'PUT') return handlePutEvent(request, env, eventMatch[1])
        if (method === 'DELETE') return handleDeleteEvent(env, eventMatch[1])
      }

      const imageMatch = path.match(/^\/api\/events\/([^/]+)\/images\/([^/]+)$/)
      if (imageMatch && method === 'DELETE') {
        return handleDeleteImage(env, imageMatch[1], imageMatch[2])
      }

      const imagesMatch = path.match(/^\/api\/events\/([^/]+)\/images\/?$/)
      if (imagesMatch) {
        if (method === 'GET') return handleGetImages(env, imagesMatch[1])
        if (method === 'POST') return handlePostImages(request, env, imagesMatch[1])
      }

      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    return env.ASSETS.fetch(request)
  },
}
