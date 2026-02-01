import { Link } from 'react-router-dom'
import logo from '../ASA New Logo.png'

function Nav() {
  return (
    <nav className="nav">
      <Link to="/" className="nav-logo">
        <img src={logo} alt="ASA Logo" />
        <span>ASA</span>
      </Link>
      <ul className="nav-links">
        <li><Link to="/gallery">Gallery</Link></li>
      </ul>
    </nav>
  )
}

export default Nav
