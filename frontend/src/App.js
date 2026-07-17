import React, { useState } from "react";
import NavBar from "./NavBar"
import CardClassifier from "./CardClassifier";
import InfoPanel from "./InfoPanel";

function App() {
  const [activeSection, setActiveSection] = useState('');

  const selectActiveSelection = (section) => {
    setActiveSection(prev => (prev === section ? '' : section));
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <NavBar onSelect={selectActiveSelection} />
      <CardClassifier />
      <hr />
      <InfoPanel activeSection={activeSection} />
    </div>
  );
}

export default App;