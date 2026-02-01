import { useEffect, useRef, useState } from 'react'
import logo from '../ASA New Logo.png'

function Home() {
  const videoWrapperRef = useRef(null)
  const videoContainerRef = useRef(null)
  const videoRef = useRef(null)
  const [isMuted, setIsMuted] = useState(true)

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  useEffect(() => {
    const wrapper = videoWrapperRef.current
    const container = videoContainerRef.current
    if (!wrapper || !container) return

    const onScroll = () => {
      const rect = wrapper.getBoundingClientRect()
      const windowH = window.innerHeight

      const progress = Math.min(Math.max(1 - rect.top / windowH, 0), 1)

      const scale = 0.85 + progress * 0.15
      const radius = (1 - progress) * 24
      const padding = (1 - progress) * 40

      container.style.transform = `scale(${scale})`
      container.style.borderRadius = `${radius}px`
      wrapper.style.padding = `0 ${padding}px`
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* Hero */}
      <section className="hero" id="home">
        <div className="hero-pattern" />
        <img src={logo} alt="ASA Logo" className="hero-logo" />
        <h1>
          Asian Student Association
          <span>UBC Okanagan &middot; Est. 2007</span>
        </h1>
        <p className="hero-tagline">
          Building community, celebrating culture, and creating lasting
          connections at UBC Okanagan.
        </p>
      </section>

      {/* Video */}
      <section className="video-section" ref={videoWrapperRef}>
        <div className="video-container" ref={videoContainerRef}>
          <video
            ref={videoRef}
            className="video-fullscreen"
            src="https://src.asasuo.club/slow-dancing.mp4"
            autoPlay
            muted
            loop
            playsInline
          />
          <button className="mute-btn" onClick={toggleMute}>
            {isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
          </button>
        </div>
      </section>

      {/* Rubric */}
      <section className="rubric-section">
        <div className="section-header">
          <h2>Get Your LNY Tickets Now!</h2>
          <div className="divider" />
        </div>
        <iframe
          className="rubric-embed"
          src="https://campus.hellorubric.com/?eid=47492"
          title="Rubric"
          allowFullScreen
        />
      </section>
    </>
  )
}

export default Home
