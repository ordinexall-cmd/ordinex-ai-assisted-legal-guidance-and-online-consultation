import React from 'react';
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage';
import { TERMS_DOCUMENT } from '../content/legalDocuments';

export const TermsPage: React.FC = () => (
  <LegalDocumentPage doc={TERMS_DOCUMENT} activePath="/terms" />
);

export default TermsPage;
