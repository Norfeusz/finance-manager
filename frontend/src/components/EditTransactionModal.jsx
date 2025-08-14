import { useState } from 'react';
import Modal from './Modal';

function EditTransactionModal({ isOpen, onClose, transaction, onSave }) {
  const [formData, setFormData] = useState({
    date: transaction.date ? new Date(transaction.date).toISOString().slice(0, 10) : '',
    account: transaction.account || '',
    cost: transaction.cost || 0,
    description: transaction.description || '',
    extraDescription: transaction.extraDescription || ''
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edytuj transakcję">
      <form onSubmit={handleSubmit} className="edit-transaction-form">
        <div className="form-group">
          <label htmlFor="date">Data:</label>
          <input type="date" id="date" name="date" value={formData.date} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="account">Konto:</label>
          <input type="text" id="account" name="account" value={formData.account} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="cost">Koszt:</label>
          <input type="number" step="0.01" id="cost" name="cost" value={formData.cost} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="description">Opis:</label>
          <input type="text" id="description" name="description" value={formData.description} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label htmlFor="extraDescription">Notatka:</label>
          <textarea id="extraDescription" name="extraDescription" rows="3" value={formData.extraDescription} onChange={handleChange}></textarea>
        </div>
        <div className="actions">
          <button type="button" onClick={onClose}>Anuluj</button>
          <button type="submit" className="primary">Zapisz zmiany</button>
        </div>
      </form>
    </Modal>
  );
}

export default EditTransactionModal;