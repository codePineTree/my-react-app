// Navigation.js - 상단 네비게이션 컴포넌트
import React from 'react';

const Navigation = ({ activeTab, setActiveTab }) => {
  const tabs = ['도면관리', '구역관리'];

  return (
    <nav className="top-nav">
      {tabs.map(tab => (
        <button
          key={tab}
          className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
};

export default Navigation;