import { useState } from 'react';
import '../styles/DeprioritizeModal.css';

export function DeprioritizeModal({ issueKey, onConfirm, onCancel, isOpen }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    // Validação básica
    if (!reason.trim()) {
      setError('Motivo é obrigatório');
      return;
    }
    if (reason.length > 150) {
      setError('Motivo não pode exceder 150 caracteres');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConfirm(reason.trim());
      setReason('');
      setError('');
    } catch (err) {
      setError(err.message || 'Erro ao despriorizar');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setReason('');
    setError('');
    onCancel();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && e.ctrlKey && reason.trim()) {
      handleConfirm();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Despriorizar chamado {issueKey}</h2>
          <button className="modal-close" onClick={handleCancel} disabled={loading}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p>
            Tem certeza que quer remover <strong>TODAS</strong> as solicitações
            de prioridade deste chamado?
          </p>

          <label htmlFor="reason-input">Motivo da despiorização: *</label>
          <textarea
            id="reason-input"
            className="reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 150))}
            onKeyPress={handleKeyPress}
            placeholder="Ex: Cliente resolveu o problema internamente"
            disabled={loading}
            maxLength={150}
            rows={3}
          />
          <div className="char-counter">
            {reason.length}/150
          </div>

          {error && <div className="error-message">{error}</div>}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-cancel"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
          >
            {loading ? 'Desprioritizando...' : 'Despriorizar'}
          </button>
        </div>
      </div>
    </div>
  );
}
