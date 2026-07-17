import React, { useState, useEffect } from "react";
import NavBar from "./NavBar";
import CardClassifier from "./CardClassifier";
import InfoPanel from "./InfoPanel";
import Login from "./Login";
import GradingDashboard from "./GradingDashboard";
import StatisticsDashboard from "./StatisticsDashboard";
import { AuthHelper } from "./AuthHelper";

function App() {
  const [activeSection, setActiveSection] = useState('');
  const [currentView, setCurrentView] = useState('classifier');
  const [isAuthenticated, setIsAuthenticated] = useState(AuthHelper.isAuthenticated());

  // Check auth status on mount
  useEffect(() => {
    setIsAuthenticated(AuthHelper.isAuthenticated());
  }, []);

  const selectActiveSelection = (section) => {
    setActiveSection(prev => (prev === section ? '' : section));
  };

  const handleSelectView = (view) => {
    setCurrentView(view);
    if (view !== 'classifier') {
      setActiveSection('');
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleSignOut = () => {
    AuthHelper.signOut();
    setIsAuthenticated(false);
    setCurrentView('classifier');
  };

  const renderContent = () => {
    if (currentView === 'grading') {
      return isAuthenticated ? (
        <GradingDashboard />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      );
    }

    if (currentView === 'statistics') {
      return isAuthenticated ? (
        <StatisticsDashboard />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      );
    }

    return (
      <div className="w-100 d-flex flex-column align-items-center justify-content-center">
        <CardClassifier />
        <hr className="w-75 my-4" />
        <InfoPanel activeSection={activeSection} />
      </div>
    );
  };

  return (
    <div className="min-vh-100 bg-light d-flex flex-column align-items-center w-100 pb-5">
      <NavBar
        onSelect={selectActiveSelection}
        currentView={currentView}
        onSelectView={handleSelectView}
        isAuthenticated={isAuthenticated}
        onSignOut={handleSignOut}
      />
      {renderContent()}
    </div>
  );
}

export default App;