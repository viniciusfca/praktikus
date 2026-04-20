import { useEffect, useState } from 'react';
import {
  CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle,
  CButton, CSpinner, CAlert,
} from '@coreui/react';

export interface PrintPromptModalProps {
  open: boolean;
  title: string;
  message: string;
  onPrint: () => Promise<void>;
  onClose: () => void;
}

export function PrintPromptModal({
  open,
  title,
  message,
  onPrint,
  onClose,
}: PrintPromptModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setLoading(false);
    }
  }, [open]);

  const handlePrint = async () => {
    setLoading(true);
    setError(null);
    try {
      await onPrint();
    } catch {
      setError('Erro ao gerar PDF.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CModal
      visible={open}
      onClose={onClose}
      alignment="center"
      backdrop="static"
      keyboard={false}
    >
      <CModalHeader closeButton={false}>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--cui-body-color)' }}>
          {message}
        </p>
        {error && (
          <CAlert color="danger" className="mt-3 mb-0">{error}</CAlert>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton
          color="primary"
          onClick={handlePrint}
          disabled={loading}
          style={{ minWidth: 130 }}
        >
          {loading ? <CSpinner size="sm" /> : 'Imprimir PDF'}
        </CButton>
        <CButton color="secondary" variant="outline" onClick={onClose} disabled={loading}>
          Fechar
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
