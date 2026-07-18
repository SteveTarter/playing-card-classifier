import React, { useState } from 'react';
import NavBarBrand from './NavBarBrand';
import 'bootstrap/dist/css/bootstrap.min.css';

import { Button } from 'react-bootstrap';

export default function NavBar({ onSelect, currentView, onSelectView, isAuthenticated, onSignOut }) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => setExpanded(prev => !prev);
  const handleSelect = (section) => {
    onSelectView('classifier');
    onSelect(section);
    setExpanded(false); // collapse menu after click
  };

  const handleViewSelect = (view) => {
    onSelectView(view);
    setExpanded(false);
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-light px-3 w-100 shadow-sm mb-4">
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
          <ul className="navbar-nav mb-2 mb-lg-0 align-items-center">
            <li className="nav-item">
              <button
                className={`nav-link btn btn-link ${currentView === 'classifier' ? 'fw-bold text-primary' : ''}`}
                onClick={() => handleViewSelect('classifier')}
              >
                Classifier
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link btn btn-link ${currentView === 'grading' ? 'fw-bold text-primary' : ''}`}
                onClick={() => handleViewSelect('grading')}
              >
                Grading
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link btn btn-link ${currentView === 'statistics' ? 'fw-bold text-primary' : ''}`}
                onClick={() => handleViewSelect('statistics')}
              >
                Statistics
              </button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => handleSelect('directions')}>Directions</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => handleSelect('about')}>About</button>
            </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={() => handleSelect('legal')}>Legal</button>
            </li>
            {isAuthenticated && (
              <li className="nav-item ms-lg-2">
                <Button variant="outline-danger" size="sm" onClick={onSignOut} className="py-1 px-3">Sign Out</Button>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
