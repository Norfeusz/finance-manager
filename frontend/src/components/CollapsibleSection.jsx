import { useState } from 'react';

// Ten komponent przyjmuje tytuł oraz "dzieci" (czyli treść, którą ma wyświetlać)
function CollapsibleSection({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="collapsible-section">
      <h3 onClick={toggleOpen} style={{ cursor: 'pointer' }}>
        {title} {isOpen ? '[-]' : '[+]'}
      </h3>
      {isOpen && (
        <div className="collapsible-content">
          {children}
        </div>
      )}
    </div>
  );
}

export default CollapsibleSection;