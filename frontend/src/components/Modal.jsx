import './Modal.css';

function Modal({ isOpen, onClose, title, children }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} 
           style={{ backgroundColor: 'white', boxShadow: '0 0 30px rgba(0,0,0,0.7)' }}>
        <div className="modal-header" style={{ backgroundColor: 'white' }}>
          <h2>{title}</h2>
          <button onClick={onClose} className="modal-close-button">&times;</button>
        </div>
        <div className="modal-body" style={{ backgroundColor: 'white' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default Modal;