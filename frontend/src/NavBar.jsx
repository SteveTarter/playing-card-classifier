import React, { useState } from 'react';
import NavBarBrand from './NavBarBrand';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function NavBar({ onSelect }) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => setExpanded(prev => !prev);
  const handleSelect = (section) => {
    onSelect(section);
    setExpanded(false); // collapse menu after click
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light px-3">
      <div className="container-fluid">
        <NavBarBrand />

        {/* Hamburger toggler */}
        <button
          className="navbar-toggler"
          type="button"
          onClick={handleToggle}
          aria-controls="navbarContent"
          aria-expanded={expanded}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Collapsible menu */}
        <div
          className={`collapse navbar-collapse justify-content-end ${expanded ? 'show' : ''}`}
          id="navbarContent"
        >
          <ul className="navbar-nav mb-2 mb-lg-0">
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => handleSelect('directions')}>Directions</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => handleSelect('about')}>About</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => handleSelect('legal')}>Legal</button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}
