import React from 'react';
import { LegalDocumentPage } from '../components/legal/LegalDocumentPage';
import { PRIVACY_DOCUMENT } from '../content/legalDocuments';

export const PrivacyPage: React.FC = () => (
  <LegalDocumentPage doc={PRIVACY_DOCUMENT} activePath="/privacy" />
);

export default PrivacyPage;
